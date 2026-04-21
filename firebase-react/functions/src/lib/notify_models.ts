import * as admin from "firebase-admin";

export interface WebhookConfig {
  url: string;
  enabled: boolean;
  secret?: string;
}

export interface PartnerNotificationSettings {
  partnerId: string;
  webhooks: WebhookConfig[];
  events: {
    packageReady: boolean;
    closingReportReady: boolean;
    caseCompleted: boolean;
  };
  updatedAt: admin.firestore.Timestamp;
}

export interface UserNotificationSettings {
  userId: string;
  webhooks: WebhookConfig[];
  events: {
    submissionCompleted: boolean;
    submissionFailed: boolean;
  };
  updatedAt: admin.firestore.Timestamp;
}

export type NotificationEvent = 
  | "submission.completed" 
  | "submission.failed" 
  | "package.ready" 
  | "closing_report.ready" 
  | "case.completed";

export type NotificationStatus = "queued" | "sending" | "sent" | "failed";

export interface NotificationJob {
  id?: string;
  type: "webhook";
  target: {
    userId?: string;
    partnerId?: string;
  };
  event: NotificationEvent;
  payload: any;
  status: NotificationStatus;
  attempts: number;
  nextRunAt: admin.firestore.Timestamp;
  lastError?: string;
  createdAt: admin.firestore.Timestamp;
}
