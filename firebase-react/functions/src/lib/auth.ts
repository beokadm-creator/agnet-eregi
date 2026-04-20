import * as admin from "firebase-admin";
import * as express from "express";
import { fail } from "./http";

export const requireAuth = async (
  adminApp: typeof admin,
  req: express.Request,
  res: express.Response
): Promise<admin.auth.DecodedIdToken | null> => {
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
};

export const isOps = (auth: admin.auth.DecodedIdToken): boolean => {
  if (process.env.OPS_ALLOW_ALL === "1") return true;
  const opsRoles = ["ops_admin", "ops_operator", "ops_viewer"];
  if (auth.opsRole && opsRoles.includes(String(auth.opsRole))) return true;
  return false;
};

export const partnerIdOf = (auth: admin.auth.DecodedIdToken): string | null => {
  return auth.partnerId ? String(auth.partnerId) : null;
};
