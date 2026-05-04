# Partner SaaS Subscription Model (EP-07-03)

## 1. 개요
AgentRegi 플랫폼 내에서 파트너가 고급 기능(팀 계정, 상위 노출 가중치, 무제한 매칭 수신 등)을 이용하기 위해 월간/연간 단위로 구독료를 결제하는 B2B SaaS 모델을 도입합니다.
본 기획은 정기 결제, 유예 기간(Grace Period) 및 연체(Dunning) 처리, 플랜 변경 및 구독 해지에 이르는 전체 라이프사이클을 이벤트 기반으로 안전하게 관리하는 데 중점을 둡니다.

## 2. 에픽 및 스토리 구성

### EP-07-03 파트너 SaaS 구독 및 결제 관리
- **S-07-03-1 플랜 및 결제수단 등록**: 파트너가 제공되는 구독 플랜(예: Basic, Pro, Verified)을 확인하고, 정기 결제를 위한 카드 정보(빌링키)를 등록하여 최초 구독을 시작합니다.
- **S-07-03-2 자동 정기 청구 (Billing Batch)**: 매월/매년 구독 갱신일에 등록된 빌링키를 통해 자동으로 결제(Invoice)를 청구하고 영수증을 발행합니다.
- **S-07-03-3 유예 및 연체 관리 (Dunning Process)**:
  - 정기 결제 실패 시 즉각 서비스 이용을 정지하지 않고 7일의 유예 기간(`past_due`)을 부여합니다.
  - 유예 기간 내 1일, 3일, 7일 차에 재결제를 시도하며, 최종 실패 시 구독 상태를 정지(`unpaid` 또는 `canceled`)로 변경합니다.
- **S-07-03-4 구독 변경 및 해지**: 
  - 파트너가 구독 해지를 요청하면, 즉시 해지되지 않고 이번 청구 주기가 끝나는 시점(`cancel_at_period_end`)에 해지되도록 예약됩니다.
  - 플랜 업그레이드 시 일할 계산(Proration)을 통해 차액만 즉시 결제하고 갱신일을 유지합니다.

---

## 3. 데이터 모델 (Firestore 기반 스키마)

*참고: PG사(Stripe/Toss)의 Subscription 기능을 직접 사용할 수도 있으나, 자체 플랜 권한 제어 및 이벤트 발행을 위해 플랫폼 DB에 상태를 동기화(Mirroring)하여 관리합니다.*

### 3.1 `subscription_plans` (플랜 마스터)
- `id`: string (예: "plan_pro_monthly")
- `name`: string ("Pro Plan")
- `price`: number (예: 50000)
- `interval`: "month" | "year"
- `features`: Map<string, any> (예: `{ "maxTeamMembers": 5, "rankingBoost": 1.2 }`)
- `isActive`: boolean

### 3.2 `partner_subscriptions` (구독 상태)
- `partnerId`: string (Document ID로 사용)
- `planId`: string
- `status`: "active" | "past_due" | "unpaid" | "canceled"
- `currentPeriodStart`: Timestamp
- `currentPeriodEnd`: Timestamp
- `cancelAtPeriodEnd`: boolean
- `provider`: "stripe" | "tosspayments" | "internal"
- `providerSubscriptionId`: string (PG사 구독 ID)
- `updatedAt`: Timestamp

### 3.3 `billing_invoices` (청구 및 결제 이력)
- `id`: string
- `partnerId`: string
- `subscriptionId`: string
- `amount`: number
- `status`: "open" | "paid" | "failed" | "void"
- `dueDate`: Timestamp
- `paidAt`: Timestamp | null
- `retryCount`: number (Dunning 재시도 횟수)
- `providerInvoiceId`: string

---

## 4. API 명세 (HTTP API Contract)

### 4.1 플랜 목록 조회
`GET /v1/subscription-plans`
- **Response**: `{ "ok": true, "data": { "plans": [ /* 플랜 객체 배열 */ ] } }`

### 4.2 내 구독 정보 조회 (Partner)
`GET /v1/partner/subscription`
- **Response**: `{ "ok": true, "data": { "subscription": { ... }, "plan": { ... }, "upcomingInvoice": { ... } } }`

### 4.3 구독 시작 (빌링키 등록 포함)
`POST /v1/partner/subscription`
- **Request**: `{ "planId": "plan_pro_monthly", "paymentMethodId": "pm_123" }`
- **Response**: `{ "ok": true, "data": { "status": "active", "currentPeriodEnd": "..." } }`
- **동작**: PG사를 통해 정기 결제를 생성하고, 성공 시 Firestore 상태를 업데이트한 후 `SUBSCRIPTION_CREATED` 이벤트를 기록합니다.

### 4.4 구독 해지 예약
`POST /v1/partner/subscription/cancel`
- **Request**: `{ "reason": "사용 빈도 감소" }`
- **Response**: `{ "ok": true, "data": { "cancelAtPeriodEnd": true } }`
- **동작**: 상태는 `active`를 유지하되 갱신을 중단합니다.

### 4.5 결제 웹훅 수신 (PG Webhook)
`POST /v1/webhooks/billing`
- **동작**: PG사(Stripe/Toss)로부터 `invoice.payment_succeeded` 또는 `invoice.payment_failed` 이벤트를 수신합니다.
- 실패 시 `partner_subscriptions` 상태를 `past_due`로 변경하고, `SUBSCRIPTION_PAST_DUE` 이벤트를 발행합니다. 
- 이 이벤트를 구독하는 다른 워커가 파트너에게 연체 알림을 발송하거나 매칭 랭킹을 하향 조정합니다.

---

## 5. 설계 원칙 및 주의사항

1. **상태 동기화(Mirroring)의 정확성**: PG사의 결제 시스템이 Source of Truth 역할을 수행하므로, 우리 DB의 상태는 웹훅(Webhook)을 통해 철저히 멱등성을 가지고 동기화되어야 합니다.
2. **Graceful Degradation (유예 기간)**: B2B 서비스의 특성상 카드 한도 초과 등으로 1회 결제 실패 시 바로 서비스를 차단하면 파트너의 비즈니스 연속성이 훼손됩니다. 반드시 `past_due` 상태를 두어 일정 기간(예: 7일) 기존 혜택을 유지하되 경고를 노출해야 합니다.
3. **이벤트 기반 권한 제어**: 구독 상태(`active`, `past_due`, `unpaid`) 변경 시 직접 권한 테이블을 찌르지 않고 도메인 이벤트를 발행합니다. 이를 통해 팀 계정 제한, 랭킹 가중치 해제 등 여러 도메인의 후속 조치를 결합도 낮게(Decoupled) 처리할 수 있습니다.
4. **일할 계산(Proration) 복잡도**: MVP 단계에서는 플랜 다운그레이드는 다음 결제 주기에 반영되도록 제한하고, 업그레이드 시에만 즉시 차액을 결제하는 심플한 구조를 권장합니다.