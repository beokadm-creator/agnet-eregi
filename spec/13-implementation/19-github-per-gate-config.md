# GateKey별 GitHub 설정/토큰 분리 (per-gate config)

## 1) 목적
멀티 테넌시(gateKey) 확장에 이어, 각 gateKey마다 독립적인 외부 시스템(GitHub)과 연동할 수 있도록 설정 체계를 분리한다. 이를 통해 특정 게이트는 A 리포지토리/A 칸반에, 다른 게이트는 B 리포지토리/B 칸반에 자동화된 이슈와 로그를 적재할 수 있다.

## 2) 데이터 모델: `ops_github_project_config/{gateKey}`
기존의 필드 매핑 락/설정 외에 아래와 같은 `github` 및 `rules` 정보를 함께 저장한다.

```ts
{
  gateKey: string,
  github: {
    owner: string,      // 예: "beokadm-creator"
    repo: string,       // 예: "agnet-eregi"
    projectId: string,  // 예: "PVT_..."
    tokenRef: string,   // 토큰 그 자체가 아니라, 토큰이 담긴 환경 변수/Secret Manager의 Key
  },
  rules: {
    sevToPriority: { "1": "p0", "2": "p1", "3": "p2" },
    sevToStatus: { "1": "todo", "2": "todo", "3": "todo" },
    issueLabels: ["ops", "automation", "backlog"]
  },
  // ... existing resolved, customAliases, missingMappings 등
}
```

### 보안 원칙 (Security Principle)
- 실제 **GitHub 토큰은 절대로 Firestore 등 DB에 평문으로 저장하지 않는다**.
- 오직 어떤 환경 변수/Secret를 읽을 것인지를 지시하는 `tokenRef` (예: `GITHUB_TOKEN_BACKLOG_BOT`)만 저장하고, 서버 런타임에서 이를 해석하여 동적으로 인증을 수행한다.

## 3) 서버 동작 흐름 (Functions)
1. **GitHub Issue 생성 (`/project/add`, `/issues/create`)**:
   - `ops_github_project_config/{gateKey}`를 조회하여 현재 게이트에 매핑된 `owner`, `repo`, `tokenRef`를 확보한다.
   - `process.env[tokenRef]`로 실제 토큰을 읽어 GitHub REST API를 호출한다.
   - 이슈 생성 시 `rules.issueLabels` 및 심각도에 따른 동적 라벨을 적용한다.
2. **Project V2 투입 및 필드 변경 (`/project/discover`, `/project/resolve`)**:
   - 동일하게 `projectId`, `tokenRef`를 읽어 GraphQL API로 칸반에 이슈를 추가하고 상태/우선순위를 업데이트한다.

## 4) 운영 콘솔 UI (Ops Console)
- "백로그 후보" 영역 최상단에 **"⚙️ GitHub 연동 설정 (GateKey: {gateKey})"** 섹션을 노출한다.
- 운영자는 UI에서 `Owner`, `Repo`, `Project Node ID`, `Token Ref`를 직접 기입하고 `[설정 저장]` 버튼을 통해 즉시 현재 게이트의 타겟을 변경할 수 있다.

## 5) 권장 운영 순서
1. **Gate 선택**: 상단 드롭다운에서 작업할 `gateKey`를 선택한다.
2. **GitHub 설정 저장**: ⚙️ 연동 설정 패널에서 올바른 저장소/프로젝트 정보를 기입 후 저장한다.
3. **Discover 실행**: `[Project 설정 갱신(Discover)]` 버튼을 눌러 최신 필드 맵(상태/우선순위)을 가져온다.
4. **누락 매핑 해결**: 주황색 `missingMappings` 경고가 뜬다면 Custom Alias(JSON)를 추가하고 재매칭하여 초록색 **"설정 완벽함"** 뱃지를 확인한다.
5. **투입**: `[백로그 이슈 생성]` -> `[프로젝트 투입]`을 차례로 실행하여 파이프라인을 완료한다.