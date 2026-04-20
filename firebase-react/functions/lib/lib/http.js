"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logError = logError;
exports.requestIdMiddleware = requestIdMiddleware;
exports.ok = ok;
exports.fail = fail;
function logError(payload) {
    var _a, _b;
    const logObj = {
        severity: "ERROR",
        endpoint: payload.endpoint,
        caseId: payload.caseId || "N/A",
        evidenceId: payload.evidenceId || "N/A",
        code: payload.code,
        messageKo: payload.messageKo,
        errMessage: ((_a = payload.err) === null || _a === void 0 ? void 0 : _a.message) || String(payload.err || ""),
        errStack: ((_b = payload.err) === null || _b === void 0 ? void 0 : _b.stack) || ""
    };
    console.error(JSON.stringify(logObj));
}
function requestIdMiddleware(req, res, next) {
    const requestId = req.header("X-Request-Id") || `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
}
function ok(res, data) {
    return res.status(200).json({ ok: true, data });
}
function fail(res, status, code, messageKo, details) {
    var _a, _b;
    const req = res.req;
    const requestId = res.getHeader("X-Request-Id") || (req === null || req === void 0 ? void 0 : req.requestId) || ((_a = req === null || req === void 0 ? void 0 : req.headers) === null || _a === void 0 ? void 0 : _a["x-request-id"]) || ((_b = req === null || req === void 0 ? void 0 : req.body) === null || _b === void 0 ? void 0 : _b._requestId) || "unknown";
    return res.status(status).json({
        ok: false,
        error: {
            code,
            messageKo,
            requestId,
            details: details !== null && details !== void 0 ? details : {}
        }
    });
}
//# sourceMappingURL=http.js.map