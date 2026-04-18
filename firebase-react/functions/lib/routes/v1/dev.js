"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDevRoutes = registerDevRoutes;
const auth_1 = require("../../lib/auth");
const http_1 = require("../../lib/http");
function isDevAllowed() {
    // 보안: dev endpoint는 **에뮬레이터에서만** 허용
    // (실수로 운영 배포되는 사고를 원천 차단)
    return process.env.FUNCTIONS_EMULATOR === "true";
}
function registerDevRoutes(app, adminApp) {
    app.post("/v1/dev/set-claims", async (req, res) => {
        if (!isDevAllowed())
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "dev endpoint는 비활성화 상태입니다.");
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const { uid, claims } = req.body ?? {};
        const targetUid = String(uid || auth.uid);
        if (!claims || typeof claims !== "object")
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "claims가 필요합니다.");
        await adminApp.auth().setCustomUserClaims(targetUid, claims);
        return (0, http_1.ok)(res, { uid: targetUid, claims, callerRole: (0, auth_1.roleOf)(auth) ?? null });
    });
    app.get("/v1/dev/whoami", async (req, res) => {
        if (!isDevAllowed())
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "dev endpoint는 비활성화 상태입니다.");
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        return (0, http_1.ok)(res, { uid: auth.uid, role: auth.role ?? null, partnerId: auth.partnerId ?? null });
    });
}
//# sourceMappingURL=dev.js.map