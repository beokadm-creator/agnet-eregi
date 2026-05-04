# Ops Log Sync - GitHub Action 매트릭스 확장

## 1) 목적
이전 단계까지 적용된 `gateKey` 기반 멀티 테넌시 구조를 CI/CD 파이프라인(GitHub Actions)에도 연장 적용한다.
각 게이트별로 월간 운영 로그(SSOT)를 추출하여 마크다운 문서로 만들고 PR을 생성하는 작업을 독립적인 Job(Matrix)으로 분리하여 자동화한다.

## 2) Workflow 매트릭스 전략
- **파일**: `.github/workflows/ops-log-sync.yml`
- **동작**:
  1. `prepare` Job: 수동 실행(`workflow_dispatch`) 시 입력받은 `gate_key` 또는 기본 배열(`["pilot-gate", "partner-gate", "billing-gate"]`)을 JSON 배열로 직렬화하여 출력(`gate_keys`)한다.
  2. `sync` Job: `prepare`에서 만든 배열을 바탕으로 `strategy.matrix.gateKey`를 구성하여 N개의 Job을 병렬(또는 순차)로 생성한다.
  3. 각 `sync` Job 내부에서는 `concurrency: group: ops-log-sync-${{ matrix.gateKey }}`를 설정하여 동일 게이트에 대한 중복 실행만 방지한다. 서로 다른 게이트는 동시 실행된다.

## 3) 스크립트 수정 (`ops_log_sync.mjs`)
- 환경 변수 `GATE_KEY`를 필수로 요구한다.
- Firestore에서 SSOT를 조회할 때, `startId`와 `endId`에 해당 게이트의 접두사를 포함시켜 쿼리 범위를 격리한다. (단, `pilot-gate`는 기존 데이터 호환성을 위해 접두사 없이 쿼리)
- 마크다운을 렌더링할 때, 일자 표시(`displayId`)는 `gateKey` 접두사를 뗀 순수 날짜 문자열(`YYYY-MM-DD`)이 되도록 치환한다.

## 4) 출력 파일 네이밍 및 PR 생성
- **마크다운 산출물**: `spec/00-index/{YYYY-MM}-{gateKey}-ops-log.md`
  - (단, `pilot-gate`의 경우 기존 문서와의 호환을 위해 `{YYYY-MM}-pilot-ops-log.md`를 유지한다.)
- **PR 브랜치 및 제목**:
  - 브랜치: `bot/ops-log-sync-{gateKey}-{KST_DATE}`
  - 타이틀: `chore(ops): sync ops log {YYYY-MM} ({gateKey})`
- 위와 같이 브랜치와 타이틀에 `gateKey`를 명시하여 여러 게이트의 로그 동기화가 동시에 일어나더라도 PR 경합이나 파일 덮어쓰기 등의 충돌이 발생하지 않는다.

## 5) 게이트 추가 운영 절차
새로운 게이트가 비즈니스 로직에 추가될 경우 다음 단계를 거쳐 파이프라인에 편입한다.
1. 소스 코드 및 UI(Ops Console)에서 신규 `gateKey`를 처리하도록 추가한다.
2. `.github/workflows/ops-log-sync.yml`의 `prepare` Job 내 fallback 배열(기본값)에 신규 `gateKey` 문자열을 추가한다.
3. 해당 게이트에서 발생하는 이슈/로그가 정상적으로 Firestore에 쌓이면, 매일 새벽 자동으로 매트릭스 잡에 편입되어 PR이 올라온다.