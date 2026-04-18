import type express from "express";
import type * as admin from "firebase-admin";

import { fail } from "./http";

// NOTE: partner 조직 내 역할을 세분화하기 위해 partner 계열 role을 확장한다.
export type Role =
  | "user"
  | "partner"
  | "legal_practitioner" // 등록 법무사(최종 판단/제출)
  | "legal_staff" // 법무사 사무원(준비/검토 지원)
  | "ops_agent"
  | "ops_approver"
  | "system";

export type AuthContext = admin.auth.DecodedIdToken & {
  role?: Role;
  partnerId?: string;
};

export async function requireAuth(
  adminApp: typeof admin,
  req: express.Request,
  res: express.Response
): Promise<AuthContext | null> {
  const header = req.header("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    fail(res, 401, "UNAUTHENTICATED", "로그인이 필요합니다.");
    return null;
  }
  try {
    const decoded = (await adminApp.auth().verifyIdToken(token)) as AuthContext;
    (req as any).auth = decoded;
    return decoded;
  } catch {
    fail(res, 401, "UNAUTHENTICATED", "토큰이 유효하지 않습니다.");
    return null;
  }
}

export function roleOf(auth: AuthContext | null | undefined): Role | undefined {
  return auth?.role;
}

export function partnerIdOf(auth: AuthContext | null | undefined): string | undefined {
  return auth?.partnerId;
}

export function isOps(auth: AuthContext | null | undefined) {
  const r = roleOf(auth);
  return r === "ops_agent" || r === "ops_approver" || r === "system";
}

export function isPartner(auth: AuthContext | null | undefined) {
  const r = roleOf(auth);
  return !!partnerIdOf(auth) && (r === "partner" || r === "legal_practitioner" || r === "legal_staff" || r === "system");
}

export function isLegalPractitioner(auth: AuthContext | null | undefined) {
  return !!partnerIdOf(auth) && roleOf(auth) === "legal_practitioner";
}

export function isApprover(auth: AuthContext | null | undefined) {
  const r = roleOf(auth);
  return r === "ops_approver" || r === "system";
}

export function requireOps(auth: AuthContext | null | undefined) {
  return isOps(auth);
}

export function requireApprover(auth: AuthContext | null | undefined) {
  return isApprover(auth);
}
