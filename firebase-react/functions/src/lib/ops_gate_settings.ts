import { adminDb } from "../index";

export interface OpsGateSettings {
  gateKey: string;
  enabled: boolean;
  slackWebhookUrl: string | null;
  notes?: string | null;
  updatedAt: FirebaseFirestore.Timestamp;
  updatedBy: string;
}

export const opsGateSettingsCollection = adminDb.collection("ops_gate_settings");
