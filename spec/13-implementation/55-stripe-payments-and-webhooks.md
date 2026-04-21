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

## 보안 고려사항
- `POST /v1/webhooks/stripe` 라우트는 Firebase Auth를 타지 않는 Public 엔드포인트입니다.
- 대신 **반드시** `stripe-signature` 헤더를 `STRIPE_WEBHOOK_SECRET`으로 검증하여 Stripe에서 보낸 정상적인 요청인지 확인해야 합니다.
- Express `req.rawBody`를 사용하여 서명 검증을 수행합니다 (`index.ts`의 `express.json` 설정에서 `limit` 및 `verify` 참조).
