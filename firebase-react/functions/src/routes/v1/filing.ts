import type express from "express";
import type * as admin from "firebase-admin";
import crypto from "node:crypto";

import { requireAuth, isOps, partnerIdOf, roleOf } from "../../lib/auth";
import { fail, ok } from "../../lib/http";
import { caseRef } from "../../lib/firestore";
import { withIdempotency } from "../../lib/idempotency";
import { writeTimelineEvent } from "../../lib/timeline";
import { filingRef, validateSubmittedDate } from "../../lib/filing";
import { tryAutoCompleteAfterFiling } from "../../lib/workflow_auto";
import { ensureTask, setTaskStatus } from "../../lib/tasks";
import { nextStage, validateStagePrerequisites, workflowRef } from "../../lib/workflow";

export function registerFilingRoutes(app: express.Express, adminApp: typeof admin) {
  // 접수 정보 조회(참여자)
  app.get("/v1/cases/:caseId/filing", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const cs = await caseRef(adminApp, caseId).get();
    if (!cs.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cs.data() as any;
    const canRead = isOps(auth) || c.ownerUid === auth.uid || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canRead) return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    const snap = await filingRef(adminApp, caseId).get();
    return ok(res, { exists: snap.exists, filing: snap.exists ? { id: snap.id, ...snap.data() } : null });
  });

  // 접수 정보 저장(파트너/ops)
  app.post("/v1/cases/:caseId/filing", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const cs = await caseRef(adminApp, caseId).get();
    if (!cs.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cs.data() as any;
    const canWrite = isOps(auth) || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canWrite) return fail(res, 403, "FORBIDDEN", "권한이 없습니다.");

    const { receiptNo, jurisdictionKo, submittedDate, memoKo } = req.body ?? {};
    if (!receiptNo || !jurisdictionKo || !submittedDate) {
      return fail(res, 400, "INVALID_ARGUMENT", "receiptNo/jurisdictionKo/submittedDate가 필요합니다.");
    }
    if (!validateSubmittedDate(String(submittedDate))) {
      return fail(res, 400, "INVALID_ARGUMENT", "submittedDate는 YYYY-MM-DD 형식이어야 합니다.");
    }

    const result = await withIdempotency(adminApp, req, res, "filing.upsert", async () => {
      const now = adminApp.firestore.FieldValue.serverTimestamp();
      await filingRef(adminApp, caseId).set(
        {
          caseId,
          partnerId: c.partnerId,
          receiptNo: String(receiptNo),
          jurisdictionKo: String(jurisdictionKo),
          submittedDate: String(submittedDate),
          memoKo: memoKo ? String(memoKo) : null,
          updatedAt: now,
          createdAt: now
        },
        { merge: true }
      );

      const eventId = crypto.randomUUID();
      await writeTimelineEvent(adminApp, caseId, eventId, {
        type: "FILING_INFO_UPSERTED",
        occurredAt: now,
        actor: isOps(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
        summaryKo: "접수 정보가 저장되었습니다.",
        meta: { receiptNo: String(receiptNo), submittedDate: String(submittedDate), jurisdictionKo: String(jurisdictionKo), by: roleOf(auth) }
      });

      return { ok: true };
    });

    if (!result) return;
    // 자동 완료 연결(조건 충족 시 completed로 전진)
    const auto = await tryAutoCompleteAfterFiling(adminApp, {
      caseId,
      actor: isOps(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid }
    });

    // filing_submitted 단계에서 "다음 단계 진행" 태스크 동기화 (자동 완료되지 않은 경우)
    if (!auto.advanced) {
      const wfSnap = await workflowRef(adminApp, caseId).get();
      const stage = String(wfSnap.exists ? (wfSnap.data() as any).stage : "");
      if (stage === "filing_submitted") {
        const packId = String(c.casePackId ?? "");
        const ns = nextStage(packId, "filing_submitted");
        if (ns) {
          const prereq = await validateStagePrerequisites(adminApp, { caseId, casePackId: packId, stage: "filing_submitted" as any });
          if (prereq.ok) {
            await ensureTask(adminApp, {
              caseId,
              taskId: "advance_filing_submitted",
              partnerId: String(c.partnerId),
              titleKo: `다음 단계 진행: filing_submitted → ${ns}`,
              type: "advance_stage"
            });
          } else {
            await setTaskStatus(adminApp, { caseId, taskId: "advance_filing_submitted", status: "done" });
          }
        }
      }
    }
    return ok(res, result);
  });
}
