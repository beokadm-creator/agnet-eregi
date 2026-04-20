import * as admin from "firebase-admin";

export interface OpsGateAlertPolicy {
  enabled: boolean;
  cooldownSec: number;
  rules: {
    circuitBreakerOpen: boolean;
    deadJobs: boolean;
    failRateThreshold: number;
    deniedThreshold: number;
  };
  channels: {
    useGateWebhook: boolean;
  };
}

export interface OpsGateSettings {
  gateKey: string;
  enabled: boolean;
  slackWebhookUrl: string | null;
  notes?: string | null;
  updatedAt: admin.firestore.Timestamp;
  updatedBy: string;
  alertPolicy?: OpsGateAlertPolicy;
  lastAlertAt?: Record<string, admin.firestore.Timestamp>;
}

export const getOpsGateSettingsCollection = () => admin.firestore().collection("ops_gate_settings");
