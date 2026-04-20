# Ops Release Preflight & Smoke Test

## 1. 개요
Ops 기능(#21 ~ #31)이 대거 추가됨에 따라, 배포 후(또는 배포 전) 운영 환경의 안전성을 자동으로 검증하기 위한 도구입니다. Ops Console에서 원클릭으로 점검을 수행하고 결과를 확인할 수 있습니다.

## 2. API 명세

### 2.1 Preflight Check (`POST /v1/ops/preflight`)
- **목적**: 필수 환경변수, 설정, 권한, 인덱스 등 "정적인" 설정이 올바르게 되어 있는지 확인합니다.
- **권한**: `ops_admin`
- **검증 항목**:
  1. `Slack Webhook URL`: 환경변수 또는 Gate Settings에 설정이 있는지 확인.
  2. `GitHub Token (Backlog)`: Dead-letter 자동 이슈 생성용 토큰 존재 여부 확인.
  3. `Firestore Composite Indexes`: 복합 인덱스 누락 경고 (가이드 제공).
  4. `opsRole Claim`: 현재 사용자의 권한이 올바르게 세팅되었는지 확인.
  5. `Scheduled Workers`: 스케줄 워커 정상 배포 여부 확인 (가이드 제공).
- **결과 기록**: `ops_audit_events`에 `ops_preflight.run`으로 기록됨.

### 2.2 Smoke Test (`POST /v1/ops/smoke-test`)
- **목적**: 주요 Ops API 엔드포인트들을 실제로 호출하여 200 OK 응답이 오는지 검증합니다.
- **권한**:
  - `read_only` 모드: `ops_operator` 이상
  - `full` 모드: `ops_admin` (실제 알림 발송 등 쓰기 작업 포함)
- **검증 항목**:
  - `GET /v1/ops/health/summary`
  - `GET /v1/ops/gates/:gateKey/settings`
  - `GET /v1/ops/gates/:gateKey/alert-policy`
  - `GET /v1/ops/incidents`
  - (full 모드) `POST /v1/ops/alerts/test`
- **결과 기록**: `ops_audit_events`에 `ops_smoketest.run`으로 각 호출의 소요 시간 및 성공 여부가 기록됨.

## 3. Ops Console UI 및 운영 가이드
1. **위치**: 대시보드의 `🚀 Release Preflight & Smoke Test` 섹션.
2. **절차**:
   - 운영자가 배포 직후, 해당 섹션에서 `[Preflight 실행]` 버튼을 클릭하여 설정 누락이 없는지 1차 확인합니다.
   - 실패(FAIL)나 경고(WARN) 항목이 있다면 우측의 `가이드`를 참고하여 환경변수나 설정을 수정합니다.
   - 이후 `[Smoke Test 실행]` (read_only)를 클릭해 API들이 타임아웃이나 500 에러 없이 정상 응답하는지 확인합니다.
   - 필요한 경우 `full` 모드로 전환하여 실제 Slack 알림이 잘 가는지까지 E2E로 점검할 수 있습니다.
3. **기대 효과**: 사람의 실수로 인한 환경 설정 누락을 빠르게 캐치하고, 장애 조치 시스템 자체가 장애를 일으키는 상황을 방지합니다.