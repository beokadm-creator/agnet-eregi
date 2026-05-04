# Ops Alert Noise Control

## 1. 개요
운영 중 에러가 폭주하거나(Circuit Breaker Open) 실패율이 급증할 때, Slack 채널에 알림이 과도하게 발생(Alert Storm)하는 것을 방지하기 위한 정책(Policy) 모델 및 제어 메커니즘입니다.

## 2. 데이터 모델
### `ops_gate_settings` 내 확장 필드
```json
{
  "alertPolicy": {
    "enabled": true,
    "cooldownSec": 900,
    "rules": {
      "circuitBreakerOpen": true,
      "deadJobs": true,
      "failRateThreshold": 0.05,
      "deniedThreshold": 10
    },
    "channels": {
      "useGateWebhook": true
    }
  },
  "lastAlertAt": {
    "cb_open": "2026-04-20T05:00:00.000Z",
    "dead_jobs": "2026-04-20T04:30:00.000Z"
  }
}
```
- `lastAlertAt` 필드는 알림 발송 시 단일 진실 공급원(Single Source of Truth)으로 사용되며, 이 시각과 `cooldownSec`를 비교해 알림을 억제(Suppress)합니다.

## 3. 알림 제어(Dedup/Rate Limit) 로직
1. **Policy 확인**: `policy.enabled === false`면 알림 스킵.
2. **Rule 확인**: `alertType`(예: `cb_open`, `dead_jobs`)에 대해 설정된 rule이 `false`면 알림 스킵.
3. **Cooldown 비교**: `Date.now() - lastAlertAt[alertType] < cooldownSec` 이면 알림 스킵.
4. **Audit 로그 기록**: 알림 발송을 억제한 경우 `ops_audit_events`에 `action: "ops_alert.suppressed"` 로 남깁니다.
5. **발송 성공 시**: `lastAlertAt[alertType]`를 갱신합니다.

## 4. API 스펙
- `GET /v1/ops/gates/:gateKey/alert-policy` : 정책 조회 (권한: `ops_viewer`)
- `PUT /v1/ops/gates/:gateKey/alert-policy` : 정책 저장 (권한: `ops_admin`, Confirm 필요)
- `POST /v1/ops/gates/:gateKey/alerts/force` : Cooldown 무시 강제 발송 (권한: `ops_admin`, Confirm 필요)

## 5. 운영 롤아웃 체크리스트 및 테스트 케이스
- [ ] Ops Console의 **Alert Policy** 영역에서 각 게이트별로 정책(Cooldown, 룰 등)을 조회하고 수정할 수 있는지 확인합니다.
- [ ] Alert Test 기능을 연달아 수행했을 때, `cooldownSec` 이내라면 두 번째 알림은 Slack으로 발송되지 않고 **Audit 로그에 `ops_alert.suppressed`** 로 남는지 확인합니다.
- [ ] Cooldown이 지난 후 다시 알림이 정상적으로 발송되는지 검증합니다.
- [ ] Policy를 `Disabled`로 변경한 뒤 알림이 즉시 억제되는지 확인합니다.
- [ ] 강제 발송(Force Override) API를 호출하면 Cooldown 상태라도 즉시 발송되는지 확인합니다.
