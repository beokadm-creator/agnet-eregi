import * as admin from "firebase-admin";
import { NotificationEvent, NotificationJob, PartnerNotificationSettings, UserNotificationSettings } from "./notify_models";
import { getNotificationTemplate } from "./templates/notification_template";
import { createMagicLink } from "./auth_magic_link";

export async function enqueueNotification(
  adminApp: typeof admin,
  target: { userId?: string; partnerId?: string },
  event: NotificationEvent,
  payload: any
) {
  const db = adminApp.firestore();
  const jobs: Partial<NotificationJob>[] = [];
  
  // [EP-10-03] 워크스페이스 즉시 진입을 위한 Magic Link 생성
  const targetUid = target.userId || target.partnerId;
  let magicLink = "";
  if (targetUid) {
    magicLink = await createMagicLink(adminApp, targetUid, target.userId ? "/submissions" : "/partner/cases");
  }

  const enrichedPayload = { ...payload, magicLink };
  const template = getNotificationTemplate(event, enrichedPayload);
  enrichedPayload._template = template;

  // 채널별 Job 생성 헬퍼
  const processChannels = (channels: any, targetData: any, fallbackWebhooks?: any[]) => {
    const webhookConfigs = channels?.webhook || fallbackWebhooks;
    
    if (webhookConfigs && Array.isArray(webhookConfigs)) {
      for (const webhook of webhookConfigs) {
        if (webhook.enabled && webhook.url) {
          jobs.push({
            channel: "webhook",
            target: { ...targetData, address: webhook.url },
            event,
            payload: enrichedPayload,
            config: webhook,
            status: "queued",
            attempts: 0
          });
        }
      }
    }
    const slackConfigs = channels?.slack;
    if (slackConfigs && Array.isArray(slackConfigs)) {
      for (const slack of slackConfigs) {
        if (slack.enabled && slack.url) {
          jobs.push({
            channel: "slack",
            target: { ...targetData, address: slack.url },
            event,
            payload: enrichedPayload,
            config: slack,
            status: "queued",
            attempts: 0
          });
        }
      }
    }
    
    // [EP-10-01] SMS 채널 연동
    const smsConfigs = channels?.sms;
    if (smsConfigs && Array.isArray(smsConfigs)) {
      for (const sms of smsConfigs) {
        if (sms.enabled && sms.phoneNumber) {
          jobs.push({
            channel: "sms",
            target: { ...targetData, address: sms.phoneNumber },
            event,
            payload: enrichedPayload,
            config: sms,
            status: "queued",
            attempts: 0
          });
        }
      }
    }

    // [EP-10-01] Kakao 채널 연동
    const kakaoConfigs = channels?.kakao;
    if (kakaoConfigs && Array.isArray(kakaoConfigs)) {
      for (const kakao of kakaoConfigs) {
        if (kakao.enabled && kakao.phoneNumber) {
          jobs.push({
            channel: "kakao",
            target: { ...targetData, address: kakao.phoneNumber },
            event,
            payload: enrichedPayload,
            config: kakao,
            status: "queued",
            attempts: 0
          });
        }
      }
    }
  };

  if (target.partnerId) {
    const pSnap = await db.collection("partner_notification_settings").doc(target.partnerId).get();
    if (pSnap.exists) {
      const settings = pSnap.data() as PartnerNotificationSettings;
      const events = settings?.events || {};
      
      let shouldSend = false;
      if (event === "package.ready" && events.packageReady) shouldSend = true;
      if (event === "closing_report.ready" && events.closingReportReady) shouldSend = true;
      if (event === "case.completed" && events.caseCompleted) shouldSend = true;
      if (event === "evidence.fulfilled" && events.evidenceFulfilled !== false) shouldSend = true; 

      if (shouldSend) {
        processChannels(settings.channels, { partnerId: target.partnerId }, settings.webhooks);
      }
    }
  }

  if (target.userId) {
    const uSnap = await db.collection("user_notification_settings").doc(target.userId).get();
    if (uSnap.exists) {
      const settings = uSnap.data() as UserNotificationSettings;
      const events = settings?.events || {};

      let shouldSend = false;
      if (event === "submission.completed" && events.submissionCompleted) shouldSend = true;
      if (event === "submission.failed" && events.submissionFailed) shouldSend = true;
      if (event === "evidence.requested" && events.evidenceRequested !== false) shouldSend = true;
      if (event === "funnel.dropoff" || event === "submission.dropoff") shouldSend = true; // 강제 발송 (마케팅 동의 확인은 별도 로직 필요)
      if (event === "b2g.action_required" || event === "b2g.completed" || event === "b2g.fee_payment_failed") shouldSend = true;

      if (shouldSend) {
        processChannels(settings.channels, { userId: target.userId }, settings.webhooks);
      }
    }
  }

  // Batch insert
  if (jobs.length > 0) {
    const batch = db.batch();
    for (const job of jobs) {
      const ref = db.collection("notification_jobs").doc();
      batch.set(ref, {
        ...job,
        nextRunAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    await batch.commit();
  }
}