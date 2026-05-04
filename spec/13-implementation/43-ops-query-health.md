# Ops Query Health (쿼리 상태 모니터링)

## 1. 개요
Firestore의 강력한 쿼리 제약 조건(복합 인덱스 누락 등)으로 인해 서비스 운영 중 API가 갑작스레 500 에러를 뱉는 상황을 방지합니다.
"FAILED_PRECONDITION: index required"와 같은 치명적인 에러를 사전에 수집하고 대시보드에 노출시켜, 사용자가 에러를 겪기 전에 운영자가 선제 조치할 수 있도록 돕습니다.

## 2. 수집 방식
- **에러 핸들러 연동**: 주요 API의 예외 처리 블록(`catch (e)`)에 `captureQueryHealthError`를 호출합니다.
- **수집 조건**: 에러 메시지가 `FAILED_PRECONDITION` 또는 `index`와 관련된 문구를 포함할 때만.
- **노이즈 컨트롤**:
  - 동일한 `gateKey`와 `queryName`으로 1시간 내에 발생한 에러는 추가 로깅하지 않고 생략(Dedup)합니다.
  - 최초 1회 발생 시에만 `ops_query_health` 컬렉션에 문서를 생성하고, Slack 알림(`ops_alert.notify`)을 발송합니다.

## 3. Ops Console 대시보드
- **UI 섹션**: 🩺 Query Health (Missing Index / Failed Queries)
- **표시 항목**: 최근 발생한 에러 내역, 관련된 쿼리 이름, 상세 에러 메시지(Index 생성 링크 포함).
- **상태 관리**:
  - `open`: 새로 발견되어 조치가 필요한 쿼리.
  - `resolved`: 운영자가 Firebase Console에서 인덱스를 추가한 후, UI에서 `[해결]` 버튼을 눌러 상태를 변경한 쿼리.
- **조치 방법**:
  - 에러 메시지에 포함된 URL(예: `https://console.firebase.google.com/v1/r/project/...`)을 클릭하여 즉시 인덱스를 생성합니다.
  - 생성이 완료되면 Ops Console에서 `[해결]` 버튼을 눌러 목록에서 지웁니다.

## 4. 연관 컬렉션 및 Audit
- **`ops_query_health`**: 이슈의 원본 데이터와 상태(`open` / `resolved`) 관리.
- **`ops_audit_events`**:
  - `ops_query_health.event` (새로운 에러 감지)
  - `ops_query_health.resolve` (운영자의 수동 해결 처리)
- **알림**: `ops_query_health` 트리거를 통한 Slack 알림(Severity: `warning`).