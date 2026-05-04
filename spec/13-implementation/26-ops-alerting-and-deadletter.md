# 26-ops-alerting-and-deadletter (실패 알림, Dead-letter 이슈화 및 서킷 브레이커)

## 목적
운영 자동화 작업(백로그 투입, 월간 요약 등)이 실패했을 때, 단순 로그를 넘어 **적극적인 운영자 개입**이 가능하도록 알림(Webhook)과 GitHub 이슈(Dead-letter)를 생성합니다.
또한 GitHub API Rate Limit 초과나 권한 문제로 인한 연쇄적인 실패 폭주를 방지하기 위해 **Circuit Breaker(서킷 브레이커)** 패턴을 도입합니다.

## 주요 기능
### 1. 알림 (Webhook)
- **대상**:
  - 재시도 큐에서 최종 실패하여 `dead` 상태가 된 작업
  - 재시도가 불가능한 치명적 에러(`AUTH`, `PERMISSION`, `MISSING_CONFIG`)가 발생한 즉시
- **설정**: 환경변수 `OPS_ALERT_WEBHOOK_URL` (또는 `OPS_ALERT_WEBHOOK_URL_{GATEKEY_UPPER}`)

### 2. Dead-letter 자동 이슈화
- **조건**: 작업이 `dead` 상태로 전환될 때, 해당 GateKey의 GitHub 설정이 존재하고 토큰이 유효한 경우.
- **내용**: 에러 내용, 시도 횟수, 해결 가이드(플레이북) 링크 등을 포함한 이슈 생성.
- **멱등성**: `ops_retry_jobs` 문서 내 `deadIssue` 필드에 생성된 이슈 정보를 저장하여 중복 생성을 방지합니다.

### 3. Circuit Breaker (서킷 브레이커)
- **목적**: GitHub API Rate Limit 초과(`GITHUB_RATE_LIMIT`) 시, 설정된 시간(예: 1시간) 동안 불필요한 API 호출을 차단(`open`)하여 토큰이 완전히 잠기는 것을 막습니다.
- **상태**:
  - `closed`: 정상 동작
  - `open`: API 호출 차단 (즉시 에러 반환)
  - `half_open`: 차단 시간 만료 후 1회 테스트 호출 허용
- **저장소**: Firestore `ops_circuit_breakers` 컬렉션 (`{gateKey}:github` 문서)

## 운영 가이드
- 서킷 브레이커가 `open` 상태일 경우, Ops Console의 재시도 현황 패널에서 차단 해제 예정 시간(`openUntil`)을 확인할 수 있습니다.
- 차단 시간이 지나기 전에 긴급히 조치(토큰 교체 등)를 완료했다면, DB에서 해당 브레이커 문서의 `state`를 `closed`로 수동 변경할 수 있습니다.
