# Ops Backlog Project Automation

## 1) 목적
- Ops Console에서 자동 생성된 GitHub Issue를 GitHub Project V2(칸반 등)에 자동으로 투입(Add)한다.
- 투입 후, 이슈의 심각도(Severity)에 따라 프로젝트의 Status 및 Priority 필드를 자동으로 매핑하여 세팅한다.

## 2) 멱등성 보장 (Deduplication)
- 이미 Project에 투입된 이슈가 중복으로 추가되거나 불필요한 API 호출을 발생시키지 않도록 Firestore 락(Lock)을 활용한다.
- 컬렉션: `ops_backlog_issue_project_links`
- 문서 ID(projectDedupeKey): `pilot-gate:{date}:{slotId}:project` (기존 이슈 dedupeKey에 `:project` suffix 추가)
- `create()`를 사용하여 ALREADY_EXISTS(409) 시 투입을 건너뛴다(`skipped`).

## 3) 요구 환경변수 및 Secrets
Functions 또는 `.env` 설정에 다음 값이 필요하다.

- `GITHUB_TOKEN_BACKLOG_BOT`: GitHub Project V2에 접근하고 아이템을 추가/수정할 수 있는 토큰 (scope: `repo`, `project`)
- `GITHUB_PROJECT_ID`: 대상 Project V2의 전역 Node ID (예: `PVT_...`)
- `GITHUB_PROJECT_FIELD_STATUS_ID`: (선택) Project 내 'Status' 필드의 Node ID
- `GITHUB_PROJECT_FIELD_PRIORITY_ID`: (선택) Project 내 'Priority' 필드의 Node ID

## 4) Project V2 설정 SSOT 자동화 (Discovery + Alias 매핑)
과거에는 Project ID나 Field ID를 GraphQL로 조회하여 소스 코드나 환경 변수에 하드코딩해야 했으나, 이제 **설정 SSOT 갱신(Discovery) API**를 통해 자동으로 해결된다.

특히 필드 이름이 영어(`Status`, `Priority`)가 아니거나 한글(`상태`, `우선순위`), 다른 옵션명(`진행중`, `긴급`)을 사용하더라도 내장된 **Alias 정규화 매핑**을 통해 유연하게 매칭된다.

- **API**: `POST /v1/ops/reports/pilot-gate/backlog/project/discover`
- **저장소**: Firestore `ops_github_project_config/pilot-gate`
- **동작**: GraphQL API를 호출해 Project V2의 필드 메타데이터(Status, Priority 등)를 확보하고 내장된 Alias와 비교하여 `resolved` 매핑을 완성한다.
- Ops Console UI의 **`[Project 설정 갱신(Discover)]`** 버튼을 클릭하여 1회 초기 설정 및 변경 시 갱신을 수행할 수 있다.

**매핑 실패(Missing Mappings) 대응 절차:**
- Discover 실행 시 매칭되지 않은 필드나 옵션은 `missingMappings` 배열에 기록되며 UI에 경고로 노출된다.
- 대응 방법 (Ops Console UI):
  1. `[Project 설정 갱신(Discover)]`을 클릭하여 최신 rawFields 확보.
  2. 주황색 경고창에 뜬 `missingMappings` 항목들을 확인.
  3. 아래쪽 **"Custom Alias 편집 (JSON)"** 창에 매핑할 단어를 추가 (예: `{"optionAliases": {"status.todo": ["접수대기"]}}`).
  4. `[Alias 저장 + Resolve]` 클릭하여 갱신.
  5. 경고창이 사라지고 **"설정 완벽함"** 뱃지가 뜨면 `[프로젝트 투입(Project)]`을 재시도한다.

## 5) UI 흐름 (분리 모델)
- "이슈 생성"과 "프로젝트 투입"을 2개의 개별 버튼으로 분리하여 구현했다.
- 이유: Project ID 누락, GraphQL 타임아웃, 토큰 스코프 부족 등 프로젝트 투입 단계의 실패 가능성이 이슈 생성보다 높기 때문이다.
- 분리함으로써 이슈는 정상 생성되었으나 프로젝트 투입만 실패했을 경우, 에러 조치 후 '투입' 버튼만 재시도하여 복구할 수 있다.
