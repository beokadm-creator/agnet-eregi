import fetch from "node-fetch";
import { OpsErrorCategory } from "./ops_audit";

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
  const envKeySpecific = `OPS_ALERT_WEBHOOK_URL_${params.gateKey.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const webhookUrlSpecific = process.env[envKeySpecific];
  const webhookUrlCommon = process.env.OPS_ALERT_WEBHOOK_URL;
  
  const webhookUrl = webhookUrlSpecific || webhookUrlCommon;
  const envKeyUsed = webhookUrlSpecific ? envKeySpecific : (webhookUrlCommon ? "OPS_ALERT_WEBHOOK_URL" : null);
  const resolvedFrom = webhookUrlSpecific ? "specific" : (webhookUrlCommon ? "fallback" : "none");

  if (!webhookUrl) {
    return { success: false, envKeyUsed, resolvedFrom, reason: "No webhook URL configured" };
  }

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
       return { success: false, envKeyUsed, resolvedFrom, reason: `HTTP ${res.status}` };
    }
    
    return { success: true, envKeyUsed, resolvedFrom };
  } catch (err: any) {
    console.error("[OpsAlert] Webhook 전송 실패:", err);
    return { success: false, envKeyUsed, resolvedFrom, reason: err.message };
  }
}
