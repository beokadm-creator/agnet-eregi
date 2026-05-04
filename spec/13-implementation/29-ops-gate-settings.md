# 29. Ops Gate Settings & Alert Routing

## 개요
Gate별 알림 설정 및 기타 운영 파라미터를 하드코딩된 환경 변수(ENV)에서 DB(`ops_gate_settings` 컬렉션) 기반으로 이전합니다. 이를 통해 서버 재배포 없이 즉각적인 설정 변경과 알림 발송 제어가 가능해집니다.

## 우선순위 규칙 (DB → ENV)
알림 발생 시 발송할 Webhook URL을 결정하는 규칙은 다음과 같습니다:
1. **DB 설정 우선**: `ops_gate_settings` 컬렉션에서 해당 `gateKey` 문서 조회. `slackWebhookUrl`이 존재하면 이를 사용.
2. **공용 ENV Fallback**: DB에 설정이 없거나 문서가 없을 경우, 환경 변수 `OPS_ALERT_WEBHOOK_URL`을 공통으로 사용.
3. **실패 처리**: 둘 다 없을 경우 발송 실패 에러(`No webhook URL configured`) 반환.

## Enabled 동작
DB에 `enabled` 필드가 `false`로 설정된 경우:
- 모든 알림 발송은 즉시 스킵됩니다.
- 응답(또는 내부 결과)으로 `sent: false, reason: "disabled"`가 반환됩니다.
- 테스트 API(`POST /v1/ops/alerts/test`)도 이 정책을 동일하게 따릅니다.

## 배포 및 운영 체크리스트
1. **DB 스키마 자동화(Upsert)**:
   - 별도의 수동 시딩 스크립트는 불필요합니다.
   - Ops Console에서 특정 Gate를 조회(`GET /v1/ops/gates/:gateKey/settings`)할 때, 문서가 없으면 기본값(`enabled: true`, `slackWebhookUrl: null`)으로 자동 생성됩니다.
2. **배포 후 초기 세팅 (필수 3가지)**:
   - Ops Console에 접속하여 관리 중인 각 `gateKey`를 선택합니다.
   - [설정 조회]를 눌러 초기 레코드를 생성시킵니다.
   - 필요한 경우 전용 Slack Webhook URL을 입력하고 [설정 저장]을 누른 뒤, [알림 테스트]로 정상 연동을 확인합니다.
3. **인덱스 제약 사항**:
   - `gateKey`를 Document ID로 사용하므로 단건 조회가 주를 이룹니다.
   - 별도의 복합 인덱스(Composite Index)는 추가할 필요가 없습니다.
