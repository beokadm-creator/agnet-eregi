"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPayablesRoutes = registerPayablesRoutes;
const auth_1 = require("../../lib/auth");
const http_1 = require("../../lib/http");
function payablesSummaryRef(adminApp, partnerId) {
    return adminApp.firestore().doc(`partners/${partnerId}/payables/summary`);
}
function registerPayablesRoutes(app, adminApp) {
    // Partner: 현재 이월/지급 관련 요약
    app.get("/v1/partner/payables/summary", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const pid = (0, auth_1.partnerIdOf)(auth);
        if (!pid)
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "파트너 계정이 아닙니다.");
        const snap = await payablesSummaryRef(adminApp, pid).get();
        return (0, http_1.ok)(res, { exists: snap.exists, summary: snap.exists ? { id: snap.id, ...snap.data() } : null });
    });
    // Ops: 파트너 이월 요약 조회
    app.get("/v1/ops/partners/:partnerId/payables/summary", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        if (!(0, auth_1.requireOps)(auth))
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "운영자 권한이 없습니다.");
        const pid = req.params.partnerId;
        const snap = await payablesSummaryRef(adminApp, pid).get();
        return (0, http_1.ok)(res, { exists: snap.exists, summary: snap.exists ? { id: snap.id, ...snap.data() } : null });
    });
}
//# sourceMappingURL=payables.js.map