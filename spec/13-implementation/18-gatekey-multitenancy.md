# GateKey 멀티 테넌시 확장

## 1) 목적
- 모든 자동화와 리포트 기능이 `pilot-gate`에 하드코딩된 것을 제거한다.
- `gateKey` (예: `pilot-gate`, `partner-gate`, `billing-gate`)를 파라미터로 받아 다수의 게이트를 독립적으로 운영할 수 있도록 확장한다.

## 2) 라우트 파라미터화
- 기존 경로: `/v1/ops/reports/pilot-gate/...`
- 신규 표준 경로: `/v1/ops/reports/:gateKey/...`
- 하위 호환: 기존에 호출되던 `/pilot-gate/...` 경로는 자연스럽게 `:gateKey`가 `"pilot-gate"`로 바인딩되면서 100% 동일하게 동작한다. (1~2주 후 레거시로 간주하고 클라이언트에서 완전히 걷어낸 후 별도 조치 가능)
- 정규식을 통한 보안: `gateKey`는 `^[a-z0-9-]+$` 패턴만 허용하며, 그 외 문자가 들어오면 `400 INVALID_ARGUMENT`로 즉시 차단된다.

## 3) Firestore 데이터 격리 (SSOT / 락)
`gateKey`에 따라 Firestore 문서를 격리하여 충돌을 방지한다.
- **일일 SSOT (`ops_daily_logs`)**:
  - 기존(pilot-gate): `{date}`
  - 신규: `{gateKey}:{date}`
- **이슈 멱등 락 (`ops_backlog_issues`)**:
  - 기존: `pilot-gate:{date}:{slotId}`
  - 신규: `{gateKey}:{date}:{slotId}`
- **프로젝트 투입 락 (`ops_backlog_issue_project_links`)**:
  - 기존: `pilot-gate:{date}:{slotId}:project`
  - 신규: `{gateKey}:{date}:{slotId}:project`
- **프로젝트 설정 SSOT (`ops_github_project_config`)**:
  - 기존: `pilot-gate`
  - 신규: `{gateKey}`
- **Evidence 컬렉션**:
  - 기존: `pilot_gate_evidence`
  - 신규: `{gateKey}_evidence` (하이픈은 언더스코어로 치환, 예: `partner_gate_evidence`)

## 4) Ops Console 연동
- 화면 상단에 Gate Key 선택기(Dropdown)를 추가하여, 운영자가 원하는 대상(`pilot-gate`, `partner-gate` 등)을 선택한 뒤 전체 워크플로우(SSOT 저장, 이슈 생성, 프로젝트 투입)를 제어할 수 있게 하였다.
- 선택된 `gateKey`는 모든 API 호출 시 URL의 `{gateKey}` 자리에 동적으로 주입된다.

## 5) 백로그 동기화 스크립트 (ops_log_sync.mjs)
- `GATE_KEY` 환경 변수를 추가로 주입받아 (기본값: `pilot-gate`), 해당 게이트에 맞는 SSOT 문서(`{gateKey}:{YYYY-MM-DD}`)를 조회하도록 보강하였다.
- 마크다운 생성 시 렌더링되는 날짜 ID는 prefix를 제거한 순수 `YYYY-MM-DD` 형태가 되도록 시각적 일관성을 유지한다.