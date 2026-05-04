import { INotificationProvider } from "./notification_provider";
import { NotificationJob, WebhookConfig } from "../notify_models";

export class SlackProvider implements INotificationProvider {
  async send(job: NotificationJob): Promise<boolean> {
    const slackConfig = job.config as WebhookConfig;
    if (!slackConfig || !slackConfig.url) {
      throw new Error("Slack Webhook URL이 없습니다.");
    }

    const template = job.payload?._template;
    let text = `알림 이벤트: ${job.event}\n\`\`\`${JSON.stringify(job.payload)}\`\`\``;
    
    // 템플릿이 존재하면 포맷팅 적용
    if (template) {
      text = `*${template.subject}*\n${template.body}`;
    }

    const body = JSON.stringify({
      text: text,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: text
          }
        }
      ]
    });

    const res = await fetch(slackConfig.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Slack webhook failed with status ${res.status}: ${errText}`);
    }

    return true;
  }
}