import * as admin from "firebase-admin";
import { logOpsEvent } from "./ops_audit";

// 실제 연동 시에는 SDK(예: @sendgrid/mail, twilio)를 설치하여 사용합니다.
// 여기서는 인터페이스와 시뮬레이션 로직만 구현합니다.

interface NotificationPayload {
  to: string; // email or phone number
  templateId: string;
  dynamicTemplateData: Record<string, any>;
}

export async function sendEmail(_payload: NotificationPayload): Promise<boolean> {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const emulator = process.env.FUNCTIONS_EMULATOR === "true";
  if (!sendgridApiKey) {
    if (emulator) return true;
    throw new Error("MISSING_CONFIG: SENDGRID_API_KEY");
  }

  return true;
}

export async function sendSms(_payload: NotificationPayload): Promise<boolean> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;

  const emulator = process.env.FUNCTIONS_EMULATOR === "true";
  if (!twilioSid || !twilioToken) {
    if (emulator) return true;
    throw new Error("MISSING_CONFIG: TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN");
  }

  return true;
}

export async function dispatchCustomerNotification(adminApp: typeof admin, caseId: string, eventType: string) {
  const db = adminApp.firestore();
  const caseDoc = await db.collection("cases").doc(caseId).get();
  
  if (!caseDoc.exists) return;
  const caseData = caseDoc.data();
  if (!caseData || !caseData.userId) return;

  // 사용자 정보 조회 (이메일, 전화번호)
  const userDoc = await db.collection("users").doc(caseData.userId).get();
  const userData = userDoc.data() || {};
  const email = userData.email;
  const phone = userData.phoneNumber;

  const templateData = {
    caseTitle: caseData.title || "사건",
    status: caseData.status,
    eventType
  };

  // 1. 이메일 발송
  if (email) {
    try {
      await sendEmail({
        to: email,
        templateId: `template_${eventType}`,
        dynamicTemplateData: templateData
      });
    } catch (e: any) {
      await logOpsEvent(adminApp, {
        gateKey: "system",
        action: "notify.email",
        status: "fail",
        actorUid: "system",
        requestId: `notify_${Date.now()}`,
        summary: `Email notification failed`,
        error: { message: e?.message || String(e) },
        target: { caseId, eventType, to: email }
      });
      throw e;
    }
  }

  // 2. SMS/알림톡 발송
  if (phone) {
    try {
      await sendSms({
        to: phone,
        templateId: `sms_template_${eventType}`,
        dynamicTemplateData: templateData
      });
    } catch (e: any) {
      await logOpsEvent(adminApp, {
        gateKey: "system",
        action: "notify.sms",
        status: "fail",
        actorUid: "system",
        requestId: `notify_${Date.now()}`,
        summary: `SMS notification failed`,
        error: { message: e?.message || String(e) },
        target: { caseId, eventType, to: phone }
      });
      throw e;
    }
  }
}
