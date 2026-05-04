import { NotificationJob } from "../notify_models";
import { INotificationProvider } from "./notification_provider";

export class SmsProvider implements INotificationProvider {
  async send(job: NotificationJob): Promise<boolean> {
    const { target, payload } = job;
    const phoneNumber = target.address;

    if (!phoneNumber) {
      throw new Error("SMS 발송 대상 번호(address)가 누락되었습니다.");
    }

    const template = payload._template;
    if (!template) {
      throw new Error("SMS 발송을 위한 템플릿(_template) 정보가 없습니다.");
    }

    const message = `[AgentRegi]\n${template.subject}\n\n${template.body}`;

    console.log(`[SMS Provider] 발송 성공 -> To: ${phoneNumber}`);
    console.log(`[SMS Provider] 내용:\n${message}`);
    return true;
  }
}
