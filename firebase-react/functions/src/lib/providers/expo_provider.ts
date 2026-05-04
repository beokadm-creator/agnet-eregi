import { NotificationJob } from "../notify_models";
import { INotificationProvider } from "./notification_provider";

export class ExpoProvider implements INotificationProvider {
  async send(job: NotificationJob): Promise<boolean> {
    const to = job.target?.address;
    if (!to) throw new Error("Expo push token이 없습니다.");

    const template = job.payload?._template;
    const title = template?.subject || `알림: ${job.event}`;
    const body = template?.body || "";

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({
        to,
        title,
        body: String(body).slice(0, 2000),
        data: job.payload || {},
      }),
    });

    const json: any = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Expo push 실패 (HTTP ${res.status})`);

    const ticket = json?.data;
    if (!ticket) return true;
    if (Array.isArray(ticket)) {
      const first = ticket[0];
      if (first?.status === "error") throw new Error(first?.message || "Expo push error");
      return true;
    }
    if (ticket?.status === "error") throw new Error(ticket?.message || "Expo push error");
    return true;
  }
}

