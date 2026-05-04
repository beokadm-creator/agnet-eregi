import * as admin from "firebase-admin";
import { logOpsEvent } from "./ops_audit";
import { NotificationJob } from "./notify_models";
import { NotificationProviderFactory } from "./providers/notification_provider";
import { WebhookProvider } from "./providers/webhook_provider";
import { SlackProvider } from "./providers/slack_provider";
import { KakaoProvider } from "./providers/kakao_provider";
import { SmsProvider } from "./providers/sms_provider";
import { ExpoProvider } from "./providers/expo_provider";

// 시스템 시작 시 Provider 초기 등록
NotificationProviderFactory.register("webhook", new WebhookProvider());
NotificationProviderFactory.register("slack", new SlackProvider());
NotificationProviderFactory.register("kakao", new KakaoProvider());
NotificationProviderFactory.register("sms", new SmsProvider());
NotificationProviderFactory.register("expo", new ExpoProvider());

export async function processNotificationJobs(adminApp: typeof admin) {
  const db = adminApp.firestore();
  const now = admin.firestore.Timestamp.now();

  const snap = await db.collection("notification_jobs")
    .where("status", "==", "queued")
    .where("nextRunAt", "<=", now)
    .limit(10)
    .get();

  if (snap.empty) return;

  for (const doc of snap.docs) {
    const job = doc.data() as NotificationJob;
    const jobId = doc.id;

    try {
      await doc.ref.update({ 
        status: "sending", 
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      });

      // 팩토리를 통해 적절한 Provider 가져오기
      const provider = NotificationProviderFactory.getProvider(job.channel || "webhook");
      
      // Provider를 통한 실제 전송 처리
      await provider.send(job);

      await doc.ref.update({
        status: "sent",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await logOpsEvent(db, "ops_notification.sent", "SUCCESS", "system", `notify_${jobId}`, "system", {
        jobId, channel: job.channel 
      });

    } catch (error: any) {
      console.error(`[NotificationWorker] Job ${jobId} failed:`, error);
      
      const attempts = (job.attempts || 0) + 1;
      const maxAttempts = 5;

      if (attempts >= maxAttempts) {
        await doc.ref.update({
          status: "failed",
          lastError: error.message || String(error),
          attempts,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await logOpsEvent(db, "ops_notification.failed", "FAIL", "system", `notify_${jobId}`, "system", {
          error: error.message 
        });
      } else {
        // Backoff: 1m, 5m, 15m, 60m
        const backoffMinutes = [1, 5, 15, 60][attempts - 1] || 60;
        const nextRunAt = admin.firestore.Timestamp.fromMillis(Date.now() + backoffMinutes * 60 * 1000);

        await doc.ref.update({
          status: "queued",
          lastError: error.message || String(error),
          attempts,
          nextRunAt,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  }
}
