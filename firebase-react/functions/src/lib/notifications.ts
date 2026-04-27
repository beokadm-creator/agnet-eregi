import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// 실제 연동 시에는 SDK(예: @sendgrid/mail, twilio)를 설치하여 사용합니다.
// 여기서는 인터페이스와 시뮬레이션 로직만 구현합니다.

interface NotificationPayload {
  to: string; // email or phone number
  templateId: string;
  dynamicTemplateData: Record<string, any>;
}

export async function sendEmail(payload: NotificationPayload): Promise<boolean> {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (!sendgridApiKey) {
    console.warn("[Notifications] SENDGRID_API_KEY가 설정되지 않아 이메일 발송을 시뮬레이션합니다.", payload);
    return true;
  }

  // 실제 SendGrid 연동 로직
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(sendgridApiKey);
  // await sgMail.send({ ... });
  
  console.log(`[Notifications] 이메일 발송 완료: ${payload.to}`);
  return true;
}

export async function sendSms(payload: NotificationPayload): Promise<boolean> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!twilioSid || !twilioToken) {
    console.warn("[Notifications] TWILIO 자격증명이 설정되지 않아 SMS 발송을 시뮬레이션합니다.", payload);
    return true;
  }

  // 실제 Twilio 연동 로직
  // const client = require('twilio')(twilioSid, twilioToken);
  // await client.messages.create({ ... });

  console.log(`[Notifications] SMS 발송 완료: ${payload.to}`);
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
    await sendEmail({
      to: email,
      templateId: `template_${eventType}`,
      dynamicTemplateData: templateData
    });
  }

  // 2. SMS/알림톡 발송
  if (phone) {
    await sendSms({
      to: phone,
      templateId: `sms_template_${eventType}`,
      dynamicTemplateData: templateData
    });
  }
}
