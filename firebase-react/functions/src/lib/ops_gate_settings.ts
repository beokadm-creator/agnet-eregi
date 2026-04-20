import * as admin from "firebase-admin";

export interface OpsGateSettings {
  gateKey: string;
  enabled: boolean;
  slackWebhookUrl: string | null;
  notes?: string | null;
  updatedAt: admin.firestore.Timestamp;
  updatedBy: string;
}

export const getOpsGateSettingsCollection = () => admin.firestore().collection("ops_gate_settings");
