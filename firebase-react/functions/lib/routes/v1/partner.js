"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPartnerRoutes = registerPartnerRoutes;
const auth_1 = require("../../lib/auth");
const http_1 = require("../../lib/http");
function registerPartnerRoutes(app, adminApp) {
    // Partner: 케이스 큐(리스트)
    app.get("/v1/partner/cases", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const pid = (0, auth_1.partnerIdOf)(auth);
        if (!pid)
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "파트너 계정이 아닙니다.");
        const statusesRaw = req.query.statuses ? String(req.query.statuses) : "new,in_progress,waiting_partner,waiting_user";
        const statuses = statusesRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
        let q = adminApp.firestore().collection("cases").where("partnerId", "==", pid);
        // Firestore in query는 최대 10개
        q = q.where("status", "in", statuses);
        q = q.orderBy("updatedAt", "desc").limit(50);
        const snap = await q.get();
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return (0, http_1.ok)(res, { items });
    });
    // Partner: 문서 검토 큐(컬렉션 그룹)
    app.get("/v1/partner/documents", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const pid = (0, auth_1.partnerIdOf)(auth);
        if (!pid)
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "파트너 계정이 아닙니다.");
        const statusesRaw = req.query.statuses ? String(req.query.statuses) : "uploaded";
        const statuses = statusesRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
        let q = adminApp.firestore().collectionGroup("documents").where("partnerId", "==", pid);
        q = q.where("status", "in", statuses);
        q = q.orderBy("updatedAt", "desc").limit(50);
        const snap = await q.get();
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return (0, http_1.ok)(res, { items });
    });
}
//# sourceMappingURL=partner.js.map