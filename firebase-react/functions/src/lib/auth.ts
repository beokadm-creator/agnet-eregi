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
    console.error("[requireAuth] App Check verification failed:", err instanceof Error ? err.message : String(err));
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
    const checkRevoked = process.env.AUTH_CHECK_REVOKED === "1";
    return await adminApp.auth().verifyIdToken(token, checkRevoked);
  } catch (err: any) {
    console.error("[requireAuth] Token verification failed:", err instanceof Error ? err.message : String(err));
    fail(res, 401, "UNAUTHENTICATED", "유효하지 않은 인증 토큰입니다.");
    return null;
  }
}

function attachUser(req: express.Request, decoded: admin.auth.DecodedIdToken): void {
  let partnerId = partnerIdOf(decoded);

  // ops_admin can specify X-Partner-Id header to act as any partner
  if (isOpsAdmin(decoded) && !partnerId) {
    const headerPartnerId = req.header("X-Partner-Id");
    if (headerPartnerId) {
      partnerId = headerPartnerId;
    }
  }

  req.user = {
    ...decoded,
    uid: decoded.uid,
    isOps: isOps(decoded),
    partnerId,
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
  if (process.env.OPS_ADMIN_UID && auth.uid === process.env.OPS_ADMIN_UID) return true;
  if (process.env.OPS_ADMIN_EMAIL && auth.email && String(auth.email).toLowerCase() === process.env.OPS_ADMIN_EMAIL.toLowerCase()) return true;
  const opsRoles = ["ops_admin", "ops_operator", "ops_viewer"];
  if (auth.opsRole && opsRoles.includes(String(auth.opsRole))) return true;
  return false;
};

export const isOpsAdmin = (auth: admin.auth.DecodedIdToken): boolean => {
  return String(auth.opsRole) === "ops_admin";
};

export const partnerIdOf = (auth: admin.auth.DecodedIdToken): string | null => {
  return auth.partnerId ? String(auth.partnerId) : null;
};
