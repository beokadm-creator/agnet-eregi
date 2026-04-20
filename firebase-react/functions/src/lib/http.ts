import * as express from "express";

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_ARGUMENT"
  | "FAILED_PRECONDITION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "APPROVAL_REQUIRED"
  | "INTERNAL"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "BAD_REQUEST"
  | "NOT_IMPLEMENTED";

export interface ErrorLogPayload {
  endpoint: string;
  caseId?: string;
  evidenceId?: string;
  code: ApiErrorCode;
  messageKo: string;
  err?: any;
}

export function logError(payload: ErrorLogPayload) {
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

export function requestIdMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const requestId =
    req.header("X-Request-Id") || `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  (req as any).requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

export function ok(res: express.Response, data: any) {
  return res.status(200).json({ 
    ok: true, 
    data,
    requestId: (res.req as any).requestId
  });
}

export function fail(
  res: express.Response,
  status: number,
  code: ApiErrorCode,
  messageKo: string,
  details?: any
) {
  const req = res.req as any;
  const requestId = res.getHeader("X-Request-Id") || req?.requestId || req?.headers?.["x-request-id"] || req?.body?._requestId || "unknown";
  return res.status(status).json({
    ok: false,
    error: {
      code,
      messageKo,
      requestId,
      details: details ?? {}
    },
    requestId: (res.req as any).requestId
  });
}
