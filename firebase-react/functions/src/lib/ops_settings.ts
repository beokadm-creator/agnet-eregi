import * as admin from "firebase-admin";

export interface TelegramSettings {
  enabled: boolean;
  botToken: string; // Secret
  chatId: string;
  webhookToken: string; // Shared secret for incoming webhooks
  updatedAt: admin.firestore.Timestamp;
  updatedBy: string;
}

export interface TossPaymentsSettings {
  enabled: boolean;
  clientKey: string;
  secretKey: string; // Secret
  updatedAt: admin.firestore.Timestamp;
  updatedBy: string;
}

export type LlmProvider = "glm";

export interface LlmSettings {
  enabled: boolean;
  provider: LlmProvider;
  model: string;
  endpoint: string;
  apiKeySecretName: string; // Secret Manager resource name
  updatedAt: admin.firestore.Timestamp;
  updatedBy: string;
}

export const getOpsSettingsCollection = () => admin.firestore().collection("ops_settings");
