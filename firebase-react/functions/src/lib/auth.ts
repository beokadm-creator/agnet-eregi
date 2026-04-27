import * as admin from "firebase-admin";
import * as express from "express";
import { fail } from "./http";

async function verifyAppCheckToken(
  adminApp: typeof admin,
  req: express.Request,
  res: express.Response
): Promise<boolean> {
  if (process.env.ENFORCE_APP_CHECK !== "1") return true;

  const appCheckToken = req.header("X-Firebase-AppCheck");
  if (!appCheckToken) {
    fail(res, 401, "UNAUTHENTICATED", "App Check 토큰이 필요합니다.");
    return false;
  }

  try {
    await adminApp.appCheck().verifyToken(appCheckToken);
    return true;
  } catch (err: any) {
    console.error("[requireAuth] App Check verification failed:", err);
    fail(res, 401, "UNAUTHENTICATED", "유효하지 않은 App Check 토큰입니다.");
    return false;
  }
}

async function verifyAuthToken(
  adminApp: typeof admin,
  req: express.Request,
  res: express.Response
): Promise<admin.auth.DecodedIdToken | null> {
  const appCheckValid = await verifyAppCheckToken(adminApp, req, res);
  if (!appCheckValid) return null;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    fail(res, 401, "UNAUTHENTICATED", "인증 토큰이 필요합니다.");
    return null;
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = await adminApp.auth().verifyIdToken(token);
    return decoded;
  } catch (err: any) {
    console.error("[requireAuth] Token verification failed:", err);
    fail(res, 401, "UNAUTHENTICATED", "유효하지 않은 인증 토큰입니다.");
    return null;
  }
}

function attachUser(req: express.Request, decoded: admin.auth.DecodedIdToken): void {
  (req as any).user = {
    ...decoded,
    uid: decoded.uid,
    isOps: isOps(decoded),
    partnerId: partnerIdOf(decoded),
  };
}

export function requireAuth(
  adminApp: typeof admin,
  req: express.Request,
  res: express.Response
): Promise<admin.auth.DecodedIdToken | null>;
export function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void>;
export async function requireAuth(
  first: typeof admin | express.Request,
  second: express.Request | express.Response,
  third: express.Response | express.NextFunction
): Promise<admin.auth.DecodedIdToken | null | void> {
  if (typeof (first as typeof admin).auth === "function") {
    const decoded = await verifyAuthToken(first as typeof admin, second as express.Request, third as express.Response);
    if (decoded) attachUser(second as express.Request, decoded);
    return decoded;
  }

  const req = first as express.Request;
  const res = second as express.Response;
  const next = third as express.NextFunction;
  const decoded = await verifyAuthToken(admin, req, res);
  if (!decoded) return;
  attachUser(req, decoded);
  next();
}

export const isOps = (auth: admin.auth.DecodedIdToken): boolean => {
  if (process.env.OPS_ALLOW_ALL === "1") return true;
  const opsRoles = ["ops_admin", "ops_operator", "ops_viewer"];
  if (auth.opsRole && opsRoles.includes(String(auth.opsRole))) return true;
  return false;
};

export const partnerIdOf = (auth: admin.auth.DecodedIdToken): string | null => {
  return auth.partnerId ? String(auth.partnerId) : null;
};
