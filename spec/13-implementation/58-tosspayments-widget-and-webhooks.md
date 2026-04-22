# TossPayments 결제위젯 + 승인/취소 + 웹훅 상태반영 (#52)

본 문서는 기존 `payments/refunds` 파이프라인(상태 우선순위, 멱등성, Audit 기록)을 유지한 채, 토스페이먼츠 결제위젯을 연동하기 위한 서버/클라이언트/운영 가이드를 정리합니다.

## 1) 전제/용어
- Payment.provider: `tosspayments`
- Payment.providerRef: 토스 `paymentKey`
- orderId 규약: **내부 Payment ID(=payments/{paymentId}.id)** 와 동일
- Confirm 호출 방식: **successUrl 페이지에서 paymentKey/orderId/amount를 받아 `/confirm` 호출**
- 부분취소: 지원(Refund.amount를 cancelAmount로 사용)

## 2) Ops 설정(Firestore)
문서: `ops_settings/tosspayments`
- enabled: boolean
- clientKey: string (프론트에서 사용)
- secretKey: string (서버에서만 사용)
- updatedAt, updatedBy

## 3) 서버 API

### 3.1 결제 생성
`POST /v1/user/payments`

Request Body (예시)
```json
{
  "provider": "tosspayments",
  "amount": 1000,
  "currency": "KRW",
  "caseId": "case_123",
  "successUrl": "https://<user-web>/payments/success",
  "cancelUrl": "https://<user-web>/payments/cancel"
}
```

Response (핵심)
- `payment.orderId` (= paymentId)
- `payment.clientKey` (토스 clientKey)

### 3.2 결제 승인(Confirm)
`POST /v1/user/payments/:paymentId/confirm`

successUrl에서 받은 값을 그대로 전달:
```json
{
  "paymentKey": "<toss_paymentKey>",
  "orderId": "<paymentId>",
  "amount": 1000
}
```

서버 처리
- orderId === paymentId 검증
- amount === payments/{paymentId}.amount 검증(금액 조작 방지)
- 토스 승인 API 호출: `POST https://api.tosspayments.com/v1/payments/confirm`
  - Authorization: Basic (secretKey + ":")
  - Idempotency-Key: paymentId

## 4) 웹훅
`POST /v1/webhooks/tosspayments`

### 4.1 중복 방지 키
- 우선: 헤더 `tosspayments-webhook-transmission-id`
- 보조: payload `eventId`
- 저장 컬렉션: `toss_events/{id}`

### 4.2 정합성 검증(권장)
웹훅 payload만 신뢰하지 않고, 수신 후 `paymentKey`로 결제 조회 API를 호출하여:
- totalAmount == 내부 Payment.amount 일치
- status(DONE/CANCELED/PARTIAL_CANCELED/ABORTED/EXPIRED) 확인 후 상태 반영

### 4.3 상태 매핑
- DONE → captured
- ABORTED/EXPIRED → failed
- CANCELED → refunded
- PARTIAL_CANCELED → partially_refunded

부분취소/취소 누적 금액은 `Payment.refundedAmount`에 반영(토스 Payment.cancels[].cancelAmount 합).

## 5) 환불(취소) 실행
기존 엔드포인트:
`POST /v1/ops/cases/:caseId/refunds/:refundId/execute`

토스 결제의 경우:
- `payment.providerRef` (=paymentKey)로 취소 API 호출
- 부분취소는 `cancelAmount=refund.amount`로 처리
- 멱등키: `Idempotency-Key = refundId`

## 6) 프론트(user-web) 연결 포인트(개요)
1) 결제 생성: `/v1/user/payments` 호출 → `clientKey, orderId(=paymentId), amount` 수신
2) 결제위젯 렌더링(clientKey 사용)
3) 결제 성공 시 successUrl로 이동하면서 `paymentKey/orderId/amount` 쿼리로 전달됨
4) successUrl 페이지에서 `/v1/user/payments/:paymentId/confirm` 호출 → 성공 시 완료 화면

## 7) 로컬/스테이징 테스트
- 토스 테스트키/테스트 클라이언트키로 결제위젯 호출
- successUrl에서 confirm 호출이 10분 내 수행되는지 확인(토스 정책)
- 부분취소 케이스: 동일 결제에 대해 Refund를 2회 나눠 실행하여 Payment.status가 `partially_refunded` → `refunded`로 최종 전이되는지 확인

---
참고:
- 결제 승인 API: `/v1/payments/confirm`
- 결제 취소 API: `/v1/payments/{paymentKey}/cancel` (cancelAmount로 부분취소 가능, Idempotency-Key 권장)
- 웹훅 이벤트/상태 흐름: `PAYMENT_STATUS_CHANGED`, status(DONE/CANCELED/PARTIAL_CANCELED/ABORTED/EXPIRED)

