# Firebase 구현 개발 기획(9): 케이스 타임라인 이벤트 카탈로그(v1)

목표: `cases/{caseId}/timeline/{eventId}`에 어떤 이벤트를 어떤 페이로드로 남길지 확정한다.  
이 문서는 “UI에 보여주는 사실”이자 “분쟁/감사에 필요한 증빙”이다.

핵심 원칙:
- **PII 금지**(주민번호/계좌/문서 OCR 원문/상세 주소/신분증 이미지 URL 등)
- 모든 이벤트는 `occurredAt`, `actor`, `type`, `summaryKo`를 가진다.
- 상세 데이터는 `meta`에 최소한으로.

---

## 0) 공통 스키마(권장)

`cases/{caseId}/timeline/{eventId}`
```json
{
  "type": "DOCUMENT_UPLOADED",
  "occurredAt": "2026-04-13T09:10:00Z",
  "actor": { "type": "user|partner|ops|system", "uid": "optional", "partnerId": "optional" },
  "summaryKo": "신분증이 업로드되었습니다.",
  "meta": { }
}
```

---

## 1) 이벤트 타입 목록(최소 MVP → 확장)

### Funnel/Case
- `CASE_CREATED`
- `CASE_ACCEPTED_BY_PARTNER`
- `CASE_STATUS_CHANGED`
- `CASE_COMPLETED`
- `CASE_CANCELLED`
- `CASE_ESCALATED_TO_OPS`

### Documents
- `DOCUMENT_UPLOAD_REQUESTED` *(선택: 업로드 URL 발급)*
- `DOCUMENT_UPLOADED`
- `DOCUMENT_REVIEW_REQUESTED`
- `DOCUMENT_REVIEWED_OK`
- `DOCUMENT_REVIEWED_NEEDS_FIX`
- `FIX_REQUEST_SENT`
- `FIX_SUBMITTED`

### Quotes
- `QUOTE_DRAFTED`
- `QUOTE_FINALIZED`
- `QUOTE_ACCEPTED_BY_USER`

### Payments / Refunds
- `PAYMENT_AUTHORIZED`
- `PAYMENT_CAPTURED`
- `PAYMENT_FAILED`
- `REFUND_REQUESTED`
- `REFUND_APPROVED`
- `REFUND_EXECUTED`
- `REFUND_REJECTED`

### Settlements / Receivables (Partner/Ops 시점)
- `SETTLEMENT_CREATED`
- `SETTLEMENT_PAID`
- `PARTNER_RECEIVABLE_CREATED`
- `PARTNER_RECEIVABLE_OFFSET_APPLIED`

### Approvals
- `APPROVAL_REQUESTED`
- `APPROVAL_APPROVED`
- `APPROVAL_REJECTED`

---

## 2) 타입별 meta 필드(권장)

### DOCUMENT_UPLOADED
meta:
- `documentId`
- `slotId`
- `versionId` *(식별자만)*
- `mimeType`
- `sizeBytes`

### DOCUMENT_REVIEWED_NEEDS_FIX
meta:
- `reviewRequestId`
- `issueCount`
- `issueSummariesKo[]` *(짧게 1~3개, PII 금지)*

### QUOTE_FINALIZED
meta:
- `quoteId`
- `priceRange`: `{min,max,currency}`
- `etaRange`: `{minHours,maxHours}`

### PAYMENT_CAPTURED
meta:
- `paymentId`
- `amount`: `{amount,currency}`
- `pg`

### REFUND_EXECUTED
meta:
- `refundId`
- `amount`

### SETTLEMENT_CREATED / PAID
meta:
- `settlementId`
- `period`: `{from,to}`
- `gross/platformFee/net`

### PARTNER_RECEIVABLE_CREATED
meta:
- `receivableId`
- `amount`
- `reasonKo`

### PARTNER_RECEIVABLE_OFFSET_APPLIED
meta:
- `receivableId`
- `settlementId`
- `amount`

### APPROVAL_REQUESTED
meta:
- `approvalId`
- `gate`
- `target`: `{type, ref}`

---

## 3) PII 금지 리스트(규칙으로 강제 권장)

타임라인에 넣으면 안 되는 것:
- 주민등록번호/여권번호/계좌번호/카드번호
- 문서 OCR 원문/이미지 URL
- 상세 주소(구/동/번지)
- 대화 전문(메시지는 별도 보관, 요약만)

대신 넣을 수 있는 것:
- “문서가 업로드됨/검토됨/보완필요” 같은 상태 사실
- 금액은 허용(정산/환불)
- 파트너/운영자 ID는 내부 식별자 수준으로만

