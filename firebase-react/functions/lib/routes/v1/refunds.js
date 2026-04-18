"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRefundRoutes = registerRefundRoutes;
const node_crypto_1 = __importDefault(require("node:crypto"));
const auth_1 = require("../../lib/auth");
const http_1 = require("../../lib/http");
const idempotency_1 = require("../../lib/idempotency");
const firestore_1 = require("../../lib/firestore");
const timeline_1 = require("../../lib/timeline");
const approvals_1 = require("../../lib/approvals");
function refundRef(adminApp, caseId, refundId) {
    return adminApp.firestore().doc(`cases/${caseId}/refunds/${refundId}`);
}
function registerRefundRoutes(app, adminApp) {
    // 케이스 환불 목록(참여자)
    app.get("/v1/cases/:caseId/refunds", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const caseId = req.params.caseId;
        const cs = await (0, firestore_1.caseRef)(adminApp, caseId).get();
        if (!cs.exists)
            return (0, http_1.fail)(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
        const c = cs.data();
        if (c.ownerUid !== auth.uid && !(0, auth_1.requireOps)(auth))
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
        const snap = await adminApp.firestore().collection(`cases/${caseId}/refunds`).orderBy("updatedAt", "desc").limit(50).get();
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return (0, http_1.ok)(res, { items });
    });
    // 환불 요청(승인게이트 생성)
    app.post("/v1/cases/:caseId/refunds/request", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const caseId = req.params.caseId;
        const { paymentId, amount, reasonKo } = req.body ?? {};
        if (!paymentId || !amount?.amount)
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "paymentId/amount가 필요합니다.");
        const snap = await (0, firestore_1.caseRef)(adminApp, caseId).get();
        if (!snap.exists)
            return (0, http_1.fail)(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
        const c = snap.data();
        if (c.ownerUid !== auth.uid && !(0, auth_1.requireOps)(auth))
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
        const result = await (0, idempotency_1.withIdempotency)(adminApp, req, res, "refunds.request", async () => {
            const refundId = node_crypto_1.default.randomUUID();
            const approvalId = node_crypto_1.default.randomUUID();
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
            await (0, approvals_1.createApproval)(adminApp, approvalId, {
                gate: "refund_approve",
                status: "pending",
                target: { type: "refund", caseId, refundId },
                requiredRole: "ops_approver",
                summaryKo: `환불 승인 요청: ${Number(amount.amount)}${amount.currency ?? "KRW"}`,
                payloadHash: null,
                createdBy: { uid: auth.uid, role: (0, auth_1.roleOf)(auth) }
            });
            const eventId = node_crypto_1.default.randomUUID();
            await (0, timeline_1.writeTimelineEvent)(adminApp, caseId, eventId, {
                type: "REFUND_REQUESTED",
                occurredAt: now,
                actor: { type: "user", uid: auth.uid },
                summaryKo: "환불이 요청되었습니다.",
                meta: { refundId, approvalId, amount: { amount: Number(amount.amount), currency: amount.currency ?? "KRW" } }
            });
            // 프로덕 패턴: 승인 필요를 412로 반환 (클라가 approvalId를 들고 ops 승인 대기)
            return { refundId, approvalId, gate: "refund_approve", requiredRole: "ops_approver" };
        });
        if (!result)
            return;
        return (0, http_1.fail)(res, 412, "APPROVAL_REQUIRED", "승인 대기 중입니다.", result);
    });
    // 환불 집행(승인 완료 후)
    app.post("/v1/cases/:caseId/refunds/:refundId/execute", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        if (!(0, auth_1.requireOps)(auth))
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "집행 권한이 없습니다.");
        const caseId = req.params.caseId;
        const refundId = req.params.refundId;
        const { approvalId } = req.body ?? {};
        if (!approvalId)
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "approvalId가 필요합니다.");
        const result = await (0, idempotency_1.withIdempotency)(adminApp, req, res, "refunds.execute", async () => {
            const apprSnap = await (0, approvals_1.approvalRef)(adminApp, String(approvalId)).get();
            if (!apprSnap.exists)
                throw new Error("APPROVAL_NOT_FOUND");
            const appr = apprSnap.data();
            if (appr.gate !== "refund_approve")
                throw new Error("INVALID_APPROVAL_GATE");
            if (appr.status !== "approved")
                throw new Error("APPROVAL_REQUIRED");
            const ref = refundRef(adminApp, caseId, refundId);
            const snap = await ref.get();
            if (!snap.exists)
                throw new Error("REFUND_NOT_FOUND");
            const r = snap.data();
            const now = adminApp.firestore.FieldValue.serverTimestamp();
            await ref.set({
                status: "executed",
                executedAt: now,
                updatedAt: now
            }, { merge: true });
            const eventId = node_crypto_1.default.randomUUID();
            await (0, timeline_1.writeTimelineEvent)(adminApp, caseId, eventId, {
                type: "REFUND_EXECUTED",
                occurredAt: now,
                actor: { type: "ops", uid: auth.uid },
                summaryKo: "환불이 집행되었습니다.",
                meta: { refundId, amount: r.amount, approvalId }
            });
            return { refundId, status: "executed" };
        }).catch((e) => {
            const msg = String(e?.message || e);
            if (msg === "APPROVAL_REQUIRED") {
                (0, http_1.fail)(res, 412, "APPROVAL_REQUIRED", "승인 대기 중입니다.", { approvalId });
                return null;
            }
            if (msg === "REFUND_NOT_FOUND") {
                (0, http_1.fail)(res, 404, "NOT_FOUND", "환불을 찾을 수 없습니다.");
                return null;
            }
            if (msg === "APPROVAL_NOT_FOUND") {
                (0, http_1.fail)(res, 404, "NOT_FOUND", "승인 요청을 찾을 수 없습니다.");
                return null;
            }
            if (msg === "INVALID_APPROVAL_GATE") {
                (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "approvalId가 환불 승인 게이트가 아닙니다.");
                return null;
            }
            (0, http_1.fail)(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
            return null;
        });
        if (!result)
            return;
        return (0, http_1.ok)(res, result);
    });
}
//# sourceMappingURL=refunds.js.map