import * as crypto from "crypto";
import { INotificationProvider } from "./notification_provider";
import { NotificationJob, WebhookConfig } from "../notify_models";

export class WebhookProvider implements INotificationProvider {
  async send(job: NotificationJob): Promise<boolean> {
    const webhookConfig = job.config as WebhookConfig;
    if (!webhookConfig || !webhookConfig.url) {
      throw new Error("Webhook URL이 없습니다.");
    }

    const body = JSON.stringify({
      event: job.event,
      target: job.target,
      payload: job.payload,
      timestamp: new Date().toISOString()
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (webhookConfig.secret) {
      const hmac = crypto.createHmac("sha256", webhookConfig.secret).update(body).digest("hex");
      headers["X-Signature"] = `sha256=${hmac}`;
    }

    const res = await fetch(webhookConfig.url, {
      method: "POST",
      headers,
      body
    });

    if (!res.ok) {
      throw new Error(`Webhook failed with status ${res.status}`);
    }

    return true;
  }
}