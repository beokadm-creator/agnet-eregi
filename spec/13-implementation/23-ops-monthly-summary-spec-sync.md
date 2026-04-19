# 월간 요약 자동 삽입 파이프라인 (Ops Monthly Summary Sync)

## 1) 목적
앞선 단계에서 `ops_monthly_reports`에 생성해 둔 "월간 트렌드 요약(Markdown Summary)"을 GitHub Repository의 `spec/00-index/` 폴더 내 Markdown 문서에 안전하게 자동 삽입/갱신한다. 이를 통해 개발팀과 비즈니스 파트너가 별도의 시스템에 접속하지 않고도, 코드 저장소 내에서 월간 리포트를 열람하고 PR을 통해 검토할 수 있다.

## 2) 마커(Marker) 기반 치환 전략
수동으로 작성된 문서 영역을 침범하지 않도록, **마커(Marker)로 둘러싸인 구간만 덮어쓰는 방식**을 사용한다.
- **마커**:
```md
<!-- OPS_MONTHLY_SUMMARY_AUTO:START -->
... (이곳의 내용이 자동 치환됨)
<!-- OPS_MONTHLY_SUMMARY_AUTO:END -->
```
- 문서를 파싱할 때 이 두 마커의 인덱스를 찾아 그 안의 내용만 Firestore에서 가져온 최신 `markdownSummary`로 교체한다. 마커가 존재하지 않는 새 문서의 경우 파일 맨 끝에 마커와 함께 내용을 추가한다.

## 3) 파일 출력 모드 (`OUTPUT_MODE`)
스크립트는 환경 변수 `OUTPUT_MODE`에 따라 두 가지 방식으로 동작한다.
1. **`separate` (권장/기본값)**: 
   월간 요약 전용 파일을 별도로 생성한다.
   - `spec/00-index/{YYYY-MM}-{gateKey}-ops-monthly-summary.md` (단, `pilot-gate`는 호환성을 위해 `-pilot-ops-monthly-summary.md` 사용)
2. **`append-to-log`**: 
   매일 누적되는 일일 로그 파일(`.github/workflows/ops-log-sync.yml`에서 생성한 파일) 하단에 마커 구간을 두어 삽입한다.
   - `spec/00-index/{YYYY-MM}-{gateKey}-ops-log.md`

## 4) GitHub Action 매트릭스 구성
- **파일**: `.github/workflows/ops-monthly-summary-sync.yml`
- **책임 분리**: 기존 일일 로그 동기화 Action과 분리하여, 서로의 실행 주기와 커밋/PR 충돌을 방지한다.
- **실행 주기**: 매일 새벽(`15 15 * * *` UTC)에 동작하여 일일 로그 생성 직후에 최신 집계본을 반영한다.
- **동작 방식**: 
  - `gateKey` 배열을 입력받아 **Matrix Job**으로 병렬 실행한다.
  - 스크립트 실행 후 파일에 변경점(`git status --porcelain`)이 생겼을 때만 브랜치를 따고 Commit & Push를 수행한다.
  - 브랜치명: `bot/ops-monthly-summary-{gateKey}-{YYYY-MM}`
  - 이미 해당 브랜치로 열린 PR이 있으면 Push를 통해 강제로 내용을 갱신(`-f`)하고, 없으면 새로 PR을 생성한다.

## 5) 콘솔에서 PR 링크 조회 API 연동
운영자가 GitHub 저장소에 접속해 수동으로 PR을 찾지 않도록 Ops Console 내에서 직행 링크를 제공한다.
- **엔드포인트**: `GET /v1/ops/reports/:gateKey/monthly/pr?month=YYYY-MM`
- **동작 방식**:
  1. `ops_github_project_config/{gateKey}`에서 해당 게이트에 할당된 `owner`, `repo`, `tokenRef`를 조회한다.
  2. 서버 런타임 환경변수(`process.env[tokenRef]`)에서 GitHub Token을 확보한다.
  3. GitHub REST API(`GET /repos/{owner}/{repo}/pulls`)를 호출하여 `head` 브랜치명이 `bot/ops-monthly-summary-{gateKey}-{YYYY-MM}`인 열린(Open) PR을 검색한다.
  4. PR이 존재하면 `prNumber`, `url`, `title` 등의 메타데이터를 반환하고, UI에서 "↗️ PR 열기" 링크로 렌더링한다. 없으면 "⚠️ 생성된 PR 없음"을 명시적으로 안내한다.

## 6) 게이트 추가 절차
새로운 `gateKey`를 도입할 경우:
1. 기존 데이터 파이프라인(UI, Functions)을 통해 `ops_monthly_reports` 문서가 한 번 이상 `generate` 되었는지 확인한다.
2. `.github/workflows/ops-monthly-summary-sync.yml`의 `gate_keys` 배열 기본값에 신규 게이트 키를 추가한다.
3. 다음 날 새벽부터 자동으로 새 게이트에 대한 월간 리포트 PR이 생성되는지 모니터링한다.