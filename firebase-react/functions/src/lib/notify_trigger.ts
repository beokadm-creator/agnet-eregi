import * as admin from "firebase-admin";
import { NotificationEvent } from "./notify_models";

export async function enqueueNotification(
  adminApp: typeof admin,
  target: { userId?: string; partnerId?: string },
  event: NotificationEvent,
  payload: any
) {
  const db = adminApp.firestore();

  // 설정 확인 (Partner)
  if (target.partnerId) {
    const pSnap = await db.collection("partner_notification_settings").doc(target.partnerId).get();
    if (pSnap.exists) {
      const settings = pSnap.data();
      const events = settings?.events || {};
      
      let shouldSend = false;
      if (event === "package.ready" && events.packageReady) shouldSend = true;
      if (event === "closing_report.ready" && events.closingReportReady) shouldSend = true;
      if (event === "case.completed" && events.caseCompleted) shouldSend = true;

      if (shouldSend && settings?.webhooks && Array.isArray(settings.webhooks)) {
        for (const webhook of settings.webhooks) {
          if (webhook.enabled && webhook.url) {
            await db.collection("notification_jobs").add({
              type: "webhook",
              target: { partnerId: target.partnerId },
              event,
              payload: { ...payload, webhookConfig: webhook }, // 임시로 webhook 설정을 페이로드에 저장하거나 참조
              status: "queued",
              attempts: 0,
              nextRunAt: admin.firestore.FieldValue.serverTimestamp(),
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }
    }
  }

  // 설정 확인 (User)
  if (target.userId) {
    const uSnap = await db.collection("user_notification_settings").doc(target.userId).get();
    if (uSnap.exists) {
      const settings = uSnap.data();
      const events = settings?.events || {};

      let shouldSend = false;
      if (event === "submission.completed" && events.submissionCompleted) shouldSend = true;
      if (event === "submission.failed" && events.submissionFailed) shouldSend = true;

      if (shouldSend && settings?.webhooks && Array.isArray(settings.webhooks)) {
        for (const webhook of settings.webhooks) {
          if (webhook.enabled && webhook.url) {
            await db.collection("notification_jobs").add({
              type: "webhook",
              target: { userId: target.userId },
              event,
              payload: { ...payload, webhookConfig: webhook },
              status: "queued",
              attempts: 0,
              nextRunAt: admin.firestore.FieldValue.serverTimestamp(),
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }
    }
  }
}
