import type express from "express";
import type * as admin from "firebase-admin";
import crypto from "node:crypto";

import { requireAuth, isOps, partnerIdOf, roleOf } from "../../lib/auth";
import { fail, ok } from "../../lib/http";
import { withIdempotency } from "../../lib/idempotency";
import { caseRef } from "../../lib/firestore";
import { writeTimelineEvent } from "../../lib/timeline";
import { createApproval } from "../../lib/approvals";

function quoteRef(adminApp: typeof admin, caseId: string, quoteId: string) {
  return adminApp.firestore().doc(`cases/${caseId}/quotes/${quoteId}`);
}

export function registerQuoteRoutes(app: express.Express, adminApp: typeof admin) {
  // 케이스 견적 목록(참여자)
  app.get("/v1/cases/:caseId/quotes", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const cs = await caseRef(adminApp, caseId).get();
    if (!cs.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cs.data() as any;

    const canRead = isOps(auth) || c.ownerUid === auth.uid || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canRead) return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    const snap = await adminApp.firestore().collection(`cases/${caseId}/quotes`).orderBy("updatedAt", "desc").limit(50).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  // 파트너: 견적 초안 생성
  app.post("/v1/cases/:caseId/quotes/draft", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const snap = await caseRef(adminApp, caseId).get();
    if (!snap.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = snap.data() as any;

    // 파트너 또는 ops만 견적 작성 가능
    const canWrite = isOps(auth) || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canWrite) return fail(res, 403, "FORBIDDEN", "견적 작성 권한이 없습니다.");

    const result = await withIdempotency(adminApp, req, res, "quotes.draft", async () => {
      const { priceMin, priceMax, currency, etaMinHours, etaMaxHours } = req.body ?? {};
      if (!priceMin || !priceMax) throw new Error("INVALID_ARGUMENT:priceMin/priceMax가 필요합니다.");

      const quoteId = crypto.randomUUID();
      const now = adminApp.firestore.FieldValue.serverTimestamp();

      await quoteRef(adminApp, caseId, quoteId).set({
        caseId,
        partnerId: c.partnerId,
        status: "draft",
        priceRange: { min: Number(priceMin), max: Number(priceMax), currency: currency ?? "KRW" },
        etaRange: { minHours: Number(etaMinHours ?? 24), maxHours: Number(etaMaxHours ?? 96) },
        createdAt: now,
        updatedAt: now,
        createdByUid: auth.uid
      });

      const eventId = crypto.randomUUID();
      await writeTimelineEvent(adminApp, caseId, eventId, {
        type: "QUOTE_DRAFTED",
        occurredAt: now,
        actor: isOps(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
        summaryKo: "견적이 작성되었습니다.",
        meta: { quoteId, priceRange: { min: Number(priceMin), max: Number(priceMax), currency: currency ?? "KRW" } }
      });

      return { quoteId };
    }).catch((e: any) => {
      const msg = String(e?.message || e);
      if (msg.startsWith("INVALID_ARGUMENT:")) {
        fail(res, 400, "INVALID_ARGUMENT", msg.replace("INVALID_ARGUMENT:", ""));
        return null;
      }
      fail(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
      return null;
    });

    if (!result) return;
    return ok(res, result);
  });

  // 파트너: 견적 확정(승인게이트 가능)
  app.post("/v1/cases/:caseId/quotes/:quoteId/finalize", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const quoteId = req.params.quoteId;
    const snap = await caseRef(adminApp, caseId).get();
    if (!snap.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = snap.data() as any;
    const canWrite = isOps(auth) || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canWrite) return fail(res, 403, "FORBIDDEN", "견적 확정 권한이 없습니다.");

    const result = await withIdempotency(adminApp, req, res, "quotes.finalize", async () => {
      const ref = quoteRef(adminApp, caseId, quoteId);
      const qs = await ref.get();
      if (!qs.exists) throw new Error("NOT_FOUND");
      const q = qs.data() as any;
      if (q.status === "finalized") return { status: "finalized", quoteId };

      // v1 정책: 견적 확정은 ops 승인 필요(프로덕 안전)
      const approvalId = q.approvalId || crypto.randomUUID();
      const now = adminApp.firestore.FieldValue.serverTimestamp();

      if (!q.approvalId) {
        await ref.set({ status: "pending_approval", approvalId, updatedAt: now }, { merge: true });
        await createApproval(adminApp, approvalId, {
          gate: "quote_finalize",
          status: "pending",
          target: { type: "quote", caseId, quoteId },
          requiredRole: "ops_approver",
          summaryKo: "견적 확정 승인 요청",
          payloadHash: null,
          createdBy: { uid: auth.uid, role: roleOf(auth) }
        });

        const eventId = crypto.randomUUID();
        await writeTimelineEvent(adminApp, caseId, eventId, {
          type: "APPROVAL_REQUESTED",
          occurredAt: now,
          actor: isOps(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
          summaryKo: "견적 확정을 위한 승인이 요청되었습니다.",
          meta: { approvalId, gate: "quote_finalize", target: { type: "quote", ref: quoteId } }
        });
      }

      return { approvalId, gate: "quote_finalize", requiredRole: "ops_approver" };
    }).catch((e: any) => {
      if (String(e?.message) === "NOT_FOUND") {
        fail(res, 404, "NOT_FOUND", "견적을 찾을 수 없습니다.");
        return null;
      }
      fail(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
      return null;
    });

    if (!result) return;
    // 승인 없이는 확정 불가 → 412
    return fail(res, 412, "APPROVAL_REQUIRED", "승인 대기 중입니다.", result);
  });

  // 사용자: 견적 수락(확정된 견적만)
  app.post("/v1/cases/:caseId/quotes/:quoteId/accept", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const quoteId = req.params.quoteId;
    const snap = await caseRef(adminApp, caseId).get();
    if (!snap.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = snap.data() as any;
    if (c.ownerUid !== auth.uid) return fail(res, 403, "FORBIDDEN", "견적 수락 권한이 없습니다.");

    const result = await withIdempotency(adminApp, req, res, "quotes.accept", async () => {
      const ref = quoteRef(adminApp, caseId, quoteId);
      const qs = await ref.get();
      if (!qs.exists) throw new Error("NOT_FOUND");
      const q = qs.data() as any;
      if (q.status !== "finalized") throw new Error("NOT_FINALIZED");

      const now = adminApp.firestore.FieldValue.serverTimestamp();
      await ref.set({ status: "accepted", acceptedByUid: auth.uid, acceptedAt: now, updatedAt: now }, { merge: true });

      const eventId = crypto.randomUUID();
      await writeTimelineEvent(adminApp, caseId, eventId, {
        type: "QUOTE_ACCEPTED_BY_USER",
        occurredAt: now,
        actor: { type: "user", uid: auth.uid },
        summaryKo: "견적이 수락되었습니다.",
        meta: { quoteId }
      });

      return { status: "accepted", quoteId };
    }).catch((e: any) => {
      const msg = String(e?.message || e);
      if (msg === "NOT_FOUND") {
        fail(res, 404, "NOT_FOUND", "견적을 찾을 수 없습니다.");
        return null;
      }
      if (msg === "NOT_FINALIZED") {
        fail(res, 409, "CONFLICT", "확정되지 않은 견적은 수락할 수 없습니다.");
        return null;
      }
      fail(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
      return null;
    });

    if (!result) return;
    return ok(res, result);
  });
}
