import { NotificationEvent } from "../notify_models";

export interface NotificationTemplate {
  subject: string;
  body: string;
}

export function getNotificationTemplate(event: NotificationEvent, payload: any): NotificationTemplate {
  switch (event) {
    case "submission.completed":
      return {
        subject: `제출이 완료되었습니다. (ID: ${payload?.submissionId || 'N/A'})`,
        body: `사용자님의 제출건이 성공적으로 접수되었습니다.\n상세내용: ${JSON.stringify(payload)}${payload?.magicLink ? `\n\n👉 [워크스페이스 바로가기]\n${payload.magicLink}` : ''}`
      };
    case "submission.failed":
      return {
        subject: `제출에 실패했습니다. (ID: ${payload?.submissionId || 'N/A'})`,
        body: `제출 처리 중 오류가 발생했습니다.\n오류: ${payload?.error || '알 수 없는 오류'}${payload?.magicLink ? `\n\n👉 [워크스페이스 바로가기]\n${payload.magicLink}` : ''}`
      };
    case "package.ready":
      return {
        subject: `패키지 준비 완료 (ID: ${payload?.packageId || 'N/A'})`,
        body: `요청하신 패키지가 준비되었습니다.${payload?.magicLink ? `\n\n👉 [워크스페이스 바로가기]\n${payload.magicLink}` : ''}`
      };
    case "closing_report.ready":
      return {
        subject: `종결 보고서 준비 완료`,
        body: `종결 보고서가 준비되었습니다.${payload?.magicLink ? `\n\n👉 [워크스페이스 바로가기]\n${payload.magicLink}` : ''}`
      };
    case "case.completed":
      return {
        subject: `케이스 완료 (ID: ${payload?.caseId || 'N/A'})`,
        body: `케이스가 완료 처리되었습니다.${payload?.magicLink ? `\n\n👉 [워크스페이스 바로가기]\n${payload.magicLink}` : ''}`
      };
    case "evidence.requested":
      return {
        subject: `추가 증빙 자료 요청`,
        body: `진행을 위해 추가 증빙 자료가 필요합니다.${payload?.magicLink ? `\n\n👉 [워크스페이스 바로가기]\n${payload.magicLink}` : ''}`
      };
    case "evidence.fulfilled":
      return {
        subject: `증빙 자료 제출 완료`,
        body: `요청하신 증빙 자료가 제출되었습니다.${payload?.magicLink ? `\n\n👉 [워크스페이스 바로가기]\n${payload.magicLink}` : ''}`
      };
    case "funnel.dropoff":
      return {
        subject: `[AgentRegi] 진행 중이던 진단이 있습니다!`,
        body: `진단이 중단되었습니다. (의도: ${payload?.intent || '알 수 없음'})\n마저 완료하시고 최적의 파트너를 추천받아보세요!\n\n바로가기: https://agentregi.com/funnel/${payload?.sessionId}`
      };
    case "submission.dropoff":
      return {
        subject: `[AgentRegi] 접수하신 사건의 견적을 확인해주세요!`,
        body: `요청하신 '${payload?.type || '사건'}'에 대한 견적이 대기 중일 수 있습니다.\n확인 후 진행을 결정해주세요!\n\n바로가기: https://agentregi.com/submissions/${payload?.submissionId}`
      };
    case "b2g.action_required":
      return {
        subject: `[긴급] 공공기관 보정명령 수신 (${payload?.agency || '기관'})`,
        body: `제출하신 사건(ID: ${payload?.caseId})에 대해 보정명령이 발령되었습니다.\n사유: ${payload?.actionDetails || '확인 필요'}${payload?.magicLink ? `\n\n👉 [워크스페이스 바로가기]\n${payload.magicLink}` : ''}`
      };
    case "b2g.completed":
      return {
        subject: `[완료] 공공기관 등기/제출 완료 (${payload?.agency || '기관'})`,
        body: `제출하신 사건(ID: ${payload?.caseId})의 처리가 완료되었습니다.${payload?.magicLink ? `\n\n👉 [워크스페이스 바로가기]\n${payload.magicLink}` : ''}`
      };
    case "b2g.fee_payment_failed":
      return {
        subject: `[AgentRegi] 공과금/세금 자동 납부 실패 안내`,
        body: `공과금 자동 납부에 실패했습니다.\n사유: ${payload?.error || '잔액 부족 등'}\n금액: ${payload?.amount || 0}원\n수동 결제를 진행해주세요.${payload?.magicLink ? `\n\n👉 [워크스페이스 바로가기]\n${payload.magicLink}` : ''}`
      };
    default:
      return {
        subject: `알림: ${event}`,
        body: `이벤트가 발생했습니다: ${event}\n내용: ${JSON.stringify(payload)}`
      };
  }
}