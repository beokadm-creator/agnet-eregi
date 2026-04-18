"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.roleOf = roleOf;
exports.partnerIdOf = partnerIdOf;
exports.isOps = isOps;
exports.isPartner = isPartner;
exports.isLegalPractitioner = isLegalPractitioner;
exports.isApprover = isApprover;
exports.requireOps = requireOps;
exports.requireApprover = requireApprover;
const http_1 = require("./http");
async function requireAuth(adminApp, req, res) {
    const header = req.header("Authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    if (!token) {
        (0, http_1.fail)(res, 401, "UNAUTHENTICATED", "로그인이 필요합니다.");
        return null;
    }
    try {
        const decoded = (await adminApp.auth().verifyIdToken(token));
        req.auth = decoded;
        return decoded;
    }
    catch {
        (0, http_1.fail)(res, 401, "UNAUTHENTICATED", "토큰이 유효하지 않습니다.");
        return null;
    }
}
function roleOf(auth) {
    return auth?.role;
}
function partnerIdOf(auth) {
    return auth?.partnerId;
}
function isOps(auth) {
    const r = roleOf(auth);
    return r === "ops_agent" || r === "ops_approver" || r === "system";
}
function isPartner(auth) {
    const r = roleOf(auth);
    return !!partnerIdOf(auth) && (r === "partner" || r === "legal_practitioner" || r === "legal_staff" || r === "system");
}
function isLegalPractitioner(auth) {
    return !!partnerIdOf(auth) && roleOf(auth) === "legal_practitioner";
}
function isApprover(auth) {
    const r = roleOf(auth);
    return r === "ops_approver" || r === "system";
}
function requireOps(auth) {
    return isOps(auth);
}
function requireApprover(auth) {
    return isApprover(auth);
}
//# sourceMappingURL=auth.js.map