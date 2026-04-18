"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logError = logError;
exports.requestIdMiddleware = requestIdMiddleware;
exports.ok = ok;
exports.fail = fail;
function logError(payload) {
    const logObj = {
        severity: "ERROR",
        endpoint: payload.endpoint,
        caseId: payload.caseId || "N/A",
        evidenceId: payload.evidenceId || "N/A",
        code: payload.code,
        messageKo: payload.messageKo,
        errMessage: payload.err?.message || String(payload.err || ""),
        errStack: payload.err?.stack || ""
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
    const req = res.req;
    const requestId = res.getHeader("X-Request-Id") || req?.requestId || req?.headers?.["x-request-id"] || req?.body?._requestId || "N/A";
    return res.status(status).json({
        ok: false,
        error: {
            code,
            messageKo,
            requestId,
            details: details ?? {}
        }
    });
}
//# sourceMappingURL=http.js.map