import { NotificationJob } from "../notify_models";

export interface INotificationProvider {
  /**
   * 알림 전송 처리
   * @param job 전송할 알림 작업 데이터
   * @returns 성공 시 true, 실패 시 에러 throw
   */
  send(job: NotificationJob): Promise<boolean>;
}

export class NotificationProviderFactory {
  private static providers = new Map<string, INotificationProvider>();

  static register(channel: string, provider: INotificationProvider) {
    this.providers.set(channel, provider);
  }

  static getProvider(channel: string): INotificationProvider {
    const provider = this.providers.get(channel);
    if (!provider) {
      throw new Error(`지원하지 않는 알림 채널입니다: ${channel}`);
    }
    return provider;
  }
}