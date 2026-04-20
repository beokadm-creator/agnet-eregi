# Ops Alert Delivery Reliability

## 1. 개요
운영 이슈가 발생하여 Slack 알림을 전송할 때, Slack API의 일시적 장애나 네트워크 오류로 인해 알림이 유실되지 않도록 **재시도(Queueing) 매커니즘**을 제공합니다. 

## 2. 백오프 규칙 및 큐 스펙
- **대상 컬렉션**: `ops_alert_jobs`
- **상태 변화**: `pending` → `running` → `done` (성공 시) 또는 `dead` (재시도 한도 초과 시)
- **최대 시도 횟수 (maxAttempts)**: 5회 (최초 발송 실패 1회 포함, 추가 재시도 4회)
- **지수 백오프(Exponential Backoff)**:
  - 1회 실패 (첫 재시도): +5분
  - 2회 실패: +15분
  - 3회 이상 실패: +60분
- 알림이 최종적으로 실패(dead) 처리되면 `ops_audit_events`에 `ops_alert.dead` 액션이 기록됩니다.

## 3. Ops Console - Alert Delivery
- **조회/필터링**: `status`(pending/running/done/dead) 및 `gateKey` 기반으로 최근 작업들을 조회할 수 있습니다.
- **수동 재시도 (Requeue)**:
  - `dead` 상태로 전환된 알림 잡에 한해, **ops_admin** 권한을 가진 운영자가 수동으로 큐에 다시 밀어넣을 수 있습니다(`[재시도 (Requeue)]` 버튼 클릭 시 Confirm 필요).
  - 재시도 요청 시 API를 통해 `attempts=0`, `status=pending`으로 초기화되며, `ops_alert.requeue` 감사 로그가 남습니다.

## 4. 운영 체크리스트
1. **대시보드 점검**: Ops Console의 **알림 발송 현황 (Alert Delivery)** 섹션에서 `status=dead` 항목이 있는지 확인합니다.
2. **오류 원인 파악**: `dead` 잡의 '오류 내역' 필드에서 에러 메시지를 확인하고(예: Invalid webhook URL, Slack Timeout 등) 원인을 조치합니다.
3. **수동 재시도**: 설정 수정 후 `dead` 항목의 `[재시도 (Requeue)]` 버튼을 클릭하여 다시 전송을 시도합니다. (ops_admin 권한 필요)
4. **성공 확인**: 다시 고침 버튼을 눌러 상태가 `done`으로 변경되었는지(또는 슬랙에 알림이 수신되었는지) 확인합니다.
