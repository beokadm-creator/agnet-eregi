# 24-ops-audit-events (운영 감사 및 추적 이벤트 로깅)

## 목적
Ops Console에서 수행되는 모든 운영/자동화 액션의 결과를 중앙 집중식(SSOT)으로 기록하여, **"누가, 언제, 어떤 이유로 어떤 대상에 대해 어떤 액션을 수행했는가"**를 쉽게 추적하고 모니터링할 수 있도록 합니다. 이를 통해 장애 발생 시 빠른 원인 파악 및 대응(Playbook 실행)이 가능합니다.

## 이벤트 스키마 (ops_audit_events 컬렉션)
각 이벤트는 Firestore의 `ops_audit_events` 컬렉션에 단일 문서로 저장됩니다.

```typescript
{
  gateKey?: string;            // 대상 GateKey (e.g. "pilot-gate")
  action: string;              // 표준화된 Action Key (아래 참조)
  status: "success" | "fail";  // 결과 상태
  actorUid: string;            // 이벤트를 트리거한 사용자의 UID (시스템 자동화의 경우 "system")
  requestId: string;           // 연관된 API Request ID (로깅/추적용)
  target?: {                   // Action과 연관된 타겟 데이터 (Action별로 상이)
    date?: string;             // (예) "2026-04-20"
    month?: string;            // (예) "2026-04"
    issueUrl?: string;         // (예) 생성된 이슈의 URL
    dedupeKey?: string;        // (예) 백로그 이슈의 중복 제거 키
    [key: string]: any;
  };
  summary: string;             // UI에 노출될 간단한 요약 텍스트
  error?: {                    // status === "fail" 인 경우 상세 에러 정보
    code?: string;
    message?: string;
  };
  createdAt: Timestamp;        // 서버에서 생성된 타임스탬프
}
```

## Action Key 표준화 목록
| Action Key            | 설명 |
| --------------------- | --- |
| `daily.append`        | 일일 로그 SSOT에 저장 |
| `issue.create`        | GitHub 이슈 생성 (누락건 백로그 전환) |
| `project.add`         | GitHub Project에 이슈 투입 |
| `project.discover`    | GitHub Project 설정 갱신 (Status/Priority 동기화) |
| `project.resolve`     | GitHub Project Custom Alias 재매칭 |
| `monthly.generate`    | 월간 요약 리포트(마크다운 포함) 생성 |
| `workflow.dispatch`   | 월간 요약 PR 생성을 위한 GitHub Actions Workflow 실행 |

## 운영 가이드 및 정책
1. **보관 기간/용량 정책**
   - 해당 데이터는 90일 보관을 원칙으로 하며, Firestore TTL 기능을 적용하여 자동 삭제되도록 설정하는 것을 권장합니다. (필요 시 영구 보존용 BigQuery 연동 파이프라인 추가 가능)
2. **UI 모니터링**
   - Ops Console의 "🧾 자동화 실행 로그" 섹션을 통해 `gateKey` 기준 최근 50개의 이벤트를 실시간으로 확인할 수 있습니다.
   - Request ID를 복사하여 서버 로그(`logError` 등)와 교차 검증할 수 있습니다.

## Error Category 표준 + 대응
실패 이벤트는 에러 메시지를 기반으로 아래와 같이 자동 분류(Category)되며, 재시도 여부(Retryable)가 결정됩니다.

| Category | 발생 원인 및 힌트 | Retryable |
| :--- | :--- | :--- |
| `AUTH` | GitHub 인증 실패 (401, 403, Bad credentials). 토큰 권한 및 유효성을 점검해야 합니다. | **False** (즉시 Dead) |
| `PERMISSION` | 해당 작업을 수행할 권한이 부족함 (예: projectV2 read/write 권한). | **False** |
| `MISSING_CONFIG` | GitHub 연동 설정(Token 등)이 누락되었거나 환경변수에 값이 없습니다. | **False** |
| `MISSING_MAPPING` | Project 설정에 필드나 옵션 매핑이 누락되었습니다. Alias 설정을 먼저 확인해야 합니다. | **False** |
| `GITHUB_RATE_LIMIT` | GitHub API 호출 한도 초과 (429 등). | **True** (백오프 재시도) |
| `NETWORK` | 일시적인 네트워크 통신 오류 (Timeout, ENOTFOUND, 502 등). | **True** (백오프 재시도) |
| `UNKNOWN` | 기타 분류되지 않은 오류. (일시적일 수 있으므로 일단 재시도 큐에 삽입) | **True** |

## 장애 대응 플레이북

<a id="action-workflowdispatch-fail"></a>
- **Action: `workflow.dispatch` / `AUTH`, `MISSING_CONFIG` Fail**
  - **원인 추정:** 토큰 권한 문제, 워크플로우 파일(yml) 부재, 잘못된 `gateKey` 또는 `month` 형식 등.
  - **대응:** 
    1. UI에서 `error.message` 확인.
    2. "GitHub 연동 설정"에서 `Token Ref (Actions)` 또는 `Token Ref (Issues)`에 지정된 환경변수 이름이 실제 서버에 적용되어 있는지 확인.
    3. 토큰에 `actions: write` 권한이 부여되어 있는지 점검.

- **Action: `issue.create` Fail**
  - **원인 추정:** `GITHUB_TOKEN` 부재, Repository 경로 오류, GitHub API Rate Limit 초과.
  - **대응:**
    1. UI의 에러 로그 및 Request ID 확인.
    2. `Token Ref (Issues)` 설정값 확인.
    3. 동일한 Dedupe Key를 가진 이슈가 이미 존재하는지(ALREADY_EXISTS 에러) 확인 (이 경우 스킵 처리됨).

<a id="action-projectdiscover-fail"></a>
- **Action: `project.discover` / `MISSING_MAPPING` Fail**
  - **원인 추정:** GitHub GraphQL API 권한 부족 (ProjectV2 권한 필요), Project Node ID 오류, 또는 매핑 대상 필드(Status/Priority)를 찾을 수 없음.
  - **대응:**
    1. 토큰의 `project` 관련 스코프(또는 세부 권한) 확인.
    2. Project Node ID (`PVT_...`)가 올바른지 재확인.
    3. Custom Alias (JSON)를 갱신하고 재매칭을 시도.
