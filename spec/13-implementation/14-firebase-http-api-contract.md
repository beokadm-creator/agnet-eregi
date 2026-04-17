# Firebase 구현 개발 기획(7): HTTPS API 계약서(v1) — “바로 개발”용

목표: Cloud Functions(HTTPS)로 구현할 API를 **요청/응답/에러/멱등성**까지 포함해 “개발이 바로 가능한” 수준으로 고정한다.

참조:
- 기능/흐름: `13-implementation/07-firebase-react-core-implementation-plan.md`
- Functions 분해: `13-implementation/09-firebase-functions-api-and-jobs-plan.md`
- 데이터 모델/권한: `13-implementation/08-firebase-data-model-and-security-rules.md`

---

## 0) 공통 규칙

### 0.1 Base URL / 버전
- Base: `https://<region>-<project>.cloudfunctions.net/api`
- Prefix: `/v1`

### 0.2 인증
- 대부분 엔드포인트는 Firebase ID Token 필요
- 헤더:
  - `Authorization: Bearer <firebase_id_token>`

예외:
- 퍼널 일부(비로그인 허용 시): `intent`, `diagnosis/answer`, `results`는 익명 세션 키로 허용 가능(정책 선택)

### 0.3 멱등성(필수)
결제/환불/견적확정/승인결정/정산생성 등 “중복 호출되면 사고”나는 요청은 필수로 받는다.
- Header: `Idempotency-Key: <uuid>`
- 서버 저장: `idempotencyKeys/{scope}:{key}`
- 동일 키 재호출 시: 동일 `response` 반환

### 0.4 응답 공통 Envelope
성공:
```json
{ "ok": true, "data": { } }
```
실패:
```json
{
  "ok": false,
  "error": {
    "code": "APPROVAL_REQUIRED",
    "messageKo": "승인 대기 중입니다.",
    "requestId": "req_...",
    "details": { }
  }
}
```

### 0.5 표준 에러 코드(초기 세트)
- `UNAUTHENTICATED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `INVALID_ARGUMENT` (400)
- `CONFLICT` (409)
- `RATE_LIMITED` (429)
- `APPROVAL_REQUIRED` (412)
- `INTERNAL` (500)

### 0.6 Approval Required(412)
```json
{
  "ok": false,
  "error": {
    "code": "APPROVAL_REQUIRED",
    "messageKo": "승인 대기 중입니다.",
    "requestId": "req_...",
    "details": {
      "approvalId": "appr_...",
      "gate": "refund_approve",
      "requiredRole": "ops_approver"
    }
  }
}
```

---

## 1) Funnel/Diagnosis

### 1.1 POST /v1/intent
요청:
```json
{
  "sessionId": null,
  "intentText": "임원 변경 등기 하고 싶어요",
  "locale": "ko"
}
```
응답:
```json
{
  "ok": true,
  "data": {
    "sessionId": "sess_...",
    "cards": [ /* UI cards */ ]
  }
}
```

### 1.2 POST /v1/diagnosis/answer
요청:
```json
{
  "sessionId": "sess_...",
  "answer": { "questionId": "q_officer_type", "value": { "officerType": "이사" } }
}
```
응답:
```json
{ "ok": true, "data": { "cards": [/* next cards or result cards */] } }
```

### 1.3 GET /v1/results?sessionId=...
응답(요지):
```json
{
  "ok": true,
  "data": {
    "resultSetId": "rs_...",
    "partners": [
      { "partnerId": "p_...", "profile": { /* denormalized */ }, "sponsor": { "active": true } }
    ],
    "disclosureCards": [ /* cards */ ]
  }
}
```

---

## 2) Case

### 2.1 POST /v1/cases
요청:
```json
{
  "sessionId": "sess_...",
  "selectedPartnerId": "p_demo_01",
  "casePackId": "corp_officer_change_v1"
}
```
응답:
```json
{ "ok": true, "data": { "caseId": "case_..." } }
```

### 2.2 GET /v1/cases/{caseId}
응답:
```json
{ "ok": true, "data": { "case": { /* Firestore case doc */ } } }
```

### 2.2-A GET /v1/cases/{caseId}/timeline?limit=50
응답:
```json
{ "ok": true, "data": { "items": [ /* timeline events */ ] } }
```

### 2.2-B GET /v1/cases/{caseId}/workflow
응답:
```json
{ 
  "ok": true, 
  "data": { 
    "workflow": { "stage": "docs_collect", "checklist": {} }, 
    "casePack": { /* config */ }, 
    "advance": { "nextStage": "docs_review", "canAdvance": false, "reasonKo": "..." },
    "requiredSlots": ["slot_id_card", "slot_corp_registry"]
  } 
}
```

### 2.2-C POST /v1/cases/{caseId}/workflow/advance
Headers:
- `Idempotency-Key`

요청:
```json
{ "toStage": "docs_review" }
```
응답:
```json
{ "ok": true, "data": { "stage": "docs_review", "caseStatus": "waiting_partner", "advance": { "nextStage": "draft_filing", "canAdvance": false } } }
```

### 2.2-D POST /v1/cases/{caseId}/workflow/checklist
Headers:
- `Idempotency-Key`

요청:
```json
{ "itemId": "chk_id_card_legible", "done": true }
```
응답:
```json
{ "ok": true, "data": { "stage": "docs_review", "itemId": "chk_id_card_legible", "done": true, "advance": { "nextStage": "draft_filing", "canAdvance": false } } }
```

### 2.2-E GET /v1/cases/{caseId}/forms/officer-change
응답:
```json
{ "ok": true, "data": { "exists": true, "form": { "companyName": "ABC(주)", "meetingDate": "2026-01-01" } } }
```

### 2.2-F POST /v1/cases/{caseId}/forms/officer-change
Headers:
- `Idempotency-Key`

요청:
```json
{
  "companyName": "ABC(주)",
  "meetingDate": "2026-01-01",
  "resolutionKo": "다음과 같이 임원 변경을 결의한다.\n- 대표이사 홍길동 (대표이사): 선임 (효력일 2026-01-01)",
  "officers": [
    { "nameKo": "홍길동", "roleKo": "대표이사", "changeType": "appoint", "effectiveDate": "2026-01-01", "birthDate": "1980-01-01", "addressKo": "서울특별시 ...", "isRepresentative": true }
  ],
  "principalName": "대표이사 홍길동",
  "agentName": "등록 법무사 김법무",
  "scopeKo": "임원 변경 등기 신청 관련 일체"
}
```
> 참고: `resolutionKo`는 생략해도 되며, 생략 시 `officers`를 기반으로 서버가 자동 생성합니다.
응답:
```json
{ "ok": true, "data": { "ok": true } }
```

### 2.3 POST /v1/cases/{caseId}/transition (서버 전용 상태전이)
요청:
```json
{ "to": "waiting_partner", "reasonKo": "보완 제출 완료" }
```
응답:
```json
{ "ok": true, "data": { "status": "waiting_partner" } }
```

### 2.4 GET /v1/partner/cases?statuses=new,in_progress,waiting_partner,waiting_user
응답:
```json
{ "ok": true, "data": { "items": [ /* cases */ ] } }
```

---

## 3) Documents

### 3.1 POST /v1/cases/{caseId}/documents/upload-intent
Headers:
- `Idempotency-Key`

요청:
```json
{ "slotId": "slot_id_card", "fileName": "id.jpg", "mimeType": "image/jpeg", "sizeBytes": 123456 }
```
응답(예: Storage path 방식):
```json
{
  "ok": true,
  "data": {
    "documentId": "doc_...",
    "versionId": "dv_...",
    "storagePath": "cases/{caseId}/documents/{documentId}/{versionId}"
  }
}
```

### 3.2 POST /v1/cases/{caseId}/documents/{documentId}/versions/{versionId}/complete
Headers:
- `Idempotency-Key`

요청:
```json
{ "sha256": "....", "sizeBytes": 123456 }
```
응답:
```json
{ "ok": true, "data": { "status": "uploaded", "documentId": "doc_...", "versionId": "dv_...", "caseStatus": "waiting_partner" } }
```

### 3.3 POST /v1/cases/{caseId}/documents/{documentId}/review
Headers:
- `Idempotency-Key`

요청:
```json
{ "decision": "needs_fix", "issueCodes": ["ID_LEGIBILITY"], "issueSummariesKo": ["사진 흐림"] }
```
응답(예):
```json
{ "ok": true, "data": { "status": "needs_fix", "caseStatus": "waiting_user" } }
```
> 참고: 템플릿(초안) review `ok`는 "문구/내용 검토 OK" 의미이며, 실제 단계 전진을 위해서는 별도 서명본(`slot_*_signed`)이 `ok`여야 합니다.
> 참고: 서명본(`slot_*_signed`) review가 `ok`가 되면 관련 서명/날인 태스크(`sign_{baseSlotId}`)가 자동 완료 처리됩니다(타임라인 `SIGNATURE_TASK_COMPLETED` 기록).
> 참고: draft_filing 단계에서 서명본/필수서류 조건이 모두 충족되면 서버가 filing_submitted 단계로 자동 전진할 수 있습니다.
> 참고: filing_submitted 단계가 완료되어 completed로 자동 전진되면, 제출 패키지/종료 리포트 다운로드 경로가 타임라인 `PACKAGE_READY` 이벤트로 기록됩니다.

> 참고: `slot_filing_receipt`(접수증)의 needs_fix 시 issueCodes 예시는 `RECEIPT_NOT_LEGIBLE`, `RECEIPT_MISSING_FIELDS` 입니다.

### 3.7 POST /v1/cases/{caseId}/templates/generate
Headers:
- `Idempotency-Key`

요청(예):
```json
{ "template": "minutes", "input": { "companyName": "ABC(주)", "meetingDate": "2026-01-01", "officers": [{ "nameKo": "홍길동", "roleKo": "대표이사", "changeType": "appoint", "effectiveDate": "2026-01-01" }] } }
```
응답:
```json
{ "ok": true, "data": { "documentId": "gen_slot_minutes", "versionId": "v_..." } }
```

> template: `minutes` | `poa` | `application` | `acceptance` | `resignation` | `rep_change`
> 참고: 템플릿 생성 직후 문서 상태는 `uploaded`이며, 서명/날인 확보 후 파트너가 `/documents/{documentId}/review`로 `ok` 처리해야 단계 전진이 가능합니다.

### 3.8 GET /v1/cases/{caseId}/templates/{template}/export.docx
- `{template}`: `minutes` | `poa`
응답: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### 3.6 GET /v1/cases/{caseId}/fix-guide
응답(예):
```json
{
  "ok": true,
  "data": {
    "stage": "docs_review",
    "requiredSlots": ["slot_id_card","slot_corp_registry"],
    "items": [
      { "slotId": "slot_id_card", "status": "needs_fix", "issueCodes": ["ID_LEGIBILITY"], "guidanceKo": "- 식별 불가/흐림: ..." }
    ]
  }
}
```

### 3.4 POST /v1/cases/{caseId}/documents/{documentId}/submit-fix
Headers:
- `Idempotency-Key`

요청:
```json
{ "fileName": "fix.jpg", "mimeType": "image/jpeg", "sizeBytes": 123456 }
```
응답:
```json
{ "ok": true, "data": { "documentId": "doc_...", "versionId": "dv_...", "storagePath": "cases/.../dv_..." } }
```

### 3.5 GET /v1/cases/{caseId}/documents
응답:
```json
{ "ok": true, "data": { "items": [ /* documents */ ] } }
```

---

## 4) Quotes

### 4.0 GET /v1/cases/{caseId}/quotes
응답:
```json
{ "ok": true, "data": { "items": [ /* quotes */ ] } }
```

### 4.1 POST /v1/cases/{caseId}/quotes/draft
요청:
```json
{ "priceMin": 300000, "priceMax": 420000, "currency": "KRW", "etaMinHours": 24, "etaMaxHours": 96 }
```
응답:
```json
{ "ok": true, "data": { "quoteId": "q_..." } }
```

### 4.2 POST /v1/cases/{caseId}/quotes/{quoteId}/finalize
Headers:
- `Idempotency-Key`

요청:
```json
{ "assumptionsKo": ["법정비용(실비)은 별도입니다."] }
```
응답(승인 필요 시): 412 `APPROVAL_REQUIRED`

응답(성공):
```json
{ "ok": true, "data": { "status": "finalized" } }
```

### 4.3 POST /v1/cases/{caseId}/quotes/{quoteId}/accept
Headers:
- `Idempotency-Key`

요청:
```json
{}
```
응답:
```json
{ "ok": true, "data": { "status": "accepted", "quoteId": "q_..." } }
```

---

## 5) Payments / Webhooks

### 5.0 GET /v1/cases/{caseId}/payments
응답:
```json
{ "ok": true, "data": { "items": [ /* payments */ ] } }
```

### 5.1 POST /v1/cases/{caseId}/payments/create
Headers:
- `Idempotency-Key`

요청:
```json
{ "quoteId": "q_...", "method": "card", "clientReturnUrl": "https://app/return" }
```
응답:
```json
{
  "ok": true,
  "data": {
    "paymentId": "pay_...",
    "redirectUrl": "https://pg/..."
  }
}
```

### 5.2 POST /v1/pg/webhook
요청(벤더별 서명 검증):
```json
{ "pgEventId": "evt_...", "type": "PAYMENT_CAPTURED", "payload": { } }
```
응답:
```json
{ "ok": true, "data": { "accepted": true } }
```

### 5.3 POST /v1/ops/pg/reprocess
Headers:
- `Idempotency-Key`

요청:
```json
{ "caseId": "case_...", "paymentId": "pay_...", "pgEventId": "evt_..." }
```
응답:
```json
{ "ok": true, "data": { "reprocessed": true } }
```

---

## 6) Refunds + Approvals

### 6.0 GET /v1/cases/{caseId}/refunds
응답:
```json
{ "ok": true, "data": { "items": [ /* refunds */ ] } }
```

### 6.1 POST /v1/cases/{caseId}/refunds/request
Headers:
- `Idempotency-Key`

요청:
```json
{ "paymentId": "pay_...", "amount": { "amount": 20000, "currency": "KRW" }, "reasonKo": "서비스 지연" }
```
응답:
- 승인 필요 시: 412 + `approvalId`
- 승인 불필요(소액 자동 환불 정책 등): 바로 `refundId`

### 6.2 POST /v1/ops/approvals/{approvalId}/decision
Headers:
- `Idempotency-Key`

요청:
```json
{ "decision": "approve", "reasonKo": "정책 허용" }
```
응답:
```json
{ "ok": true, "data": { "status": "approved" } }
```

### 6.4 GET /v1/ops/approvals?status=pending&gate=refund_approve
응답:
```json
{ "ok": true, "data": { "items": [ /* approvals */ ] } }
```

### 6.3 POST /v1/cases/{caseId}/refunds/{refundId}/execute
Headers:
- `Idempotency-Key`
요청:
```json
{ "approvalId": "appr_..." }
```

---

## 7) Settlements / Receivables

### 7.1 GET /v1/partner/settlements
응답:
```json
{ "ok": true, "data": { "items": [ /* settlements */ ] } }
```

### 7.1-A GET /v1/partner/settlements/{settlementId}/items
응답:
```json
{ "ok": true, "data": { "items": [ /* settlement items */ ] } }
```

### 7.1-B GET /v1/partner/settlements/{settlementId}/export.csv
응답: `text/csv`

### 7.2 GET /v1/partner/receivables?status=open
응답:
```json
{ "ok": true, "data": { "items": [ /* receivables */ ] } }
```

### 7.2-A GET /v1/partner/receivables/{receivableId}/offsets
응답:
```json
{ "ok": true, "data": { "items": [ /* offsets */ ] } }
```

### 7.3 GET /v1/ops/settlements?status=created
응답:
```json
{ "ok": true, "data": { "items": [ /* settlements */ ] } }
```

### 7.3-A GET /v1/ops/settlements/{settlementId}/items
응답:
```json
{ "ok": true, "data": { "items": [ /* settlement items */ ] } }
```

### 7.3-B GET /v1/ops/settlements/{settlementId}/export.csv
응답: `text/csv`

### 7.4 POST /v1/ops/settlements/generate
Headers:
- `Idempotency-Key`

요청:
```json
{ "partnerId": "p_...", "periodFrom": "2026-01-01", "periodTo": "2026-01-31" }
```
응답:
```json
{ "ok": true, "data": { "settlementId": "set_..." } }
```

### 7.5 POST /v1/ops/settlements/{settlementId}/pay
Headers:
- `Idempotency-Key`

요청:
```json
{}
```
응답:
```json
{ "ok": true, "data": { "settlementId": "set_...", "status": "paid" } }
```

### 7.6 GET /v1/ops/settlements/{settlementId}/payouts
응답:
```json
{ "ok": true, "data": { "items": [ /* payout attempts */ ] } }
```

### 7.7 GET /v1/partner/settlements/{settlementId}/payouts
응답:
```json
{ "ok": true, "data": { "items": [ /* payout attempts */ ] } }
```

## 8) Payables (CarryOver)

### 8.1 GET /v1/partner/payables/summary
응답:
```json
{ "ok": true, "data": { "exists": true, "summary": { "carryOverAmount": { "amount": 7000, "currency": "KRW" } } } }
```

## 9) Tasks (법무사 업무 큐)

### 9.1 GET /v1/partner/tasks?status=open
응답:
```json
{ "ok": true, "data": { "items": [ /* tasks */ ] } }
```

### 9.2 GET /v1/cases/{caseId}/tasks
응답:
```json
{ "ok": true, "data": { "items": [ /* tasks */ ] } }
```

### 9.3 POST /v1/cases/{caseId}/tasks/{taskId}/complete
Headers:
- `Idempotency-Key`

요청:
```json
{}
```
응답:
```json
{ "ok": true, "data": { "taskId": "t_...", "status": "done" } }
```

## 10) Filing (등기 제출)

### 10.1 GET /v1/cases/{caseId}/filing
응답:
```json
{ "ok": true, "data": { "exists": true, "filing": { "receiptNo": "2026-12345", "jurisdictionKo": "서울중앙지방법원", "submittedDate": "2026-01-12" } } }
```

### 10.2 POST /v1/cases/{caseId}/filing
Headers:
- `Idempotency-Key`

요청:
```json
{ "receiptNo": "2026-12345", "jurisdictionKo": "서울중앙지방법원", "submittedDate": "2026-01-12", "memoKo": "메모" }
```
응답:
```json
{ "ok": true, "data": { "ok": true } }
```

> 참고: filing_submitted 단계에서 접수 정보 + 접수증(slot_filing_receipt) OK + 체크리스트가 충족되면 서버가 자동으로 completed로 전진할 수 있습니다.

## 11) Reports

### 11.1 GET /v1/cases/{caseId}/reports/closing.docx
응답: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

## 12) Packages

### 12.1 GET /v1/cases/{caseId}/packages/submission.zip
응답: `application/zip`

> 포함(예): closing_report.docx, filing_summary.docx, signed_evidence.docx(서명본 현황), workflow_proof.docx(체크리스트/태스크), templates/*.docx, signed/* 원본, filing receipt 원본, meta.json

### 12.2 GET /v1/cases/{caseId}/packages/validate
목적: `submission.zip` 생성/다운로드 전에 **서명본(signed)과 접수증(storage)의 존재 여부를 빠르게 검증**하는 운영용 엔드포인트.
(참고: 모든 파일이 온전히 존재해 `ok`가 `true`일 경우에 한해, 서버에서 `pilot_gate_evidence` 컬렉션에 해당 검증 결과를 영구 저장하고 `evidenceId`를 발급하여 응답합니다.)

응답(예):
```json
{
  "ok": true,
  "data": {
    "ok": true,
    "evidenceId": "ev_1700000000000_123abc",
    "missing": [],
    "signed": [
      {
        "slotId": "slot_minutes_signed",
        "status": "ok",
        "fileName": "slot_minutes_signed.pdf",
        "storagePath": "cases/case_.../documents/doc_.../dv_...",
        "exists": true
      }
    ],
    "filingReceipt": {
      "slotId": "slot_filing_receipt",
      "status": "ok",
      "fileName": "filing_receipt.pdf",
      "storagePath": "cases/case_.../documents/doc_.../dv_...",
      "exists": true
    }
  }
}
```

> 참고: `signed`는 `requiredSlotsForStage(draft_filing)` 중 `_signed`로 끝나는 슬롯들을 기준으로 산출합니다.
> 참고: `evidenceId`는 `ok: true`일 때만 내려옵니다.

### 8.2 GET /v1/ops/partners/{partnerId}/payables/summary
응답:
```json
{ "ok": true, "data": { "exists": true, "summary": { "carryOverAmount": { "amount": 7000, "currency": "KRW" } } } }
```

### 7.1 POST /v1/ops/settlements/generate
Headers:
- `Idempotency-Key`
요청:
```json
{ "period": { "from": "2026-04-13T00:00:00Z", "to": "2026-04-13T23:59:59Z" }, "policyVersion": "v1" }
```
응답:
```json
{ "ok": true, "data": { "batchId": "st_batch_...", "count": 10 } }
```

### 7.2 POST /v1/ops/settlements/{settlementId}/pay
Headers:
- `Idempotency-Key`
요청:
```json
{ "bankRef": "bank_ref_...", "paidAt": "2026-04-13T10:30:00Z" }
```
