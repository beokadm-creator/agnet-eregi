import * as admin from "firebase-admin";

export type NotificationChannel = "webhook" | "email" | "sms" | "slack" | "kakao" | "expo";

export interface WebhookConfig {
  url: string;
  enabled: boolean;
  secret?: string;
}

export interface EmailConfig {
  address: string;
  enabled: boolean;
}

export interface SmsConfig {
  phoneNumber: string;
  enabled: boolean;
}

export interface PartnerNotificationSettings {
  partnerId: string;
  webhooks?: WebhookConfig[]; // 기존 하위 호환성 유지
  channels?: {
    webhook?: WebhookConfig[];
    email?: EmailConfig[];
    sms?: SmsConfig[];
    slack?: WebhookConfig[];
    kakao?: SmsConfig[];
  };
  events: {
    packageReady: boolean;
    closingReportReady: boolean;
    caseCompleted: boolean;
    evidenceFulfilled?: boolean;
  };
  updatedAt: admin.firestore.Timestamp;
}

export interface UserNotificationSettings {
  userId: string;
  webhooks?: WebhookConfig[]; // 기존 하위 호환성 유지
  channels?: {
    webhook?: WebhookConfig[];
    email?: EmailConfig[];
    sms?: SmsConfig[];
    slack?: WebhookConfig[];
    kakao?: SmsConfig[];
  };
  events: {
    submissionCompleted: boolean;
    submissionFailed: boolean;
    evidenceRequested?: boolean;
  };
  updatedAt: admin.firestore.Timestamp;
}

export type NotificationEvent = 
  | "submission.completed" 
  | "submission.failed" 
  | "package.ready" 
  | "closing_report.ready" 
  | "case.completed"
  | "evidence.requested"
  | "evidence.fulfilled"
  | "funnel.dropoff"
  | "submission.dropoff"
  | "b2g.action_required"
  | "b2g.completed"
  | "b2g.fee_payment_failed";

export type NotificationStatus = "queued" | "sending" | "sent" | "failed";

export interface NotificationJob {
  id?: string;
  channel: NotificationChannel; // 기존 type 대신 channel 도입
  target: {
    userId?: string;
    partnerId?: string;
    address?: string; // URL, Email, Phone 등 발송 대상 주소
  };
  event: NotificationEvent;
  payload: any;
  config?: any; // 채널별 설정 (WebhookConfig, EmailConfig 등)
  status: NotificationStatus;
  attempts: number;
  nextRunAt: admin.firestore.Timestamp;
  lastError?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
}
