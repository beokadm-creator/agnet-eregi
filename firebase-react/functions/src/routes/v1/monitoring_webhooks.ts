import * as express from "express";
import * as admin from "firebase-admin";

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

      if (!settings.enabled) {
        // 의도적 비활성화는 200 no-op로 응답하여 재시도 노이즈 방지
        return res.status(200).send("Telegram integration is disabled");
      }

      if (!settings.botToken || !settings.chatId || !settings.webhookToken) {
        logError({ endpoint: "webhooks/monitoring", code: "FAILED_PRECONDITION", messageKo: "Telegram 설정이 켜져 있으나 필수 값이 누락되었습니다." });
        return res.status(500).send("Missing Telegram config");
      }

      if (token !== settings.webhookToken) {
        logError({ endpoint: "webhooks/monitoring", code: "PERMISSION_DENIED", messageKo: "Webhook 토큰 불일치" });
        return res.status(403).send("Forbidden");
      }

      // GCP Monitoring Alert Payload (JSON)
      const payload = req.body;
      const incident = payload?.incident;
      
      const escapeHtml = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      
      let message = "🚨 <b>GCP Monitoring Alert</b>\n\n";
      
      if (incident) {
        const state = incident.state === "open" ? "🔴 OPEN" : "🟢 CLOSED";
        const policyName = escapeHtml(incident.policy_name || "Unknown Policy");
        const summary = escapeHtml(incident.summary || "No summary provided");
        const url = incident.url || "";

        message += `<b>상태</b>: ${state}\n`;
        message += `<b>정책</b>: ${policyName}\n`;
        message += `<b>내용</b>: ${summary}\n`;
        if (url) message += `\n<a href="${url}">[대시보드 보기]</a>`;
      } else {
         message += `알 수 없는 페이로드 수신: \n<pre><code class="language-json">\n${escapeHtml(JSON.stringify(payload, null, 2))}\n</code></pre>`;
      }

      // Send to Telegram
      const tgUrl = `https://api.telegram.org/bot${settings.botToken}/sendMessage`;
      const tgRes = await fetch(tgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: settings.chatId,
          text: message,
          parse_mode: "HTML"
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
