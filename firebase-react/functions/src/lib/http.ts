import * as express from "express";

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "INVALID_ARGUMENT"
  | "FAILED_PRECONDITION"
  | "CONFLICT"
  | "ALREADY_EXISTS"
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
  err?: unknown;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err || "");
}

function errorStack(err: unknown): string {
  if (err instanceof Error) return err.stack || "";
  return "";
}

export function logError(payload: ErrorLogPayload): void;
export function logError(
  endpoint: string,
  caseId: string,
  code: ApiErrorCode,
  messageKo: string,
  err?: unknown,
  requestId?: string
): void;
export function logError(
  payloadOrEndpoint: ErrorLogPayload | string,
  caseId?: string,
  code?: ApiErrorCode,
  messageKo?: string,
  err?: unknown,
  requestId?: string
) {
  const payload: ErrorLogPayload & { requestId?: string } =
    typeof payloadOrEndpoint === "string"
      ? {
          endpoint: payloadOrEndpoint,
          caseId,
          code: code || "INTERNAL",
          messageKo: messageKo || "요청 처리 중 오류가 발생했습니다.",
          err,
          requestId,
        }
      : payloadOrEndpoint;

  const logObj = {
    severity: "ERROR",
    endpoint: payload.endpoint,
    caseId: payload.caseId || "N/A",
    evidenceId: payload.evidenceId || "N/A",
    code: payload.code,
    messageKo: payload.messageKo,
    requestId: payload.requestId || "N/A",
    errMessage: errorMessage(payload.err),
    errStack: errorStack(payload.err)
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

export function ok(res: express.Response, data: unknown, requestId?: string) {
  return res.status(200).json({ 
    ok: true, 
    data,
    requestId: requestId || (res.req as any).requestId
  });
}

export function fail(
  res: express.Response,
  status: number,
  code: ApiErrorCode,
  messageKo: string,
  details?: unknown
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
