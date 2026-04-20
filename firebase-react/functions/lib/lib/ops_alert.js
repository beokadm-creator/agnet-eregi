"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOpsAlert = notifyOpsAlert;
const node_fetch_1 = __importDefault(require("node-fetch"));
const ops_gate_settings_1 = require("./ops_gate_settings");
async function notifyOpsAlert(params) {
    let webhookUrl = null;
    let resolvedFrom = "none";
    let webhookHost = null;
    try {
        const docRef = (0, ops_gate_settings_1.getOpsGateSettingsCollection)().doc(params.gateKey);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const settings = docSnap.data();
            if (!settings.enabled) {
                return { sent: false, success: false, resolvedFrom: "db", reason: "disabled" };
            }
            if (settings.slackWebhookUrl) {
                webhookUrl = settings.slackWebhookUrl;
                resolvedFrom = "db";
            }
        }
    }
    catch (err) {
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
    }
    catch (err) { }
    const severityIcon = params.severity === "critical" ? "🚨" : params.severity === "error" ? "❌" : params.severity === "warning" ? "⚠️" : "ℹ️";
    const blocks = [
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
        const res = await (0, node_fetch_1.default)(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: `${severityIcon} ${params.summary}`, blocks })
        });
        if (!res.ok) {
            console.error(`[OpsAlert] Webhook 전송 실패 (${res.status}):`, await res.text());
            return { sent: false, success: false, resolvedFrom, webhookHost, reason: `HTTP ${res.status}` };
        }
        return { sent: true, success: true, resolvedFrom, webhookHost };
    }
    catch (err) {
        console.error("[OpsAlert] Webhook 전송 실패:", err);
        return { sent: false, success: false, resolvedFrom, webhookHost, reason: err.message };
    }
}
//# sourceMappingURL=ops_alert.js.map