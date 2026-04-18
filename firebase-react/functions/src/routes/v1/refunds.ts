import type express from "express";
import type * as admin from "firebase-admin";
import crypto from "node:crypto";

import { requireAuth, requireOps, roleOf } from "../../lib/auth";
import { fail, ok } from "../../lib/http";
import { withIdempotency } from "../../lib/idempotency";
import { caseRef } from "../../lib/firestore";
import { writeTimelineEvent } from "../../lib/timeline";
import { createApproval, approvalRef } from "../../lib/approvals";

function refundRef(adminApp: typeof admin, caseId: string, refundId: string) {
  return adminApp.firestore().doc(`cases/${caseId}/refunds/${refundId}`);
}

export function registerRefundRoutes(app: express.Express, adminApp: typeof admin) {
  // 케이스 환불 목록(참여자)
  app.get("/v1/cases/:caseId/refunds", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const cs = await caseRef(adminApp, caseId).get();
    if (!cs.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cs.data() as any;
    if (c.ownerUid !== auth.uid && !requireOps(auth)) return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    const snap = await adminApp.firestore().collection(`cases/${caseId}/refunds`).orderBy("updatedAt", "desc").limit(50).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  // 환불 요청(승인게이트 생성)
  app.post("/v1/cases/:caseId/refunds/request", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const { paymentId, amount, reasonKo } = req.body ?? {};
    if (!paymentId || !amount?.amount) return fail(res, 400, "INVALID_ARGUMENT", "paymentId/amount가 필요합니다.");

    const snap = await caseRef(adminApp, caseId).get();
    if (!snap.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = snap.data() as any;
    if (c.ownerUid !== auth.uid && !requireOps(auth)) return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    const result = await withIdempotency(adminApp, req, res, "refunds.request", async () => {
      const refundId = crypto.randomUUID();
      const approvalId = crypto.randomUUID();
      const now = adminApp.firestore.FieldValue.serverTimestamp();

      await refundRef(adminApp, caseId, refundId).set({
        caseId,
        ownerUid: c.ownerUid,
        partnerId: c.partnerId,
        paymentId: String(paymentId),
        amount: { amount: Number(amount.amount), currency: amount.currency ?? "KRW" },
        reasonKo: String(reasonKo ?? ""),
        status: "requested",
        approvalId,
        createdByUid: auth.uid,
        createdAt: now,
        updatedAt: now
      });

      await createApproval(adminApp, approvalId, {
        gate: "refund_approve",
        status: "pending",
        target: { type: "refund", caseId, refundId },
        requiredRole: "ops_approver",
        summaryKo: `환불 승인 요청: ${Number(amount.amount)}${amount.currency ?? "KRW"}`,
        payloadHash: null,
        createdBy: { uid: auth.uid, role: roleOf(auth) }
      });

      const eventId = crypto.randomUUID();
      await writeTimelineEvent(adminApp, caseId, eventId, {
        type: "REFUND_REQUESTED",
        occurredAt: now,
        actor: { type: "user", uid: auth.uid },
        summaryKo: "환불이 요청되었습니다.",
        meta: { refundId, approvalId, amount: { amount: Number(amount.amount), currency: amount.currency ?? "KRW" } }
      });

      // 프로덕 패턴: 승인 필요를 412로 반환 (클라가 approvalId를 들고 ops 승인 대기)
      return { refundId, approvalId, gate: "refund_approve", requiredRole: "ops_approver" };
    });

    if (!result) return;
    return fail(res, 412, "APPROVAL_REQUIRED", "승인 대기 중입니다.", result);
  });

  // 환불 집행(승인 완료 후)
  app.post("/v1/cases/:caseId/refunds/:refundId/execute", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    if (!requireOps(auth)) return fail(res, 403, "FORBIDDEN", "집행 권한이 없습니다.");

    const caseId = req.params.caseId;
    const refundId = req.params.refundId;
    const { approvalId } = req.body ?? {};
    if (!approvalId) return fail(res, 400, "INVALID_ARGUMENT", "approvalId가 필요합니다.");

    const result = await withIdempotency(adminApp, req, res, "refunds.execute", async () => {
      const apprSnap = await approvalRef(adminApp, String(approvalId)).get();
      if (!apprSnap.exists) throw new Error("APPROVAL_NOT_FOUND");
      const appr = apprSnap.data() as any;
      if (appr.gate !== "refund_approve") throw new Error("INVALID_APPROVAL_GATE");
      if (appr.status !== "approved") throw new Error("APPROVAL_REQUIRED");

      const ref = refundRef(adminApp, caseId, refundId);
      const snap = await ref.get();
      if (!snap.exists) throw new Error("REFUND_NOT_FOUND");
      const r = snap.data() as any;

      const now = adminApp.firestore.FieldValue.serverTimestamp();
      await ref.set(
        {
          status: "executed",
          executedAt: now,
          updatedAt: now
        },
        { merge: true }
      );

      const eventId = crypto.randomUUID();
      await writeTimelineEvent(adminApp, caseId, eventId, {
        type: "REFUND_EXECUTED",
        occurredAt: now,
        actor: { type: "ops", uid: auth.uid },
        summaryKo: "환불이 집행되었습니다.",
        meta: { refundId, amount: r.amount, approvalId }
      });

      return { refundId, status: "executed" };
    }).catch((e: any) => {
      const msg = String(e?.message || e);
      if (msg === "APPROVAL_REQUIRED") {
        fail(res, 412, "APPROVAL_REQUIRED", "승인 대기 중입니다.", { approvalId });
        return null;
      }
      if (msg === "REFUND_NOT_FOUND") {
        fail(res, 404, "NOT_FOUND", "환불을 찾을 수 없습니다.");
        return null;
      }
      if (msg === "APPROVAL_NOT_FOUND") {
        fail(res, 404, "NOT_FOUND", "승인 요청을 찾을 수 없습니다.");
        return null;
      }
      if (msg === "INVALID_APPROVAL_GATE") {
        fail(res, 400, "INVALID_ARGUMENT", "approvalId가 환불 승인 게이트가 아닙니다.");
        return null;
      }
      fail(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
      return null;
    });

    if (!result) return;
    return ok(res, result);
  });
}
