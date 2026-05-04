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
  if (process.env.OPS_ADMIN_UID && auth.uid === process.env.OPS_ADMIN_UID) return "ops_admin";
  if (process.env.OPS_ADMIN_EMAIL && auth.email && String(auth.email).toLowerCase() === process.env.OPS_ADMIN_EMAIL.toLowerCase()) return "ops_admin";
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
      requestId: req.requestId || "unknown",
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
