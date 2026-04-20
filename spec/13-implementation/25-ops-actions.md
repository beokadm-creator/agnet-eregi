# 25-ops-actions (순수 비즈니스 로직 분리)

## 목적
Express 라우터(HTTP 요청/응답)에 강하게 결합된 자동화 로직들을 순수 함수(Pure Action) 형태로 분리합니다. 이를 통해:
1. **재사용성 향상**: HTTP API, 재시도 워커(Retry Worker), 스케줄러(Cron) 등 다양한 진입점에서 동일한 로직을 안전하게 호출할 수 있습니다.
2. **테스트 용이성**: `req`, `res` 객체 모킹 없이 인자만 전달하여 단위 테스트가 가능해집니다.
3. **단절 방지**: 워커에서 HTTP 루프백 호출(API 자신을 다시 호출하는 방식)을 제거하여 불필요한 네트워크 오버헤드와 인증 문제를 해결합니다.

## 분리 대상 (예정)
`firebase-react/functions/src/routes/v1/reports.ts` 내의 주요 비즈니스 로직들을 `firebase-react/functions/src/lib/ops_actions.ts` 로 이동합니다.

- `generateMonthlyReport(gateKey, month, dryRun, ...)`
- `dispatchWorkflow(gateKey, month, ...)`
- `createBacklogIssues(gateKey, date, ...)`
- `discoverProjectConfig(gateKey, ...)`
- `resolveProjectConfig(gateKey, ...)`
- `addIssuesToProject(gateKey, date, ...)`

## 구현 방향
각 Action 함수는 파라미터로 필요한 데이터만 받고, 성공 시 결과 객체를, 실패 시 명시적인 `Error`를 던지도록(Throw) 구현합니다. 로깅(`logOpsEvent`)은 Action 내부 또는 호출부(Router/Worker)에서 일관되게 처리합니다.
