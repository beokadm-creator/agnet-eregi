"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTaskRoutes = registerTaskRoutes;
const node_crypto_1 = __importDefault(require("node:crypto"));
const auth_1 = require("../../lib/auth");
const http_1 = require("../../lib/http");
const firestore_1 = require("../../lib/firestore");
const idempotency_1 = require("../../lib/idempotency");
const timeline_1 = require("../../lib/timeline");
function registerTaskRoutes(app, adminApp) {
    // 케이스 태스크 목록(참여자)
    app.get("/v1/cases/:caseId/tasks", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const caseId = req.params.caseId;
        const cs = await (0, firestore_1.caseRef)(adminApp, caseId).get();
        if (!cs.exists)
            return (0, http_1.fail)(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
        const c = cs.data();
        const canRead = (0, auth_1.isOps)(auth) || c.ownerUid === auth.uid || ((0, auth_1.partnerIdOf)(auth) && c.partnerId === (0, auth_1.partnerIdOf)(auth));
        if (!canRead)
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
        const snap = await adminApp.firestore().collection(`cases/${caseId}/tasks`).orderBy("updatedAt", "desc").limit(100).get();
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return (0, http_1.ok)(res, { items });
    });
    // Partner: 업무 큐 (collectionGroup)
    app.get("/v1/partner/tasks", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const pid = (0, auth_1.partnerIdOf)(auth);
        if (!pid)
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "파트너 계정이 아닙니다.");
        const status = String(req.query.status || "open");
        let q = adminApp.firestore().collectionGroup("tasks").where("partnerId", "==", pid).where("status", "==", status);
        q = q.orderBy("updatedAt", "desc").limit(50);
        const snap = await q.get();
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return (0, http_1.ok)(res, { items });
    });
    // Ops: 전체 업무 큐(옵션)
    app.get("/v1/ops/tasks", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        if (!(0, auth_1.isOps)(auth))
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "운영자 권한이 없습니다.");
        const status = String(req.query.status || "open");
        let q = adminApp.firestore().collectionGroup("tasks").where("status", "==", status);
        q = q.orderBy("updatedAt", "desc").limit(100);
        const snap = await q.get();
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return (0, http_1.ok)(res, { items });
    });
    // 태스크 완료(파트너/ops)
    app.post("/v1/cases/:caseId/tasks/:taskId/complete", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const caseId = req.params.caseId;
        const taskId = req.params.taskId;
        const cs = await (0, firestore_1.caseRef)(adminApp, caseId).get();
        if (!cs.exists)
            return (0, http_1.fail)(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
        const c = cs.data();
        const canWrite = (0, auth_1.isOps)(auth) || ((0, auth_1.partnerIdOf)(auth) && c.partnerId === (0, auth_1.partnerIdOf)(auth));
        if (!canWrite)
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "권한이 없습니다.");
        const result = await (0, idempotency_1.withIdempotency)(adminApp, req, res, "tasks.complete", async () => {
            const ref = adminApp.firestore().doc(`cases/${caseId}/tasks/${taskId}`);
            const snap = await ref.get();
            if (!snap.exists)
                throw new Error("NOT_FOUND_TASK");
            const now = adminApp.firestore.FieldValue.serverTimestamp();
            await ref.set({ status: "done", doneAt: now, updatedAt: now }, { merge: true });
            const eventId = node_crypto_1.default.randomUUID();
            await (0, timeline_1.writeTimelineEvent)(adminApp, caseId, eventId, {
                type: "TASK_COMPLETED",
                occurredAt: now,
                actor: (0, auth_1.isOps)(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
                summaryKo: "업무가 완료되었습니다.",
                meta: { taskId }
            });
            return { taskId, status: "done" };
        }).catch((e) => {
            if (String(e?.message) === "NOT_FOUND_TASK") {
                (0, http_1.fail)(res, 404, "NOT_FOUND", "태스크를 찾을 수 없습니다.");
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
//# sourceMappingURL=tasks.js.map