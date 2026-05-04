import { Express } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { requireOpsRole } from "../../lib/ops_rbac";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerOpsPartnerApplicationRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  app.get("/v1/ops/partner-applications", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", "partner_applications");
      if (!hasRole) return;

      const status = req.query.status ? String(req.query.status) : "";
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));

      let query: admin.firestore.Query = db.collection("partner_applications").orderBy("createdAt", "desc");
      if (status) query = query.where("status", "==", status);

      const snap = await query.limit(limit).get();
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "GET /v1/ops/partner-applications", code: "INTERNAL", messageKo: "파트너 신청 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", "파트너 신청 목록 조회에 실패했습니다.");
    }
  });

  app.post("/v1/ops/partner-applications/:uid/approve", async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin", "partner_applications");
      if (!hasRole) return;

      const targetUid = String(req.params.uid);
      const { partnerName, reason } = req.body || {};
      if (!targetUid) {
        return fail(res, 400, "INVALID_ARGUMENT", "uid가 필요합니다.", { requestId });
      }

      const appRef = db.collection("partner_applications").doc(targetUid);
      const appSnap = await appRef.get();
      if (!appSnap.exists) {
        return fail(res, 404, "NOT_FOUND", "파트너 신청을 찾을 수 없습니다.", { requestId });
      }
      const appData = appSnap.data() as any;
      if (String(appData.status || "") === "approved") {
        return ok(res, { uid: targetUid, status: "approved", partnerId: appData.partnerId || null }, requestId);
      }
      if (String(appData.status || "") !== "pending") {
        return fail(res, 409, "FAILED_PRECONDITION", "대기 상태의 신청만 승인할 수 있습니다.", { requestId });
      }

      const partnerRef = db.collection("partners").doc();
      const finalPartnerName = partnerName ? String(partnerName) : String(appData.bizName || "파트너");

      await partnerRef.set({
        id: partnerRef.id,
        name: finalPartnerName,
        bizName: String(appData.bizName || finalPartnerName),
        bizRegNo: String(appData.bizRegNo || ""),
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedBy: auth.uid,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      const user = await adminApp.auth().getUser(targetUid);
      const currentClaims = user.customClaims || {};
      await adminApp.auth().setCustomUserClaims(targetUid, {
        ...currentClaims,
        partnerId: partnerRef.id,
        partnerRole: "owner",
      });

      // Create partner_team_members entry so the approved owner can manage their team
      await db.collection("partner_team_members").doc(`${partnerRef.id}_${targetUid}`).set({
        partnerId: partnerRef.id,
        userId: targetUid,
        email: user.email || "",
        role: "owner",
        status: "active",
        invitedBy: auth.uid,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await appRef.update({
        status: "approved",
        partnerId: partnerRef.id,
        approvedBy: auth.uid,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvalReason: reason ? String(reason) : "",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logOpsEvent(adminApp, {
        gateKey: "partner_applications",
        action: "ops.partner_applications.approve",
        status: "success",
        actorUid: auth.uid,
        requestId,
        summary: `파트너 신청 승인: ${targetUid} -> ${partnerRef.id}`,
        target: {
          targetUid,
          partnerId: partnerRef.id,
          email: user.email || null,
          reason: reason ? String(reason) : "",
        }
      });

      return ok(res, { uid: targetUid, status: "approved", partnerId: partnerRef.id }, requestId);
    } catch (err: any) {
      logError({ endpoint: "POST /v1/ops/partner-applications/:uid/approve", code: "INTERNAL", messageKo: "파트너 신청 승인 실패", err });
      return fail(res, 500, "INTERNAL", "파트너 신청 승인에 실패했습니다.", { requestId });
    }
  });

  app.post("/v1/ops/partner-applications/:uid/reject", async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_operator", "partner_applications");
      if (!hasRole) return;

      const targetUid = String(req.params.uid);
      const { reason } = req.body || {};
      if (!targetUid) {
        return fail(res, 400, "INVALID_ARGUMENT", "uid가 필요합니다.", { requestId });
      }

      const appRef = db.collection("partner_applications").doc(targetUid);
      const appSnap = await appRef.get();
      if (!appSnap.exists) {
        return fail(res, 404, "NOT_FOUND", "파트너 신청을 찾을 수 없습니다.", { requestId });
      }
      const appData = appSnap.data() as any;
      if (String(appData.status || "") === "approved") {
        return fail(res, 409, "FAILED_PRECONDITION", "이미 승인된 신청은 거부할 수 없습니다.", { requestId });
      }

      await appRef.update({
        status: "rejected",
        rejectedBy: auth.uid,
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
        rejectReason: reason ? String(reason) : "",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logOpsEvent(adminApp, {
        gateKey: "partner_applications",
        action: "ops.partner_applications.reject",
        status: "success",
        actorUid: auth.uid,
        requestId,
        summary: `파트너 신청 거부: ${targetUid}`,
        target: {
          targetUid,
          reason: reason ? String(reason) : "",
        }
      });

      return ok(res, { uid: targetUid, status: "rejected" }, requestId);
    } catch (err: any) {
      logError({ endpoint: "POST /v1/ops/partner-applications/:uid/reject", code: "INTERNAL", messageKo: "파트너 신청 거부 실패", err });
      return fail(res, 500, "INTERNAL", "파트너 신청 거부에 실패했습니다.", { requestId });
    }
  });
}

