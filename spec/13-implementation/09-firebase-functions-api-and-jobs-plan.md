# Firebase 구현 개발 기획(2): Cloud Functions API/배치/트리거 설계 — v1

목표: 핵심 흐름(퍼널/케이스/문서/견적/결제/환불/정산/승인게이트)을 Firebase 방식으로 구현할 때,
**어떤 Functions가 무엇을 책임지는지**를 작업 단위로 고정한다.

전제:
- 권한: Firebase Auth + Custom Claims
- DB: Firestore
- 파일: Cloud Storage
- 외부 연동: PG/메시징/알림은 Functions에서만 수행

---

## 1) 함수 타입 선택 기준

### 1.1 HTTPS (권장)
모바일/웹에서 표준 HTTP로 호출, REST 스타일 유지.
- 장점: 디버깅/로깅/버저닝 용이, 외부 웹훅 수신에 적합

### 1.2 Callable (선택)
Firebase SDK로 호출(자동 auth context).
- 장점: 클라이언트 통합 쉬움
- 단점: 외부 시스템/웹훅과 궁합이 약함

### 1.3 Trigger (Firestore/Storage)
스냅샷/타임라인 동기화, 업로드 finalize 후 메타 보정 등에 사용.
- 주의: 무한루프 방지(쓰기 경로 분리, guard field)

### 1.4 Scheduler (필수)
정산 배치 생성/지급, SLA 점검, 큐 적체 감지 등.

---

## 2) API “기능 단위” 설계(핵심)

### 2.1 Funnel/Diagnosis
- `POST /api/v1/intent`
  - 입력: intentText/locale
  - 출력: sessionId + 다음 UI cards
- `POST /api/v1/diagnosis/answer`
  - 입력: sessionId + answer
  - 출력: 다음 질문 cards 또는 결과 cards
- `GET /api/v1/results?sessionId=...`
  - 출력: 추천 파트너 리스트 + disclosure + CTA

### 2.2 Case
- `POST /api/v1/cases`
  - 입력: sessionId + selectedPartnerId + casePackId
  - 출력: caseId
- `GET /api/v1/cases/{caseId}`
- `POST /api/v1/cases/{caseId}/status-transition`
  - 서버에서만 상태 전이(클라 직접 update 금지 권장)

### 2.3 Documents
- `POST /api/v1/cases/{caseId}/documents/upload-url`
  - 출력: signed URL(또는 Firebase Storage resumable upload 토큰) + documentId/versionId
- `POST /api/v1/cases/{caseId}/documents/{documentId}/submit-fix`
  - 보완 제출

### 2.4 Quotes
- `POST /api/v1/cases/{caseId}/quotes/draft`
- `POST /api/v1/cases/{caseId}/quotes/{quoteId}/finalize`
  - 필요 시 승인게이트 생성 → “승인 대기” 에러 반환

### 2.5 Payments(Webhook 포함)
- `POST /api/v1/cases/{caseId}/payments/create`
  - 결제 세션 생성(외부 PG로 redirect/SDK 연계)
- `POST /api/v1/pg/webhook`
  - 서명 검증, 멱등키로 중복 처리 방어
  - 결과를 Firestore + timeline event로 기록

### 2.6 Refunds + Approval Gate
- `POST /api/v1/cases/{caseId}/refunds/request`
  - 승인게이트 필요 시 approval 생성
- `POST /api/v1/ops/approvals/{approvalId}/decision`
  - approve/reject
- `POST /api/v1/cases/{caseId}/refunds/{refundId}/execute`
  - ops 승인 후 집행(또는 decision에서 곧바로 실행)

### 2.7 Settlements + Receivables
- `POST /api/v1/ops/settlements/generate?period=...` (또는 scheduler)
  - 배치 생성(미수금 상계 포함)
- `POST /api/v1/ops/settlements/{settlementId}/pay`
  - 지급 처리(은행/정산 시스템 연계는 추후)

---

## 3) 멱등성/재시도 설계(필수)

### 3.1 Idempotency Key 저장(권장)
- `idempotencyKeys/{key}` 문서에:
  - `scope`(endpoint), `requestHash`, `responseSnapshot`, `createdAt`
- 같은 키로 재호출 시 동일 응답 반환

### 3.2 Webhook 멱등
- `pgEvents/{pgEventId}` 또는 `payments/{paymentId}/events/{pgEventId}`
- 이미 처리된 pgEventId면 no-op

### 3.3 함수 재시도(Trigger/Scheduler)
- at-least-once를 전제로 “중복 발생해도 안전”하게 설계

---

## 4) 승인 게이트(Approval) 구현 규칙(요지)

1) 고위험 액션(견적확정/환불/메시지발송/PII열람/파트너등급변경)은
2) 실제 집행 전에 `approvals/{approvalId}` 생성
3) UI는 approval 상태를 보고 진행
4) 승인 후에만 집행(서버가 보장)

---

## 5) 타임라인 이벤트 전략(실무적으로 중요)

권장:
- `cases/{caseId}/timeline/{eventId}`에 “사용자/파트너/ops가 보는 사실”을 기록
- PII는 금지(문서 내용/계좌/주민번호 등)
- 감사/분쟁 시 “누가/언제/무엇을” 했는지 추적 가능해야 함

---

## 6) Scheduler Job 목록(최소)

- `settlementBatchGenerateDaily` : 정산 배치 생성(미수금 상계 포함)
- `slaScan` : SLA 임박/위반 감지 → ops 큐 생성
- `deadLetterReprocess` : 실패한 웹훅/트리거 재처리(선택)
- `cleanupRetention` : 오래된 타임라인/로그 보관 정책 수행

