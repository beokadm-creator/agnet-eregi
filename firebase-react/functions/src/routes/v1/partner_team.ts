import * as express from "express";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

import { requireAuth, partnerIdOf } from "../../lib/auth";
import { fail, ok, logError } from "../../lib/http";
import { PartnerTeamMember, PartnerTeamInvitation, PartnerRole } from "../../lib/partner_team_models";

export function registerPartnerTeamRoutes(app: express.Application, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 헬퍼 함수: 요청자의 팀 관리 권한(owner 또는 admin) 확인
  const verifyAdminRole = async (partnerId: string, uid: string): Promise<boolean> => {
    const snap = await db.collection("partner_team_members")
      .where("partnerId", "==", partnerId)
      .where("userId", "==", uid)
      .where("status", "==", "active")
      .limit(1)
      .get();
    if (snap.empty) return false;
    const member = snap.docs[0].data() as PartnerTeamMember;
    return member.role === "owner" || member.role === "admin";
  };

  // 1. GET /v1/partner/team/members - 팀원 목록 조회
  app.get("/v1/partner/team/members", async (req: express.Request, res: express.Response) => {
    const requestId = (req as any).requestId || "req-unknown";
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });

      const snap = await db.collection("partner_team_members")
        .where("partnerId", "==", partnerId)
        .where("status", "==", "active")
        .get();

      const members = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return ok(res, { members }, requestId);
    } catch (err: any) {
      logError({ endpoint: "GET /v1/partner/team/members", code: "INTERNAL", messageKo: "팀원 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message, { requestId });
    }
  });

  // 2. POST /v1/partner/team/invitations - 팀원 초대 (SaaS Seat 검증 포함)
  app.post("/v1/partner/team/invitations", async (req: express.Request, res: express.Response) => {
    const requestId = (req as any).requestId || "req-unknown";
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });

      const isAdmin = await verifyAdminRole(partnerId, auth.uid);
      if (!isAdmin) return fail(res, 403, "FORBIDDEN", "팀원을 초대할 권한(admin)이 없습니다.", { requestId });

      const { email, role } = req.body;
      if (!email || !role) return fail(res, 400, "INVALID_ARGUMENT", "email과 role 파라미터가 필요합니다.", { requestId });

      // 2-1. SaaS 구독 Seat Limit 검증 (EP-07-03 연동)
      // 실제 구현에서는 partner_subscriptions 컬렉션에서 maxTeamMembers 메타데이터를 가져와 검증합니다.
      // 여기서는 임시로 Pro 플랜인 경우 5명 제한, 그 외 1명(본인) 제한으로 시뮬레이션 합니다.
      const subSnap = await db.collection("partner_subscriptions")
        .where("partnerId", "==", partnerId)
        .where("status", "==", "active")
        .limit(1)
        .get();

      let maxSeats = 1;
      if (!subSnap.empty) {
        const subData = subSnap.docs[0].data();
        if (subData.planId === "plan_pro_monthly") maxSeats = 5;
        if (subData.planId === "plan_enterprise") maxSeats = 999;
      }

      const activeMembers = await db.collection("partner_team_members")
        .where("partnerId", "==", partnerId)
        .where("status", "==", "active")
        .count().get();
      
      const pendingInvites = await db.collection("partner_team_invitations")
        .where("partnerId", "==", partnerId)
        .where("status", "==", "pending")
        .count().get();

      if (activeMembers.data().count + pendingInvites.data().count >= maxSeats) {
        return fail(res, 400, "FAILED_PRECONDITION", `구독 플랜의 팀원 한도(${maxSeats}명)를 초과했습니다. 플랜을 업그레이드해주세요.`, { requestId });
      }

      // 2-2. 중복 초대/가입 검증
      const existingMember = await db.collection("partner_team_members")
        .where("partnerId", "==", partnerId).where("email", "==", email).where("status", "==", "active").limit(1).get();
      if (!existingMember.empty) return fail(res, 400, "ALREADY_EXISTS", "이미 소속된 팀원입니다.", { requestId });

      const existingInvite = await db.collection("partner_team_invitations")
        .where("partnerId", "==", partnerId).where("email", "==", email).where("status", "==", "pending").limit(1).get();
      if (!existingInvite.empty) return fail(res, 400, "ALREADY_EXISTS", "이미 대기 중인 초대가 존재합니다.", { requestId });

      // 2-3. 초대장 생성
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const inviteRef = db.collection("partner_team_invitations").doc();
      const invite: PartnerTeamInvitation = {
        partnerId,
        email,
        role: role as PartnerRole,
        token,
        status: "pending",
        invitedBy: auth.uid,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      await inviteRef.set(invite);
      return ok(res, { invite: { id: inviteRef.id, ...invite } }, requestId);
    } catch (err: any) {
      logError({ endpoint: "POST /v1/partner/team/invitations", code: "INTERNAL", messageKo: "팀원 초대 실패", err });
      return fail(res, 500, "INTERNAL", err.message, { requestId });
    }
  });

  // 3. POST /v1/user/invitations/:token/accept - [유저] 초대 수락 및 Custom Claims 갱신
  app.post("/v1/user/invitations/:token/accept", async (req: express.Request, res: express.Response) => {
    const requestId = (req as any).requestId || "req-unknown";
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const token = req.params.token;
      
      const inviteSnap = await db.collection("partner_team_invitations")
        .where("token", "==", token)
        .where("status", "==", "pending")
        .limit(1)
        .get();

      if (inviteSnap.empty) {
        return fail(res, 404, "NOT_FOUND", "유효하지 않거나 이미 만료된 초대장입니다.", { requestId });
      }

      const inviteDoc = inviteSnap.docs[0];
      const invite = inviteDoc.data() as PartnerTeamInvitation;

      if (invite.expiresAt.toDate() < new Date()) {
        await inviteDoc.ref.update({ status: "expired" });
        return fail(res, 400, "FAILED_PRECONDITION", "초대장이 만료되었습니다.", { requestId });
      }

      if (auth.email !== invite.email) {
        return fail(res, 403, "FORBIDDEN", "초대받은 이메일 계정으로 로그인해야 수락할 수 있습니다.", { requestId });
      }

      // 트랜잭션으로 상태 업데이트 및 멤버 생성
      await db.runTransaction(async (t) => {
        const memberRef = db.collection("partner_team_members").doc(`${invite.partnerId}_${auth.uid}`);
        const memberDoc = await t.get(memberRef);
        if (memberDoc.exists && memberDoc.data()?.status === "active") {
          throw new Error("ALREADY_EXISTS");
        }

        t.update(inviteDoc.ref, { status: "accepted", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        
        const newMember: PartnerTeamMember = {
          partnerId: invite.partnerId,
          userId: auth.uid,
          email: auth.email!,
          role: invite.role,
          status: "active",
          invitedBy: invite.invitedBy,
          joinedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
          updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
        };
        t.set(memberRef, newMember);
      });

      // Firebase Auth Custom Claims 업데이트 (권한 부여)
      await adminApp.auth().setCustomUserClaims(auth.uid, {
        partnerId: invite.partnerId,
        partnerRole: invite.role
      });

      return ok(res, { message: "초대를 수락하고 파트너 팀에 합류했습니다. (다시 로그인해야 권한이 완전히 적용될 수 있습니다.)" }, requestId);
    } catch (err: any) {
      if (err.message === "ALREADY_EXISTS") {
        return fail(res, 400, "ALREADY_EXISTS", "이미 해당 파트너의 팀원입니다.", { requestId });
      }
      logError({ endpoint: "POST /v1/user/invitations/:token/accept", code: "INTERNAL", messageKo: "초대 수락 실패", err });
      return fail(res, 500, "INTERNAL", err.message, { requestId });
    }
  });

  // 4. DELETE /v1/partner/team/members/:userId - 멤버 추방 및 권한 박탈
  app.delete("/v1/partner/team/members/:userId", async (req: express.Request, res: express.Response) => {
    const requestId = (req as any).requestId || "req-unknown";
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });

      const targetUserId = String(req.params.userId);
      
      if (auth.uid !== targetUserId) {
        const isAdmin = await verifyAdminRole(partnerId, auth.uid);
        if (!isAdmin) return fail(res, 403, "FORBIDDEN", "팀원을 내보낼 권한이 없습니다.", { requestId });
      }

      const memberRef = db.collection("partner_team_members").doc(`${partnerId}_${targetUserId}`);
      const memberDoc = await memberRef.get();
      if (!memberDoc.exists || memberDoc.data()?.status !== "active") {
        return fail(res, 404, "NOT_FOUND", "활성 상태의 팀원을 찾을 수 없습니다.", { requestId });
      }

      if (memberDoc.data()?.role === "owner") {
        const ownersCount = await db.collection("partner_team_members")
          .where("partnerId", "==", partnerId).where("role", "==", "owner").where("status", "==", "active").count().get();
        if (ownersCount.data().count <= 1) {
          return fail(res, 400, "FAILED_PRECONDITION", "유일한 소유자(owner)는 탈퇴할 수 없습니다.", { requestId });
        }
      }

      // Soft delete
      await memberRef.update({
        status: "suspended",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Firebase Auth Custom Claims에서 파트너 권한 박탈
      const targetUserRecord = await adminApp.auth().getUser(targetUserId);
      const claims = targetUserRecord.customClaims || {};
      if (claims.partnerId === partnerId) {
        delete claims.partnerId;
        delete claims.partnerRole;
        await adminApp.auth().setCustomUserClaims(targetUserId, claims);
      }

      return ok(res, { message: "멤버가 성공적으로 팀에서 제외되었습니다." }, requestId);
    } catch (err: any) {
      logError({ endpoint: "DELETE /v1/partner/team/members/:userId", code: "INTERNAL", messageKo: "멤버 삭제 실패", err });
      return fail(res, 500, "INTERNAL", err.message, { requestId });
    }
  });
}
