import type * as admin from "firebase-admin";
import type express from "express";
import crypto from "node:crypto";

import { fail } from "./http";

type StoredStatus = "processing" | "done" | "failed";

type Stored = {
  scope: string;
  key: string;
  requestHash: string;
  status: StoredStatus;
  response?: any;
  error?: { message: string };
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
};

function hashJson(obj: any) {
  const s = JSON.stringify(obj ?? null);
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function getIdempotencyKey(req: express.Request, fallbackKey?: string | null): string | null {
  const v = req.header("Idempotency-Key");
  const key = v && v.trim().length > 0 ? v.trim() : null;
  return key ?? (fallbackKey && String(fallbackKey).trim().length > 0 ? String(fallbackKey).trim() : null);
}

/**
 * 멱등 실행 래퍼(프로덕 기본형, Firestore 외부 write와 충돌하지 않게 설계)
 *
 * 규칙:
 * - 같은 (scope,key) 재호출이면 저장된 response를 그대로 반환
 * - 같은 key인데 requestHash가 다르면 409(CONFLICT)
 * - processing 중 재호출이면 409(CONFLICT) "처리중"
 *
 * 저장 위치:
 * - idempotencyKeys/{scope}:{key}
 */
export async function withIdempotency<T>(
  adminApp: typeof admin,
  req: express.Request,
  res: express.Response,
  scope: string,
  handler: () => Promise<T>,
  options?: { fallbackKey?: string | null }
): Promise<T | null> {
  const key = getIdempotencyKey(req, options?.fallbackKey ?? null);
  if (!key) {
    fail(res, 400, "INVALID_ARGUMENT", "Idempotency-Key 헤더가 필요합니다.");
    return null;
  }

  const db = adminApp.firestore();
  const docId = `${scope}:${key}`;
  const ref = db.doc(`idempotencyKeys/${docId}`);
  const now = adminApp.firestore.FieldValue.serverTimestamp();
  const requestHash = hashJson({ body: req.body, query: req.query, path: req.path });

  // 1) 기존 키 확인
  const existing = await ref.get();
  if (existing.exists) {
    const s = existing.data() as Stored;
    if (s.requestHash !== requestHash) {
      fail(res, 409, "CONFLICT", "같은 Idempotency-Key로 다른 요청이 감지되었습니다.");
      return null;
    }
    if (s.status === "done") return s.response as T;
    if (s.status === "processing") {
      fail(res, 409, "CONFLICT", "동일 요청이 처리 중입니다. 잠시 후 다시 시도하세요.");
      return null;
    }
    // failed
    fail(res, 409, "CONFLICT", "이 Idempotency-Key 요청은 실패 이력이 있습니다. 새 키로 재시도하세요.");
    return null;
  }

  // 2) 예약(create는 원자적으로 "없을 때만 생성")
  try {
    await ref.create({
      scope,
      key,
      requestHash,
      status: "processing",
      createdAt: now,
      updatedAt: now
    } satisfies Stored);
  } catch {
    // race: 누가 먼저 만들었으면 1)로 다시
    const again = await ref.get();
    if (again.exists) {
      const s = again.data() as Stored;
      if (s.requestHash === requestHash && s.status === "done") return s.response as T;
      fail(res, 409, "CONFLICT", "동일 요청이 처리 중이거나 충돌이 발생했습니다.");
      return null;
    }
    fail(res, 500, "INTERNAL", "멱등 처리 저장소 오류가 발생했습니다.");
    return null;
  }

  // 3) 실제 처리
  try {
    const result = await handler();
    await ref.set({ status: "done", response: result, updatedAt: now }, { merge: true });
    return result;
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.startsWith("INVALID_ARGUMENT:")) {
      await ref.set({ status: "failed", error: { message: msg }, updatedAt: now }, { merge: true });
      fail(res, 400, "INVALID_ARGUMENT", msg.replace("INVALID_ARGUMENT:", ""));
      return null;
    }
    await ref.set({ status: "failed", error: { message: msg }, updatedAt: now }, { merge: true });
    fail(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
    return null;
  }
}
