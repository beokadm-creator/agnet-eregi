# Ops Backlog Issue Automation

## 1) 목적
- Ops Console에서 수집한 "일일 Gate 검증 실패 Top3 이슈"를 GitHub Issue로 자동 생성하여 개발 백로그에 등록한다.
- 멱등성을 보장하여 동일 날짜/동일 이슈에 대해 중복 생성을 방지한다.

## 2) 데이터 모델 (SSOT 확장)
- `ops_daily_logs/{date}` 문서에 `topIssues` 필드를 배열로 추가하여 저장한다.
  - 구조: `Array<{ slotId: string, severity: string, impactCount: number }>`
- 이 필드는 Markdown 본문과 분리되어, GitHub Issue 생성 시 구조화된 데이터를 기반으로 동작한다.

## 3) 중복 방지 (멱등성 보장)
- Firestore `ops_backlog_issues` 컬렉션을 활용해 생성 락(Lock)을 잡는다.
- 문서 ID(dedupeKey): `pilot-gate:{date}:{slotId}`
- `create()` 함수를 호출하여 ALREADY_EXISTS(409) 에러가 발생하면 이미 이슈가 생성된 것으로 간주하고 생성 절차를 `skip`한다.

## 4) 환경변수 및 토큰 설정
- GitHub API 호출을 위해 서버(Functions) 환경 변수 또는 Secret으로 `GITHUB_TOKEN_BACKLOG_BOT`이 설정되어야 한다.
- 요구 권한: `repo` 범위(Issues Read/Write).
- GitHub Action에서 PR을 생성할 때 사용하는 `GITHUB_TOKEN`과 별도로 운영/관리 봇 계정의 토큰을 분리하여 주입하는 것을 권장한다.

## 5) API 사용법 (dryRun)
- `POST /v1/ops/reports/pilot-gate/backlog/issues/create`
- `dryRun: true`를 파라미터로 넘기면 실제 GitHub Issue를 생성하거나 Firestore 멱등 문서를 만들지 않고, 어떤 이슈가 생성될지 배열 형태로 미리 반환한다.
