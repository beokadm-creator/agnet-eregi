import * as admin from "firebase-admin";
import * as express from "express";
import { fail } from "./http";
import { logOpsEvent } from "./ops_audit";

export type OpsRole = "ops_viewer" | "ops_operator" | "ops_admin";

const ROLE_HIERARCHY: Record<OpsRole, number> = {
  "ops_viewer": 1,
  "ops_operator": 2,
  "ops_admin": 3
};

export const getOpsRole = (auth: admin.auth.DecodedIdToken): OpsRole | null => {
  if (process.env.OPS_ALLOW_ALL === "1") return "ops_admin";
  if (auth.uid === "sOhR3HDAitbyX2izUyge61W3gQr2") return "ops_admin";
  if (auth.email && String(auth.email).toLowerCase() === "aaron@beosolution.com") return "ops_admin";
  const role = auth.opsRole as string;
  if (role === "ops_viewer" || role === "ops_operator" || role === "ops_admin") {
    return role as OpsRole;
  }
  return null;
};

export const hasOpsRole = (auth: admin.auth.DecodedIdToken, requiredRole: OpsRole): boolean => {
  const currentRole = getOpsRole(auth);
  if (!currentRole) return false;
  return ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[requiredRole];
};

export const requireOpsRole = async (
  adminApp: typeof admin,
  req: express.Request,
  res: express.Response,
  auth: admin.auth.DecodedIdToken,
  requiredRole: OpsRole,
  gateKey?: string
): Promise<boolean> => {
  if (!hasOpsRole(auth, requiredRole)) {
    const currentRole = getOpsRole(auth) || "none";
    
    await logOpsEvent(adminApp, {
      gateKey: gateKey || "unknown",
      action: "ops_auth.denied",
      status: "fail",
      actorUid: auth.uid,
      requestId: (req as any).requestId || "unknown",
      summary: `Ops access denied: requires ${requiredRole}, got ${currentRole}`,
      target: {
        endpoint: req.originalUrl,
        method: req.method,
        requiredRole,
        actorRole: currentRole
      }
    });

    fail(res, 403, "FORBIDDEN", `권한이 부족합니다. (필요: ${requiredRole})`);
    return false;
  }
  return true;
};
