import * as express from "express";
import * as admin from "firebase-admin";
import fetch from "node-fetch";

import { logError } from "../../lib/http";
import { getOpsSettingsCollection, TelegramSettings } from "../../lib/ops_settings";

export function registerMonitoringWebhookRoutes(app: express.Application, adminApp: typeof admin) {
  
  // POST /v1/webhooks/monitoring
  // GCP Monitoring Notification Channel 에서 이 엔드포인트로 전송함
  app.post("/v1/webhooks/monitoring", async (req: express.Request, res: express.Response) => {
    try {
      const token = req.query.token as string || req.headers["x-webhook-token"] as string;

      if (!token) {
        logError({ endpoint: "webhooks/monitoring", code: "UNAUTHENTICATED", messageKo: "Webhook 인증 토큰 누락" });
        return res.status(401).send("Unauthorized");
      }

      const docSnap = await getOpsSettingsCollection().doc("telegram").get();
      if (!docSnap.exists) {
        return res.status(404).send("Telegram settings not found");
      }

      const settings = docSnap.data() as TelegramSettings;

      if (!settings.enabled || !settings.botToken || !settings.chatId || !settings.webhookToken) {
        return res.status(400).send("Telegram integration is disabled or missing config");
      }

      if (token !== settings.webhookToken) {
        logError({ endpoint: "webhooks/monitoring", code: "PERMISSION_DENIED", messageKo: "Webhook 토큰 불일치" });
        return res.status(403).send("Forbidden");
      }

      // GCP Monitoring Alert Payload (JSON)
      const payload = req.body;
      const incident = payload?.incident;
      
      let message = "🚨 GCP Monitoring Alert\n\n";
      
      if (incident) {
        const state = incident.state === "open" ? "🔴 OPEN" : "🟢 CLOSED";
        const policyName = incident.policy_name || "Unknown Policy";
        const summary = incident.summary || "No summary provided";
        const url = incident.url || "";

        message += `**상태**: ${state}\n`;
        message += `**정책**: ${policyName}\n`;
        message += `**내용**: ${summary}\n`;
        if (url) message += `\n[대시보드 보기](${url})`;
      } else {
         message += `알 수 없는 페이로드 수신: \n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
      }

      // Send to Telegram
      const tgUrl = `https://api.telegram.org/bot${settings.botToken}/sendMessage`;
      const tgRes = await fetch(tgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: settings.chatId,
          text: message,
          parse_mode: "Markdown"
        })
      });

      if (!tgRes.ok) {
        const errText = await tgRes.text();
        logError({ endpoint: "webhooks/monitoring", code: "INTERNAL", messageKo: "텔레그램 전송 실패", err: new Error(errText) });
        return res.status(500).send("Failed to send Telegram message");
      }

      return res.status(200).send("OK");
    } catch (err: any) {
      logError({ endpoint: "webhooks/monitoring", code: "INTERNAL", messageKo: "모니터링 Webhook 처리 중 오류", err });
      return res.status(500).send(`Internal Error: ${err.message}`);
    }
  });

}
