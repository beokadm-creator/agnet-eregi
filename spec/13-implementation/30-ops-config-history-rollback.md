# 30. Ops Config Change History & Rollback

## 개요
Ops Console의 Gate Settings 변경 이력을 추적하고 필요한 경우 특정 시점의 설정으로 되돌릴 수 있는 롤백(Rollback) 기능을 제공합니다. 이 기능은 `ops_audit_events`에 기록된 `ops_gate_settings.update` 및 `ops_gate_settings.rollback` 이벤트를 기반으로 작동합니다.

## API 명세

### 1. 변경 이력 조회 (`GET /v1/ops/gates/:gateKey/settings/history`)
해당 `gateKey`에 대한 설정 변경 내역을 최신순으로 반환합니다.
- **Query Params:**
  - `limit`: (기본 50, 최대 200)
  - `from`, `to`: (Date string, 기본 최근 30일)
  - `actorUid`: 특정 운영자의 변경 이력만 조회
  - `cursor`: Pagination
- **조회 조건:** `action in ["ops_gate_settings.update", "ops_gate_settings.rollback"]`

### 2. 롤백 지원을 위한 업데이트 (`PUT /v1/ops/gates/:gateKey/settings`)
- 기존의 설정 변경 API에 `isRollback` 필드를 추가로 지원합니다.
- **Audit 기록 분기:**
  - `isRollback === true` 일 경우 `action: "ops_gate_settings.rollback"` 으로 기록.
  - 아닐 경우 `action: "ops_gate_settings.update"` 로 기록.
- **Diff 확장:** 기존 `enabled`, `slackWebhookUrlHost` 외에 `notes` 항목도 `target.changed` 객체에 이전값/이후값 배열 형태로 저장하여 이력 조회 시 표시 가능하도록 개선.

## UI/UX 및 제약사항
1. **변경 이력 모달**
   - "Gate Settings (DB)" 섹션의 `[변경 이력]` 버튼을 클릭하면 표시됩니다.
   - 각 이력은 발생 시간, 수행자, 그리고 설정 항목별 이전값과 이후값을 명확히 표시합니다.
2. **롤백 (Rollback)**
   - 각 이력 항목 우측의 `[이 시점으로 롤백]` 버튼을 통해 수행됩니다.
   - **주의:** 보안 및 정책 상 `slackWebhookUrl` 전체 경로는 Audit에 남지 않고 Host만 기록되므로, **롤백 시 Webhook URL은 현재 설정된 값을 유지**하며 `enabled`와 `notes` 항목만 해당 시점의 값으로 복원됩니다.
   - 롤백 성공 시 즉시 현재 설정 상태가 리로드되며 모달이 닫힙니다.
