import * as admin from "firebase-admin";
import * as crypto from "crypto";

import { logOpsEvent } from "./ops_audit";

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
    const job = doc.data();
    const jobId = doc.id;

    try {
      await doc.ref.update({ status: "sending", updatedAt: admin.firestore.FieldValue.serverTimestamp() });

      const webhookConfig = job.payload.webhookConfig;
      if (!webhookConfig || !webhookConfig.url) {
        throw new Error("Webhook URL이 없습니다.");
      }

      const body = JSON.stringify({
        event: job.event,
        target: job.target,
        payload: job.payload,
        timestamp: new Date().toISOString()
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (webhookConfig.secret) {
        // 실제 운영에선 HMAC-SHA256을 쓰지만, 프롬프트 지시에 따라 sha256 hex 사용하거나 createHmac 사용
        const hmac = crypto.createHmac("sha256", webhookConfig.secret).update(body).digest("hex");
        headers["X-Signature"] = `sha256=${hmac}`;
      }

      const res = await fetch(webhookConfig.url, {
        method: "POST",
        headers,
        body
      });

      if (!res.ok) {
        throw new Error(`Webhook failed with status ${res.status}`);
      }

      await doc.ref.update({
        status: "sent",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await logOpsEvent(adminApp, {
        gateKey: "system",
        action: "ops_notification.sent",
        status: "success",
        actorUid: "system",
        requestId: `notify_${jobId}`,
        summary: `Notification sent for event ${job.event}`,
        target: { jobId, url: webhookConfig.url }
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

        await logOpsEvent(adminApp, {
          gateKey: "system",
          action: "ops_notification.failed",
          status: "fail",
          actorUid: "system",
          requestId: `notify_${jobId}`,
          summary: `Notification failed permanently for event ${job.event}`,
          error: { message: error.message }
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
