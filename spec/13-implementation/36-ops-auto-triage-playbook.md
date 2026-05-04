# Ops Auto Triage & Playbook

## 1. 개요
Ops Console에서 발생하는 수많은 이벤트와 지표들(`cbOpen`, `deadJobs`, `alertDead` 등)을 분석하여 장애/이슈의 원인을 자동 분류(Auto Triage)하고, 권장 조치(Playbook)를 운영자에게 제시하며 원클릭으로 실행할 수 있는 기능을 제공합니다.

## 2. 데이터 모델

`ops_incidents` 컬렉션에 아래 필드가 추가됩니다.
- `triage`:
  - `type`: 원인 분류 (`cb_open` | `dead_jobs` | `alert_delivery` | `auth_denied` | `unknown`)
  - `confidence`: 신뢰도 (0 ~ 1)
  - `reasons`: 근거 텍스트 배열
  - `suggestedActions`: 권장 조치(Playbook) 키 배열
- `actionsTaken`:
  - 플레이북 액션 실행 이력
  - `{ at, actionKey, actorUid, result, ref }` 형태의 객체 배열

## 3. Triage 분류 규칙

Incident 내 `counters` 및 `reasons`를 기반으로 아래 우선순위에 따라 Triage Type을 산정합니다.
1. **cb_open** (Confidence: 0.9)
   - 조건: `counters.cbOpen > 0` 또는 `reasons`에 "cb_open" 포함
   - 액션: `cb_reset` (Circuit Breaker 리셋)
2. **dead_jobs** (Confidence: 0.85)
   - 조건: `counters.deadJobs > 0` 또는 `reasons`에 "dead_jobs" 포함
   - 액션: `deadletter_issue` (Dead-letter 큐 수동 이슈화)
3. **alert_delivery** (Confidence: 0.8)
   - 조건: `counters.alertDead > 0` 또는 `reasons`에 "alert_dead" 포함
   - 액션: `alert_force_send` (강제 알림 발송)
4. **auth_denied** (Confidence: 0.8)
   - 조건: `counters.authDenied >= 20` 또는 `reasons`에 "auth_denied_spike" 포함
   - 액션: 없음
5. **unknown** (Confidence: 0.3)
   - 그 외 모든 경우

## 4. Playbook API 명세

### 4.1 Playbook 조회 API
- **엔드포인트**: `GET /v1/ops/incidents/:id/playbook`
- **권한**: `ops_viewer`
- **응답**:
  ```json
  {
    "ok": true,
    "data": {
      "triage": { "type": "cb_open", "confidence": 0.9, ... },
      "steps": [
        { "actionKey": "cb_reset", "label": "CB Reset", "desc": "...", "requiredRole": "ops_admin" }
      ],
      "runnableActions": ["cb_reset", "deadletter_issue", "alert_force_send"]
    }
  }
  ```

### 4.2 Playbook 실행 API
- **엔드포인트**: `POST /v1/ops/incidents/:id/playbook/run`
- **권한**: 액션에 따라 다름 (`ops_operator` 또는 `ops_admin`)
- **Body**: `{ "actionKey": "cb_reset", "params": {} }`
- **처리 흐름**:
  1. 권한 체크 (`hasRole`)
  2. 실제 액션 로직 수행 (`resetCircuitBreaker`, `createDeadLetterIssueAction` 등)
  3. `ops_audit_events`에 `ops_playbook.run` 로그 기록
  4. Incident의 `actionsTaken` 배열에 실행 이력 누적
  5. 응답 반환

## 5. UI/UX 및 운영 가이드
- Ops Console의 **Incident 상세 모달**에서 왼쪽 패널에 `Auto Triage` 정보와 `권장 조치(Playbook)` 실행 버튼을 제공합니다.
- 모든 실행 버튼은 각 액션에 필요한 Role(예: `ops_admin`)을 체크하여 비활성화 여부를 결정합니다.
- 권장 조치 버튼을 누르면 반드시 대상과 즉시 반영 여부를 알리는 **Confirm 모달**이 뜹니다.
- 실행이 완료되면 모달 내 하단 `실행 이력` 영역에 즉시 기록됩니다.
