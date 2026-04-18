"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerApprovalRoutes = registerApprovalRoutes;
const node_crypto_1 = __importDefault(require("node:crypto"));
const auth_1 = require("../../lib/auth");
const http_1 = require("../../lib/http");
const idempotency_1 = require("../../lib/idempotency");
const approvals_1 = require("../../lib/approvals");
const timeline_1 = require("../../lib/timeline");
function quoteRef(adminApp, caseId, quoteId) {
    return adminApp.firestore().doc(`cases/${caseId}/quotes/${quoteId}`);
}
function registerApprovalRoutes(app, adminApp) {
    // ops: approvals list
    app.get("/v1/ops/approvals", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        if (!(0, auth_1.requireOps)(auth))
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "운영자 권한이 없습니다.");
        const status = String(req.query.status || "pending");
        const gate = req.query.gate ? String(req.query.gate) : null;
        let q = adminApp.firestore().collection("approvals").where("status", "==", status);
        if (gate)
            q = q.where("gate", "==", gate);
        q = q.orderBy("createdAt", "asc").limit(50);
        const snap = await q.get();
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return (0, http_1.ok)(res, { items });
    });
    // ops_approver: decision + post-actions
    app.post("/v1/ops/approvals/:approvalId/decision", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        if (!(0, auth_1.requireApprover)(auth))
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "승인 권한이 없습니다.");
        const approvalId = req.params.approvalId;
        const { decision, reasonKo } = req.body ?? {};
        if (decision !== "approve" && decision !== "reject")
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "decision이 필요합니다.");
        const result = await (0, idempotency_1.withIdempotency)(adminApp, req, res, "approvals.decision", async () => {
            const ref = (0, approvals_1.approvalRef)(adminApp, approvalId);
            const snap = await ref.get();
            if (!snap.exists)
                throw new Error("NOT_FOUND");
            const a = snap.data();
            await (0, approvals_1.decideApproval)(adminApp, approvalId, decision === "approve" ? "approve" : "reject", { uid: auth.uid, role: (0, auth_1.roleOf)(auth) }, reasonKo);
            // 케이스 타임라인 이벤트
            const target = a.target;
            if (target?.caseId) {
                const now = adminApp.firestore.FieldValue.serverTimestamp();
                const eventId = node_crypto_1.default.randomUUID();
                await (0, timeline_1.writeTimelineEvent)(adminApp, target.caseId, eventId, {
                    type: decision === "approve" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
                    occurredAt: now,
                    actor: { type: "ops", uid: auth.uid },
                    summaryKo: decision === "approve" ? "승인되었습니다." : "반려되었습니다.",
                    meta: { approvalId, gate: a.gate, target: a.target, reasonKo: reasonKo ?? null }
                });
            }
            // post-action: quote finalize 자동 반영(승인 시)
            if (decision === "approve" && a.gate === "quote_finalize") {
                const t = a.target;
                if (t?.caseId && t?.quoteId) {
                    const now = adminApp.firestore.FieldValue.serverTimestamp();
                    await quoteRef(adminApp, t.caseId, t.quoteId).set({ status: "finalized", finalizedAt: now, updatedAt: now }, { merge: true });
                    const eventId = node_crypto_1.default.randomUUID();
                    await (0, timeline_1.writeTimelineEvent)(adminApp, t.caseId, eventId, {
                        type: "QUOTE_FINALIZED",
                        occurredAt: now,
                        actor: { type: "ops", uid: auth.uid },
                        summaryKo: "견적이 확정되었습니다.",
                        meta: { quoteId: t.quoteId, approvalId }
                    });
                }
            }
            return { status: decision === "approve" ? "approved" : "rejected" };
        }).catch((e) => {
            if (String(e?.message) === "NOT_FOUND") {
                (0, http_1.fail)(res, 404, "NOT_FOUND", "승인 요청을 찾을 수 없습니다.");
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
//# sourceMappingURL=approvals.js.map