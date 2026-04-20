import * as admin from "firebase-admin";
import { OpsErrorCategory } from "./ops_audit";
import { getOpsGateSettingsCollection, OpsGateSettings, OpsGateAlertPolicy } from "./ops_gate_settings";

export interface OpsAlertParams {
  gateKey: string;
  alertType?: string;
  action: string;
  category?: OpsErrorCategory | string;
  summary: string;
  requestId?: string;
  links?: Record<string, string>;
  error?: { code?: string; message?: string };
  severity?: "info" | "warning" | "error" | "critical";
  force?: boolean;
}

export const defaultAlertPolicy: OpsGateAlertPolicy = {
  enabled: true,
  cooldownSec: 900,
  rules: {
    circuitBreakerOpen: true,
    deadJobs: true,
    failRateThreshold: 0.05,
    deniedThreshold: 10,
  },
  channels: {
    useGateWebhook: true
  }
};

export async function notifyOpsAlert(params: OpsAlertParams) {
  let webhookUrl: string | null = null;
  let resolvedFrom: "db" | "env_default" | "none" = "none";
  let webhookHost: string | null = null;

  let policy = defaultAlertPolicy;
  let lastAlertAt: Record<string, admin.firestore.Timestamp> = {};
  let settingsDocExists = false;
  const docRef = getOpsGateSettingsCollection().doc(params.gateKey);

  try {
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      settingsDocExists = true;
      const settings = docSnap.data() as OpsGateSettings;
      
      if (!settings.enabled) {
        return { sent: false, success: false, resolvedFrom: "db", reason: "gate_disabled" };
      }
      
      if (settings.alertPolicy) {
        policy = { 
          ...defaultAlertPolicy, 
          ...settings.alertPolicy, 
          rules: { ...defaultAlertPolicy.rules, ...(settings.alertPolicy.rules || {}) }, 
          channels: { ...defaultAlertPolicy.channels, ...(settings.alertPolicy.channels || {}) } 
        };
      }
      if (settings.lastAlertAt) {
        lastAlertAt = settings.lastAlertAt;
      }
      
      if (settings.slackWebhookUrl && policy.channels.useGateWebhook) {
        webhookUrl = settings.slackWebhookUrl;
        resolvedFrom = "db";
      }
    }
  } catch (err) {
    console.error("[OpsAlert] Failed to fetch gate settings:", err);
  }

  if (!params.force) {
    if (!policy.enabled) {
      await admin.firestore().collection("ops_audit_events").doc().set({
         gateKey: params.gateKey,
         action: "ops_alert.suppressed",
         status: "success",
         actorUid: "system",
         requestId: params.requestId || "unknown",
         summary: `Alert suppressed (policy disabled): ${params.summary}`,
         target: { alertType: params.alertType, reason: "policy_disabled" },
         createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { sent: false, success: true, resolvedFrom, reason: "policy_disabled" };
    }

    if (params.alertType) {
      if (params.alertType === "cb_open" && !policy.rules.circuitBreakerOpen) return { sent: false, success: true, reason: "rule_disabled" };
      if (params.alertType === "dead_jobs" && !policy.rules.deadJobs) return { sent: false, success: true, reason: "rule_disabled" };

      const lastAt = lastAlertAt[params.alertType];
      if (lastAt) {
        const now = Date.now();
        const diffSec = (now - lastAt.toDate().getTime()) / 1000;
        if (diffSec < policy.cooldownSec) {
          await admin.firestore().collection("ops_audit_events").doc().set({
             gateKey: params.gateKey,
             action: "ops_alert.suppressed",
             status: "success",
             actorUid: "system",
             requestId: params.requestId || "unknown",
             summary: `Alert suppressed (cooldown): ${params.summary}`,
             target: { alertType: params.alertType, reason: "cooldown", cooldownSec: policy.cooldownSec, lastAlertAt: lastAt.toDate().toISOString() },
             createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          return { sent: false, success: true, resolvedFrom, reason: "cooldown" };
        }
      }
    }
  }

  if (!webhookUrl) {
    const envDefault = process.env.OPS_ALERT_WEBHOOK_URL;
    if (envDefault) {
      webhookUrl = envDefault;
      resolvedFrom = "env_default";
    }
  }

  if (!webhookUrl) {
    return { sent: false, success: false, resolvedFrom: "none", reason: "No webhook URL configured" };
  }

  try {
    const url = new URL(webhookUrl);
    webhookHost = url.host;
  } catch (err) {}

  const severityIcon = params.severity === "critical" ? "🚨" : params.severity === "error" ? "❌" : params.severity === "warning" ? "⚠️" : "ℹ️";
  
  const blocks: any[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${severityIcon} [Ops Automation] ${params.summary}`, emoji: true }
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*GateKey:*\n${params.gateKey}` },
        { type: "mrkdwn", text: `*Action:*\n\`${params.action}\`` },
        { type: "mrkdwn", text: `*Category:*\n${params.category || "UNKNOWN"}` },
        { type: "mrkdwn", text: `*ReqID:*\n${params.requestId || "N/A"}` }
      ]
    }
  ];

  if (params.error && params.error.message) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Error Details:*\n\`\`\`${params.error.message}\`\`\`` }
    });
  }

  if (params.links && Object.keys(params.links).length > 0) {
    const linkTexts = Object.entries(params.links).map(([name, url]) => `<${url}|${name}>`);
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `*Links:* ${linkTexts.join(" | ")}` }]
    });
  }

  let sentOk = false;
  let reason = "";

  try {
    const res = await globalThis.fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `${severityIcon} ${params.summary}`, blocks })
    });
    
    if (!res.ok) {
       console.error(`[OpsAlert] Webhook 전송 실패 (${res.status}):`, await res.text());
       reason = `HTTP ${res.status}`;
    } else {
       sentOk = true;
    }
  } catch (err: any) {
    console.error("[OpsAlert] Webhook 전송 실패:", err);
    reason = err.message;
  }

  await admin.firestore().collection("ops_audit_events").doc().set({
    gateKey: params.gateKey,
    action: params.force ? "ops_alert.force_send" : "ops_alert.notify",
    status: sentOk ? "success" : "fail",
    actorUid: "system",
    requestId: params.requestId || "unknown",
    summary: sentOk ? `Alert sent: ${params.summary}` : `Alert failed: ${params.summary}`,
    target: { alertType: params.alertType, reason: sentOk ? undefined : reason },
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (sentOk && params.alertType && settingsDocExists && !params.force) {
    await docRef.update({
      [`lastAlertAt.${params.alertType}`]: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  return { sent: sentOk, success: sentOk, resolvedFrom, webhookHost, reason: sentOk ? undefined : reason };
}
