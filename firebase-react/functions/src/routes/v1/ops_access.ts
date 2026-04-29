import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerOpsAccessRoutes(app: express.Application, adminApp: typeof admin) {

  // 1) GET /v1/ops/access/users
  // 권한 있는 사용자 목록 조회 (간단히 customClaims에 opsRole 있는 사용자)
  app.get("/v1/ops/access/users", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer");
      if (!hasRole) return;

      const listUsersResult = await adminApp.auth().listUsers(1000);
      const opsUsers = listUsersResult.users.filter(u => u.customClaims?.opsRole);

      const users = opsUsers.map(u => ({
        uid: u.uid,
        email: u.email,
        opsRole: u.customClaims?.opsRole,
        breakGlassExpiresAt: u.customClaims?.breakGlassExpiresAt
      }));

      return ok(res, { users });
    } catch (err: any) {
      logError({ endpoint: "ops/access/users", code: "INTERNAL", messageKo: "사용자 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 2) POST /v1/ops/access/grant
  app.post("/v1/ops/access/grant", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const { targetUid, role, reason } = req.body;
      if (!targetUid || !role || !reason) {
        return fail(res, 400, "INVALID_ARGUMENT", "targetUid, role, reason은 필수입니다.");
      }

      if (!["ops_viewer", "ops_operator", "ops_admin"].includes(role)) {
        return fail(res, 400, "INVALID_ARGUMENT", "올바르지 않은 role 입니다.");
      }

      const user = await adminApp.auth().getUser(targetUid);
      const currentClaims = user.customClaims || {};

      await adminApp.auth().setCustomUserClaims(targetUid, {
        ...currentClaims,
        opsRole: role
      });

      await logOpsEvent(adminApp, {
        gateKey: "system",
        action: "ops_access.grant",
        status: "success",
        actorUid: auth.uid,
        requestId: (req as any).requestId,
        summary: `사용자 ${user.email}(${targetUid})에게 ${role} 권한 부여`,
        target: { targetUid, role, reason }
      });

      return ok(res, { message: "권한 부여 성공" });
    } catch (err: any) {
      logError({ endpoint: "ops/access/grant", code: "INTERNAL", messageKo: "권한 부여 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 3) POST /v1/ops/access/revoke
  app.post("/v1/ops/access/revoke", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const { targetUid, reason } = req.body;
      if (!targetUid || !reason) {
        return fail(res, 400, "INVALID_ARGUMENT", "targetUid, reason은 필수입니다.");
      }

      const user = await adminApp.auth().getUser(targetUid);
      const currentClaims = user.customClaims || {};
      
      const newClaims = { ...currentClaims };
      delete newClaims.opsRole;
      delete newClaims.breakGlassExpiresAt;

      await adminApp.auth().setCustomUserClaims(targetUid, newClaims);

      await logOpsEvent(adminApp, {
        gateKey: "system",
        action: "ops_access.revoke",
        status: "success",
        actorUid: auth.uid,
        requestId: (req as any).requestId,
        summary: `사용자 ${user.email}(${targetUid})의 권한 회수`,
        target: { targetUid, reason }
      });

      return ok(res, { message: "권한 회수 성공" });
    } catch (err: any) {
      logError({ endpoint: "ops/access/revoke", code: "INTERNAL", messageKo: "권한 회수 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 4) POST /v1/ops/access/breakglass
  app.post("/v1/ops/access/breakglass", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      // breakglass는 operator 이상이 자신에게 임시 admin을 부여할 때 주로 씀
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_operator");
      if (!hasRole) return;

      const { reason } = req.body;
      if (!reason) {
        return fail(res, 400, "INVALID_ARGUMENT", "reason은 필수입니다.");
      }

      const user = await adminApp.auth().getUser(auth.uid);
      const currentClaims = user.customClaims || {};

      // 30분 후 만료
      const expiresAt = Date.now() + 30 * 60 * 1000;

      await adminApp.auth().setCustomUserClaims(auth.uid, {
        ...currentClaims,
        opsRole: "ops_admin",
        breakGlassExpiresAt: expiresAt
      });

      await logOpsEvent(adminApp, {
        gateKey: "system",
        action: "ops_access.breakglass",
        status: "success",
        actorUid: auth.uid,
        requestId: (req as any).requestId,
        summary: `Break-glass 활성화 (30분 임시 ops_admin)`,
        target: { reason, expiresAt }
      });

      return ok(res, { message: "Break-glass 활성화 성공. 재로그인/토큰갱신이 필요합니다." });
    } catch (err: any) {
      logError({ endpoint: "ops/access/breakglass", code: "INTERNAL", messageKo: "Break-glass 활성화 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  app.post("/v1/ops/access/partner/grant", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const { targetUid, partnerId, partnerRole, approvePartner, reason } = req.body || {};
      if (!targetUid || !partnerId || !partnerRole || !reason) {
        return fail(res, 400, "INVALID_ARGUMENT", "targetUid, partnerId, partnerRole, reason은 필수입니다.");
      }

      if (!["owner", "admin", "editor", "viewer"].includes(String(partnerRole))) {
        return fail(res, 400, "INVALID_ARGUMENT", "올바르지 않은 partnerRole 입니다.");
      }

      const user = await adminApp.auth().getUser(String(targetUid));
      const currentClaims = user.customClaims || {};

      await adminApp.auth().setCustomUserClaims(String(targetUid), {
        ...currentClaims,
        partnerId: String(partnerId),
        partnerRole: String(partnerRole),
      });

      // Ensure partner_team_members is consistent with claims
      const db = adminApp.firestore();
      const memberDocId = `${String(partnerId)}_${String(targetUid)}`;
      const memberRef = db.collection("partner_team_members").doc(memberDocId);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists) {
        await memberRef.set({
          partnerId: String(partnerId),
          userId: String(targetUid),
          email: user.email || "",
          role: String(partnerRole),
          status: "active",
          invitedBy: auth.uid,
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await memberRef.update({
          role: String(partnerRole),
          status: "active",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (approvePartner === true) {
        await db.collection("partners").doc(String(partnerId)).set({
          status: "active",
          approvedBy: auth.uid,
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      await logOpsEvent(adminApp, {
        gateKey: "system",
        action: "ops_access.partner.grant",
        status: "success",
        actorUid: auth.uid,
        requestId: (req as any).requestId,
        summary: `사용자 ${user.email}(${targetUid})에게 partnerId=${partnerId}, partnerRole=${partnerRole} 부여`,
        target: { targetUid, partnerId, partnerRole, approvePartner: approvePartner === true, reason }
      });

      return ok(res, { message: "파트너 권한 부여 성공" });
    } catch (err: any) {
      logError({ endpoint: "ops/access/partner/grant", code: "INTERNAL", messageKo: "파트너 권한 부여 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  app.post("/v1/ops/access/partner/revoke", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const { targetUid, reason } = req.body || {};
      if (!targetUid || !reason) {
        return fail(res, 400, "INVALID_ARGUMENT", "targetUid, reason은 필수입니다.");
      }

      const user = await adminApp.auth().getUser(String(targetUid));
      const currentClaims = user.customClaims || {};
      const newClaims = { ...currentClaims };
      delete (newClaims as any).partnerId;
      delete (newClaims as any).partnerRole;

      await adminApp.auth().setCustomUserClaims(String(targetUid), newClaims);

      // Suspend team membership if it exists
      const existingPartnerId = (currentClaims as any).partnerId;
      if (existingPartnerId) {
        const memberDocId = `${String(existingPartnerId)}_${String(targetUid)}`;
        const memberRef = adminApp.firestore().collection("partner_team_members").doc(memberDocId);
        const memberSnap = await memberRef.get();
        if (memberSnap.exists) {
          await memberRef.update({
            status: "suspended",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      await logOpsEvent(adminApp, {
        gateKey: "system",
        action: "ops_access.partner.revoke",
        status: "success",
        actorUid: auth.uid,
        requestId: (req as any).requestId,
        summary: `사용자 ${user.email}(${targetUid})의 partnerId/partnerRole 회수`,
        target: { targetUid, reason }
      });

      return ok(res, { message: "파트너 권한 회수 성공" });
    } catch (err: any) {
      logError({ endpoint: "ops/access/partner/revoke", code: "INTERNAL", messageKo: "파트너 권한 회수 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

}
