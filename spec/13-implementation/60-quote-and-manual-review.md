# Quote Finalization & Ops Manual Review (EP-04-03, EP-05-01)

## 1. 개요
파트너가 초기 제안한 예상 견적을 바탕으로, 실제 케이스 검토 후 최종 견적을 확정하고 사용자에게 동의를 구하는 워크플로우(EP-04-03)와, 고액 결제 변경이나 분쟁 등 시스템 내 예외 상황을 운영자가 수동으로 검토하고 승인하는 중앙화된 수동검토 큐(EP-05-01)를 설계합니다.

## 2. 에픽 및 스토리 구성

### EP-04-03 견적 확정/동의 요청 (Partner/User)
- **견적 제안 (Draft)**: 파트너가 예상 비용 범위(min/max)와 예상 소요 시간(ETA)을 제안합니다.
- **견적 확정 (Finalize)**: 파트너가 실비, 추가 비용 등 전제조건(Assumptions)을 포함하여 최종 금액을 확정합니다. 이때 금액이 정책 범위를 초과하면 자동으로 수동검토 큐(Ops)로 이관됩니다.
- **견적 동의 (Accept)**: 사용자가 확정된 견적과 전제조건을 확인하고 명시적으로 동의(전자서명 또는 로그 기록)해야만 결제 단계로 진입할 수 있습니다.

### EP-05-01 수동검토 큐 (Ops Console)
- **통합 큐 관리**: 견적 초과 승인, 고액 환불 승인, 파트너 정책 위반 등 시스템 내 모든 예외적 승인 요청을 하나의 큐(`ops_approvals`)에서 관리합니다.
- **권한 기반 검토 (RBAC)**: 각 승인 게이트(Gate)마다 요구되는 최소 권한(예: `ops_operator`, `ops_admin`)이 다르며, 권한 미달 시 접근이 차단됩니다.
- **감사 추적 (Audit)**: 승인/반려(Approve/Reject) 결정은 사유(Reason)와 함께 `ops_audit_events`에 영구 기록됩니다.

---

## 3. 데이터 모델 (Firestore 스키마)

### 3.1 `cases/{caseId}/quotes` (견적 이력)
- `id`: string (quoteId)
- `status`: "draft" | "finalized" | "accepted" | "rejected"
- `priceMin`, `priceMax`: number (초기 제안 범위)
- `finalPrice`: number | null (최종 확정 금액)
- `currency`: string (기본 "KRW")
- `etaMinHours`, `etaMaxHours`: number
- `assumptionsKo`: string[] (전제조건, 예: "공과금 별도")
- `createdBy`: string (파트너 ID)
- `createdAt`, `updatedAt`: Timestamp

### 3.2 `ops_approvals` (수동검토 큐)
- `id`: string (approvalId)
- `status`: "pending" | "approved" | "rejected"
- `gate`: string (예: "quote_approve", "refund_approve")
- `caseId`: string
- `requiredRole`: "ops_operator" | "ops_admin"
- `context`: Map<string, any> (승인 판단에 필요한 도메인 데이터 복제본)
- `decision`:
  - `reviewerUid`: string | null
  - `reasonKo`: string | null
  - `decidedAt`: Timestamp | null
- `requestedBy`: string (요청자 UID)
- `createdAt`, `updatedAt`: Timestamp

---

## 4. API 명세 (HTTP API Contract)

### 4.1 견적 제안 (파트너)
`POST /v1/partner/cases/:caseId/quotes/draft`
- **Request**: `{ "priceMin": 150000, "priceMax": 200000, "etaMinHours": 24, "etaMaxHours": 72 }`
- **Response**: `{ "ok": true, "data": { "quoteId": "q_123", "status": "draft" } }`

### 4.2 견적 확정 (파트너)
`POST /v1/partner/cases/:caseId/quotes/:quoteId/finalize`
- **Request**: `{ "finalPrice": 180000, "assumptionsKo": ["법정 수수료는 별도입니다."] }`
- **Response (정상)**: `{ "ok": true, "data": { "status": "finalized" } }`
- **Response (한도 초과 시)**: `{ "ok": false, "error": { "code": "APPROVAL_REQUIRED", "approvalId": "appr_456" } }`

### 4.3 견적 동의 (사용자)
`POST /v1/user/cases/:caseId/quotes/:quoteId/accept`
- **Request**: `{}` (Header에 Idempotency-Key 필수)
- **Response**: `{ "ok": true, "data": { "status": "accepted" } }`
- **동작**: 상태를 `accepted`로 변경하고, 결제(`payments`) 생성을 위한 트리거를 발생시킵니다.

### 4.4 수동검토 큐 목록 조회 (운영자)
`GET /v1/ops/approvals?status=pending`
- **Response**: `{ "ok": true, "data": { "items": [ /* approval 객체 배열 */ ] } }`

### 4.5 수동검토 승인/반려 (운영자)
`POST /v1/ops/approvals/:approvalId/decision`
- **Request**: `{ "decision": "approve" | "reject", "reasonKo": "한도 초과 견적 사유 합당함" }`
- **Response**: `{ "ok": true, "data": { "status": "approved" } }`
- **동작**: `ops_approvals`의 상태를 업데이트하고, `gate` 유형에 따라 후속 작업(예: 견적 상태를 `finalized`로 강제 변경)을 워커 또는 인라인으로 실행합니다. `ops_audit_events`에 기록합니다.

---

## 5. 설계 원칙 및 주의사항
1. **엄격한 상태 전이 (State Machine)**: 견적은 반드시 `draft` → `finalized` → `accepted` 순서로만 전이되어야 하며, 임의의 상태 건너뛰기를 서버에서 차단해야 합니다.
2. **`412 APPROVAL_REQUIRED` 표준화**: 예외적인 액션(견적 대폭 상향, 고액 환불 등) 시 서버는 즉각 실패시키지 않고 `APPROVAL_REQUIRED` 에러와 함께 `approvalId`를 반환하여 클라이언트가 "운영자 승인 대기" UI를 렌더링할 수 있게 합니다.
3. **2인 승인 (Two-man Rule)**: 매우 민감한 `gate`의 경우, 요청자와 승인자가 동일 인물(`uid`)일 수 없도록 방어 로직을 추가합니다.
4. **결제 연동 멱등성**: 사용자가 견적에 동의(`accept`)하는 순간 결제 청구서가 생성될 수 있으므로, 해당 API는 멱등키를 필수적으로 요구해야 합니다.