# Ops RBAC & Confirm (Spec 31)

## Scope

- 서버: Ops API에 RBAC(requiredRole) 적용 및 거부 시 `ops_auth.denied` 감사 로그 남김
- 프론트: Firebase custom claims(`opsRole`) 기반으로 위험 작업 버튼/섹션 disable + 공통 Confirm 모달 적용

## Ops Role

- `ops_viewer`: 조회 전용
- `ops_operator`: 운영 액션(재시도/발송/생성 등) 수행
- `ops_admin`: 설정 변경/차단 해제 등 위험 작업 수행

## Endpoint Role Matrix

### Reports

| Endpoint | Method | requiredRole |
|---|---:|---|
| `/v1/ops/reports/:gateKey/daily.md` | GET | ops_viewer |
| `/v1/ops/reports/:gateKey/daily` | GET | ops_viewer |
| `/v1/ops/reports/:gateKey/daily/ssot` | GET | ops_viewer |
| `/v1/ops/reports/:gateKey/daily/ssot/recent` | GET | ops_viewer |
| `/v1/ops/reports/:gateKey/daily/append` | POST | ops_operator |
| `/v1/ops/reports/:gateKey/monthly` | GET | ops_viewer |
| `/v1/ops/reports/:gateKey/monthly/pr` | GET | ops_viewer |
| `/v1/ops/reports/:gateKey/monthly/workflow-run` | GET | ops_viewer |
| `/v1/ops/reports/:gateKey/monthly/workflow-run/dispatch` | POST | ops_operator |
| `/v1/ops/reports/:gateKey/monthly/generate` | POST | ops_admin |
| `/v1/ops/reports/:gateKey/recent` | GET | ops_viewer |
| `/v1/ops/reports/:gateKey/by-case` | GET | ops_viewer |
| `/v1/ops/reports/:gateKey/backlog.md` | GET | ops_viewer |
| `/v1/ops/reports/:gateKey/backlog` | POST | ops_operator |
| `/v1/ops/reports/:gateKey/backlog/issues/create` | POST | ops_operator |
| `/v1/ops/reports/:gateKey/backlog/issues/project/add` | POST | ops_operator |

### Backlog Project Config

| Endpoint | Method | requiredRole |
|---|---:|---|
| `/v1/ops/reports/:gateKey/backlog/project/config` | GET | ops_viewer |
| `/v1/ops/reports/:gateKey/backlog/project/discover` | POST | ops_admin |
| `/v1/ops/reports/:gateKey/backlog/project/config/github` | PATCH | ops_admin |
| `/v1/ops/reports/:gateKey/backlog/project/config/aliases` | PATCH | ops_admin |
| `/v1/ops/reports/:gateKey/backlog/project/resolve` | POST | ops_operator |

### Audit

| Endpoint | Method | requiredRole |
|---|---:|---|
| `/v1/ops/audit-events` | GET | ops_viewer |
| `/v1/ops/audit-events/:id` | GET | ops_viewer |
| `/v1/ops/reports/:gateKey/audit/recent` | GET | ops_viewer |
| `/v1/ops/audit/recent` | GET | ops_viewer |
| `/v1/ops/reports/:gateKey/audit/retry` | POST | ops_operator |

### Retry / Dead-letter

| Endpoint | Method | requiredRole |
|---|---:|---|
| `/v1/ops/retry/recent` | GET | ops_viewer |
| `/v1/ops/retry/:jobId/deadletter/issue` | POST | ops_operator |

### Circuit Breaker

| Endpoint | Method | requiredRole |
|---|---:|---|
| `/v1/ops/reports/:gateKey/circuit-breaker` | GET | ops_viewer |
| `/v1/ops/reports/:gateKey/circuit-breaker/reset` | POST | ops_admin |

### Gate Settings

| Endpoint | Method | requiredRole |
|---|---:|---|
| `/v1/ops/gates/:gateKey/settings` | GET | ops_viewer |
| `/v1/ops/gates/:gateKey/settings/history` | GET | ops_viewer |
| `/v1/ops/gates/:gateKey/settings` | PUT | ops_admin |

### Alerts

| Endpoint | Method | requiredRole |
|---|---:|---|
| `/v1/ops/alerts/test` | POST | ops_operator |

### Packages

| Endpoint | Method | requiredRole |
|---|---:|---|
| `/v1/ops/cases/:caseId/packages/regenerate` | POST | ops_operator |

## Denied Audit: `ops_auth.denied`

RBAC 거부 시 `logOpsEvent`로 아래를 저장합니다.

- `action`: `"ops_auth.denied"`
- `status`: `"fail"`
- `gateKey`: 요청 gateKey(없으면 `"unknown"`)
- `actorUid`: 요청자 UID
- `summary`: `Ops access denied: requires <requiredRole>, got <actorRole>`
- `target`:
  - `endpoint`: `req.originalUrl`
  - `method`: `req.method`
  - `requiredRole`
  - `actorRole`

## opsRole Claim 부여 (운영 메모)

- Firebase Admin SDK로 사용자에게 custom claims 설정:
  - `opsRole: "ops_viewer" | "ops_operator" | "ops_admin"`
- 예시(개념):
  - `admin.auth().setCustomUserClaims(uid, { opsRole: "ops_admin" })`
- 클레임 변경 후 클라이언트는 토큰을 갱신해야 반영됩니다.
  - `getIdToken(true)` 또는 `getIdTokenResult(true)`

## Rollout Checklist

- 운영자 계정에 `opsRole` 클레임 부여 후, 프론트에서 `getIdTokenResult().claims.opsRole` 확인
- viewer/operator/admin 3개 role로 위험 작업 API 호출 시 200/403 및 `ops_auth.denied` 기록 확인
- Confirm 모달 적용된 위험 버튼에서 대상(gateKey/jobId), “즉시 반영”, “되돌리기 주의” 문구 노출 확인

