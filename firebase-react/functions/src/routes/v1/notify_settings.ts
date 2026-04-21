import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, partnerIdOf } from "../../lib/auth";
import { fail, ok, logError } from "../../lib/http";

export function registerNotificationSettingsRoutes(app: express.Application, adminApp: typeof admin) {

  // Partner Settings
  app.get("/v1/partner/notification-settings", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const db = adminApp.firestore();
      const snap = await db.collection("partner_notification_settings").doc(partnerId).get();
      
      const defaultSettings = {
        webhooks: [],
        events: { packageReady: false, closingReportReady: false, caseCompleted: false }
      };

      if (!snap.exists) {
        return ok(res, { settings: defaultSettings });
      }

      return ok(res, { settings: snap.data() });
    } catch (err: any) {
      logError({ endpoint: "partner/notification-settings/get", code: "INTERNAL", messageKo: "알림 설정 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  app.put("/v1/partner/notification-settings", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const { webhooks, events } = req.body;
      const db = adminApp.firestore();
      
      const settings = {
        partnerId,
        webhooks: webhooks || [],
        events: events || { packageReady: false, closingReportReady: false, caseCompleted: false },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("partner_notification_settings").doc(partnerId).set(settings);

      return ok(res, { settings });
    } catch (err: any) {
      logError({ endpoint: "partner/notification-settings/put", code: "INTERNAL", messageKo: "알림 설정 업데이트 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // User Settings
  app.get("/v1/user/notification-settings", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      const userId = auth.uid;

      const db = adminApp.firestore();
      const snap = await db.collection("user_notification_settings").doc(userId).get();
      
      const defaultSettings = {
        webhooks: [],
        events: { submissionCompleted: false, submissionFailed: false }
      };

      if (!snap.exists) {
        return ok(res, { settings: defaultSettings });
      }

      return ok(res, { settings: snap.data() });
    } catch (err: any) {
      logError({ endpoint: "user/notification-settings/get", code: "INTERNAL", messageKo: "알림 설정 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  app.put("/v1/user/notification-settings", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      const userId = auth.uid;

      const { webhooks, events } = req.body;
      const db = adminApp.firestore();
      
      const settings = {
        userId,
        webhooks: webhooks || [],
        events: events || { submissionCompleted: false, submissionFailed: false },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("user_notification_settings").doc(userId).set(settings);

      return ok(res, { settings });
    } catch (err: any) {
      logError({ endpoint: "user/notification-settings/put", code: "INTERNAL", messageKo: "알림 설정 업데이트 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

}