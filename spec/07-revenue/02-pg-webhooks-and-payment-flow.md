# 결제/PG 웹훅 & 결제 상태 흐름 — v1

목표: 통합 결제(플랫폼 수납) 구조에서 “승인/매입/취소/환불”을 **PG 웹훅 기반**으로 안전하게 운영한다.  
원칙: 결제는 반드시 **멱등성 + 이벤트 저장 + 대사(원장/정산) 가능**해야 한다.

참조:
- OpenAPI: `02-engine/openapi_v1.yaml`
- 멱등성/재시도: `02-engine/06-api-error-and-idempotency.md`
- 도메인 이벤트 envelope: `02-engine/events/case_event.schema.json`
- 정산 이벤트 계약: `02-engine/contracts/settlement_event.schema.json`
- DB: `08-data/01-db-model.md`

---

## 0) 결제 구조(통합 결제) 전제

사용자 결제는 “한 번에 결제”하고, 내부에서 금액 라인을 분리:
1) 실비(법정비용/예수금/대납) — pass-through  
2) 파트너 보수  
3) 플랫폼 이용료  

> 외부 고지는 `12-legal/01-terms-privacy-disclosures.md`의 템플릿을 따름.

---

## 1) 결제 상태(내부)

`payments.status` (DB 기준):
- `authorized` : 승인 성공
- `captured` : 매입(정산 가능)
- `failed` : 실패
- `cancelled` : 승인 취소

도메인 이벤트(감사/대사):
- `PAYMENT_AUTHORIZED`
- `PAYMENT_CAPTURED`
- `PAYMENT_FAILED`
- `PAYMENT_CANCELLED`

---

## 2) PG 웹훅(권장)

### 2.1 웹훅 원칙(필수)
- 웹훅은 **서버-서버**로 수신하며, 서명 검증을 반드시 수행
- 웹훅 처리도 **멱등**해야 함(동일 eventId/txId 중복 수신)
- 웹훅 수신 로그는 append-only로 남김(감사)

### 2.2 권장 웹훅 타입(일반화)
- `payment.authorized`
- `payment.captured`
- `payment.failed`
- `payment.cancelled`
- `refund.executed`

> 실제 PG의 이벤트 명/필드는 다르므로 “어댑터”를 두고 내부 표준 이벤트로 변환한다.

---

## 3) 결제 플로우(사용자 → PG → 플랫폼)

### 3.1 결제 시작(사용자 앱)
1) 사용자가 `QUOTE_ACCEPTED`(동의) 완료
2) 결제 화면 진입(금액 라인 분리 표기)
3) 결제 시도 생성(내부 payment intent 생성)

필수:
- 시도 생성 시 `Idempotency-Key` 사용
- 결제 시도는 `caseId`, `quoteId`, `amountBreakdown`을 참조 가능해야 함

### 3.2 승인/매입(서버)
서버는 PG 응답 또는 웹훅을 수신해 내부 이벤트를 발행:
- 승인 성공 → `PAYMENT_AUTHORIZED`
- 매입 성공 → `PAYMENT_CAPTURED`
- 실패/취소 → `PAYMENT_FAILED` / `PAYMENT_CANCELLED`

권장:
- “클라이언트 리다이렉트” 결과만 믿지 말고, **서버 웹훅**을 최종 진실로 사용

---

## 4) 환불 플로우

### 4.1 환불 요청/승인/집행
- `REFUND_REQUESTED` : 사용자/CS 요청
- `REFUND_APPROVED` : ops 승인(정책 기반)
- `REFUND_EXECUTED` : PG 집행 성공(웹훅 기반)

필수:
- 부분 환불일 경우 amountBreakdown(어느 라인을 얼마나)까지 내부적으로 기록
- 환불 집행 전후로 정산/원장/대사 영향 자동 계산

---

## 5) 실패/장애 시나리오(운영 필수)

### 5.1 승인 성공, 웹훅 유실
- 증상: 사용자 화면은 결제 성공인데 내부에는 이벤트 없음
- 대응: 주기적 PG 조회(리컨실리에이션 배치)로 `PAYMENT_AUTHORIZED/CAPTURED` 보강

### 5.2 웹훅 중복
- 대응: `(pg, pgAuthKey/txId, webhookType)` 유니크 키로 멱등 처리

### 5.3 승인 성공 후 매입 실패(예외)
- 대응: `PAYMENT_AUTHORIZED` 후 `PAYMENT_FAILED` 가능
- 케이스 상태/정산 엔진은 “captured 기준”으로만 진행(매입 전에는 서비스 진행 제한 가능)

---

## 6) 관측/알림

필수 대시보드:
- 승인/매입 성공률, 실패율(사유별)
- 웹훅 지연/유실(ingestion lag)

필수 알림(P0):
- 결제 승인 실패율 급증
- PG 5xx 급증
- 웹훅 ingestion lag 급증

참조: `11-platform/01-observability-and-alerting.md`

