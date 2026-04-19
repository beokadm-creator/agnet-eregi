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

## 4) Project V2 ID 획득 방법 (GraphQL Discovery)
Project ID나 Field ID는 GitHub GraphQL API를 통해 조회해야 한다. (다음 패킷에서 자동화 스크립트로 제공 가능)
수동으로 얻으려면 GitHub CLI(`gh`)를 활용하여 아래와 같은 쿼리를 실행한다.

```graphql
query{
  organization(login: "ORG_NAME") {
    projectV2(number: 1) {
      id
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
        }
      }
    }
  }
}
```

## 5) UI 흐름 (분리 모델)
- "이슈 생성"과 "프로젝트 투입"을 2개의 개별 버튼으로 분리하여 구현했다.
- 이유: Project ID 누락, GraphQL 타임아웃, 토큰 스코프 부족 등 프로젝트 투입 단계의 실패 가능성이 이슈 생성보다 높기 때문이다.
- 분리함으로써 이슈는 정상 생성되었으나 프로젝트 투입만 실패했을 경우, 에러 조치 후 '투입' 버튼만 재시도하여 복구할 수 있다.
