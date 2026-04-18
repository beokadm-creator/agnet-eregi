import type express from "express";
import type * as admin from "firebase-admin";

import { requireAuth, isOps, partnerIdOf, roleOf } from "../../lib/auth";
import { fail, ok } from "../../lib/http";
import { caseRef } from "../../lib/firestore";
import { writeTimelineEvent } from "../../lib/timeline";
import { withIdempotency } from "../../lib/idempotency";
import { type CaseStatus, isAllowedTransition } from "../../lib/case_status";
import { workflowRef, initChecklist } from "../../lib/workflow";
import { createTask } from "../../lib/tasks";

export function registerCaseRoutes(app: express.Express, adminApp: typeof admin) {
  app.post("/v1/cases", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const result = await withIdempotency(adminApp, req, res, "cases.create", async () => {
      const { sessionId, selectedPartnerId, casePackId } = req.body ?? {};
      if (!selectedPartnerId || !casePackId) {
        // withIdempotency 내부에서 fail을 호출하면 tx가 깨질 수 있어, 여기서는 throw 대신 응답용 에러를 반환하지 않게 처리
        throw new Error("INVALID_ARGUMENT:selectedPartnerId와 casePackId가 필요합니다.");
      }

      const caseId = crypto.randomUUID();
      const now = adminApp.firestore.FieldValue.serverTimestamp();

      await caseRef(adminApp, caseId).set({
        ownerUid: auth.uid,
        partnerId: String(selectedPartnerId),
        casePackId: String(casePackId),
        status: "new",
        riskLevel: "low",
        createdAt: now,
        updatedAt: now,
        summary: { lastEventKo: "케이스가 생성되었습니다.", sessionId: sessionId ?? null }
      });

      const eventId = crypto.randomUUID();
      await writeTimelineEvent(adminApp, caseId, eventId, {
        type: "CASE_CREATED",
        occurredAt: now,
        actor: { type: "user", uid: auth.uid },
        summaryKo: "케이스가 생성되었습니다.",
        meta: { partnerId: String(selectedPartnerId), casePackId: String(casePackId) }
      });

      // 워크플로우 초기화(법무사 프로세스 기반)
      await workflowRef(adminApp, caseId).set({
        caseId,
        casePackId: String(casePackId),
        stage: "intake",
        checklist: initChecklist(String(casePackId), "intake"),
        createdAt: now,
        updatedAt: now
      });

      // 초기 태스크(파트너 큐에 뜨도록)
      await createTask(adminApp, {
        caseId,
        partnerId: String(selectedPartnerId),
        titleKo: "케이스 접수 확인 및 1차 안내",
        type: "intake"
      });

      return { caseId };
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

  app.get("/v1/cases/:caseId", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const snap = await caseRef(adminApp, caseId).get();
    if (!snap.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const data = snap.data() as any;

    const canRead =
      isOps(auth) || data.ownerUid === auth.uid || (partnerIdOf(auth) && data.partnerId === partnerIdOf(auth));
    if (!canRead) return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    return ok(res, { case: { id: snap.id, ...data, _role: roleOf(auth) } });
  });

  // Partner/Ops: 케이스 상태 전이(서버만 허용)
  app.post("/v1/cases/:caseId/transition", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const { to, reasonKo } = req.body ?? {};
    const toStatus = String(to || "") as CaseStatus;
    if (!toStatus) return fail(res, 400, "INVALID_ARGUMENT", "to가 필요합니다.");

    const result = await withIdempotency(adminApp, req, res, "cases.transition", async () => {
      const now = adminApp.firestore.FieldValue.serverTimestamp();
      const ref = caseRef(adminApp, caseId);

      const txResult = await adminApp.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error("NOT_FOUND");
        const c = snap.data() as any;

        const canWrite =
          isOps(auth) || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
        if (!canWrite) throw new Error("FORBIDDEN");

        const fromStatus = String(c.status || "new") as CaseStatus;
        if (fromStatus === toStatus) {
          return { status: fromStatus };
        }
        if (!isAllowedTransition(fromStatus, toStatus)) {
          throw new Error("INVALID_TRANSITION");
        }

        tx.set(
          ref,
          {
            status: toStatus,
            updatedAt: now,
            summary: {
              ...(c.summary ?? {}),
              lastEventKo: reasonKo ? String(reasonKo) : `상태 변경: ${fromStatus} → ${toStatus}`
            }
          },
          { merge: true }
        );
        return { status: toStatus, partnerId: c.partnerId, fromStatus, toStatus };
      });

      // 타임라인은 트랜잭션 밖에서 기록(중요: tx 내부에서 await 금지)
      const eventId = crypto.randomUUID();
      await writeTimelineEvent(adminApp, caseId, eventId, {
        type: "CASE_STATUS_CHANGED",
        occurredAt: now,
        actor: isOps(auth)
          ? { type: "ops", uid: auth.uid }
          : { type: "partner", partnerId: txResult.partnerId, uid: auth.uid },
        summaryKo: reasonKo ? String(reasonKo) : "케이스 상태가 변경되었습니다.",
        meta: { from: txResult.fromStatus, to: txResult.toStatus }
      });

      return { status: txResult.status };
    }).catch((e: any) => {
      const msg = String(e?.message || e);
      if (msg === "NOT_FOUND") {
        fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
        return null;
      }
      if (msg === "FORBIDDEN") {
        fail(res, 403, "FORBIDDEN", "상태 변경 권한이 없습니다.");
        return null;
      }
      if (msg === "INVALID_TRANSITION") {
        fail(res, 409, "CONFLICT", "허용되지 않는 상태 전이입니다.");
        return null;
      }
      fail(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
      return null;
    });

    if (!result) return;
    return ok(res, result);
  });

  // 케이스 타임라인 조회(참여자)
  app.get("/v1/cases/:caseId/timeline", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));

    const snap = await caseRef(adminApp, caseId).get();
    if (!snap.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const data = snap.data() as any;
    const canRead =
      isOps(auth) || data.ownerUid === auth.uid || (partnerIdOf(auth) && data.partnerId === partnerIdOf(auth));
    if (!canRead) return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    const tSnap = await adminApp
      .firestore()
      .collection(`cases/${caseId}/timeline`)
      .orderBy("occurredAt", "desc")
      .limit(limit)
      .get();
    const items = tSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });
}
