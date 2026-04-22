# 55. Stripe Payments and Webhooks

## 개요
기존에 구현한 Payment/Refund MVP 상태 머신을 실제 **Stripe 결제망**과 연동하여 완전한 실결제/환불 파이프라인을 완성합니다.

## 시스템 구성
- **Provider**: Stripe (Checkout Session & Payment Intent)
- **수단**: 신용카드 (`payment_method_types: ['card']`)
- **결제 상태 관리**: 
  - 생성: Stripe Checkout Session 생성 후 `checkoutUrl` 반환. DB 상태 `initiated`
  - 완료: Webhook(`checkout.session.completed`) 수신 시 `captured`
  - 실패: Webhook(`checkout.session.async_payment_failed` 등) 수신 시 `failed`
- **환불 상태 관리**:
  - `POST /v1/ops/.../refunds/:refundId/execute` 호출 시 `stripe.refunds.create()` 직접 호출.
  - 성공 시 Payment `refunded`, Refund `executed` 로 상태 변경.

## 환경 변수 (Environment Variables)
- `STRIPE_SECRET_KEY`: Stripe API 연동용 비밀 키 (`sk_test_...` 또는 `sk_live_...`)
- `STRIPE_WEBHOOK_SECRET`: Stripe Webhook 서명 검증을 위한 시크릿 (`whsec_...`)
- (선택) `FRONTEND_URL`: Checkout 완료 후 돌아올 사용자 웹 URL (기본값: `http://localhost:5173`)

## 이벤트 매핑 (Webhook)

| Stripe Event | 시스템 액션 | Payment Status | Audit Event |
|---|---|---|---|
| `checkout.session.completed` | 결제 승인 | `captured` | `payment.captured` |
| `checkout.session.async_payment_failed` | 결제 실패 | `failed` | `payment.failed` |
| `payment_intent.payment_failed` | 결제 실패 | `failed` | `payment.failed` |

## 로컬 테스트 방법 (Stripe CLI)

1. **Stripe CLI 로그인**
   ```bash
   stripe login
   ```

2. **로컬 Webhook 포워딩 설정**
   Firebase Emulator(functions)가 `5001` 포트를 사용 중일 경우, 아래 명령으로 웹훅 트래픽을 포워딩합니다.
   ```bash
   stripe listen --forward-to localhost:5001/{PROJECT_ID}/{REGION}/api/v1/webhooks/stripe
   ```
   > **Note**: 위 명령 실행 후 출력되는 `whsec_...` 문자열을 `STRIPE_WEBHOOK_SECRET` 환경 변수에 설정합니다.

3. **테스트 이벤트 트리거 (결제 완료 테스트)**
   ```bash
   stripe trigger checkout.session.completed
   ```
   이때 `client_reference_id`를 실제 시스템의 Payment ID와 맞춰야 정상 동작합니다.
   실제 UI에서 Checkout 링크를 통해 테스트 카드 번호(`4242 4242 4242 4242`)로 결제를 진행하면 Webhook이 정상 수신되는지 확인할 수 있습니다.

## 보안 및 운영 고려사항
- **Webhook 엔드포인트 접근제어**: 
  - `POST /v1/webhooks/stripe` 라우트는 Firebase Auth를 타지 않는 Public 엔드포인트입니다.
  - 대신 **반드시** `stripe-signature` 헤더를 `STRIPE_WEBHOOK_SECRET`으로 검증하여 Stripe에서 보낸 정상적인 요청인지 확인해야 합니다.
  - 서명 검증을 위해 Express 라우터에서 `express.raw({ type: "application/json" })` 미들웨어를 먼저 통과시켜 정확한 바이트 스트림(rawBody)을 확보해야 합니다.
- **멱등성(Idempotency) 보장**:
  - Webhook에서 `stripe_events` 컬렉션을 활용해 `event.id` 중복 처리를 방지합니다. **레이스 컨디션을 막기 위해 `doc(event.id).create(...)`로 원자적 생성을 시도하고, `ALREADY_EXISTS (6)` 에러 발생 시 즉시 200 OK를 반환합니다.**
  - `stripe.checkout.sessions.create` 호출 시 Payment Document ID를 `idempotencyKey`로 전달하여 재시도 시 세션 중복 생성을 막습니다.
  - `stripe.refunds.create` 호출 시 Refund Document ID를 `idempotencyKey`로 전달하여 중복 환불을 막습니다.
- **상태 전이 보호 (Priority 기반)**:
  - `initiated(1) < failed(2) < captured(3) < refunded(4)` 와 같은 우선순위 맵을 정의하여, 비동기 웹훅이 순서가 섞여 들어오더라도 **현재 상태보다 우선순위가 높을 때만 업데이트**하도록 일반화했습니다.
- **Live/Test 환경 혼선 방지**:
  - Webhook Payload의 `event.livemode`와 서버의 `NODE_ENV === "production"` 및 `STRIPE_SECRET_KEY` 접두어(`sk_live_`) 값을 비교합니다.
  - 불일치 시 Audit Event에 `stripe_webhook.env_mismatch`로 경고를 남기고, Stripe 측 재시도를 막기 위해 `200 OK` (no-op)를 반환합니다.

## 운영 Runbook (장애 대응 체크리스트)

### 1. Webhook 서명 검증 실패 (`400 Bad Request`)
- **원인**: Stripe 대시보드와 서버의 `STRIPE_WEBHOOK_SECRET` 불일치 또는 `rawBody` 파싱 실패.
- **조치**: 
  - 서버 환경 변수 확인 (특히 `whsec_` 접두어).
  - `express.raw` 미들웨어가 `express.json`보다 먼저 실행되는지 라우터 순서 확인.

### 2. Live/Test 환경 불일치 (Audit: `stripe_webhook.env_mismatch`)
- **원인**: 개발/스테이징 서버에 Live 이벤트가 유입되거나, 프로덕션 서버에 Test 이벤트가 유입됨.
- **조치**:
  - Stripe 대시보드에서 Webhook Endpoint URL이 올바른 환경을 바라보는지 확인.
  - `STRIPE_SECRET_KEY`가 해당 환경에 맞는 키(`sk_test_` vs `sk_live_`)인지 확인.

### 3. Webhook 중복 수신 (Idempotency 차단 성공)
- **증상**: 서버 로그에 `ALREADY_EXISTS (6)` 에러 발생 후 `200 OK` 응답.
- **조치**: 정상적인 동작. Stripe의 재시도 정책에 의해 중복 수신되었으나, Firestore의 `docRef.create()`로 원자적 차단됨. (추가 조치 불필요)

### 4. `stripe_events` 컬렉션 비용/성능 관리
- **원인**: 중복 방지를 위해 쌓이는 `stripe_events` 문서가 지속적으로 증가.
- **조치**: Firestore TTL (Time-To-Live) 정책을 설정하여 `createdAt` 기준 30~90일이 지난 문서를 자동 삭제하도록 구성 (권장: 30일).

### 5. 환불 API 호출 실패 (`500 Internal Error` & Audit: `refund.executed` fail)
- **원인**: 잔액 부족, Stripe API 일시 장애, 유효하지 않은 `payment_intent`.
- **조치**: 
  - Audit 로그의 `changes.error` 확인.
  - Stripe 대시보드에서 해당 `payment_intent` 상태 및 계정 잔고 확인 후, 필요시 Ops 콘솔에서 재시도.
- **관측성 및 추적성**:
  - `metadata` 속성을 통해 `paymentId`, `userId`, `caseId` 등을 Stripe 대시보드에 남깁니다.
  - `audit_events`에 `stripe_event_id`나 `stripe_session_id`를 함께 기록하여 장애 대응 및 추적을 용이하게 합니다.
- **환경변수 관리**: 
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` 값이 누락된 경우 결제 및 Webhook 기능이 오동작하거나 서명 검증이 실패하므로 반드시 운영 환경에 설정되어야 합니다.
