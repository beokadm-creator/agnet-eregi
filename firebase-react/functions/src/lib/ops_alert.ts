import fetch from "node-fetch";
import { OpsErrorCategory } from "./ops_audit";
import { getOpsGateSettingsCollection, OpsGateSettings } from "./ops_gate_settings";

export interface OpsAlertParams {
  gateKey: string;
  action: string;
  category?: OpsErrorCategory | string;
  summary: string;
  requestId?: string;
  links?: Record<string, string>;
  error?: { code?: string; message?: string };
  severity?: "info" | "warning" | "error" | "critical";
}

export async function notifyOpsAlert(params: OpsAlertParams) {
  let webhookUrl: string | null = null;
  let resolvedFrom: "db" | "env_default" | "none" = "none";
  let webhookHost: string | null = null;

  try {
    const docRef = getOpsGateSettingsCollection().doc(params.gateKey);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      const settings = docSnap.data() as OpsGateSettings;
      
      if (!settings.enabled) {
        return { sent: false, success: false, resolvedFrom: "db", reason: "disabled" };
      }
      
      if (settings.slackWebhookUrl) {
        webhookUrl = settings.slackWebhookUrl;
        resolvedFrom = "db";
      }
    }
  } catch (err) {
    console.error("[OpsAlert] Failed to fetch gate settings:", err);
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

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `${severityIcon} ${params.summary}`, blocks })
    });
    
    if (!res.ok) {
       console.error(`[OpsAlert] Webhook 전송 실패 (${res.status}):`, await res.text());
       return { sent: false, success: false, resolvedFrom, webhookHost, reason: `HTTP ${res.status}` };
    }
    
    return { sent: true, success: true, resolvedFrom, webhookHost };
  } catch (err: any) {
    console.error("[OpsAlert] Webhook 전송 실패:", err);
    return { sent: false, success: false, resolvedFrom, webhookHost, reason: err.message };
  }
}
