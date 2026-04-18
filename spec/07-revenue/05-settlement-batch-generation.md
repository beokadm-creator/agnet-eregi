# 정산 배치 생성 로직 스펙(미수금 상계 포함) — v1

목표: `SETTLEMENT_TO_PARTNER_CREATED`를 “한 번 만들면 끝”이 아니라,
1) 결제/환불/정책 페널티를 반영해 **정산 가능 금액**을 계산하고  
2) 파트너 미수금이 있으면 **상계(Offset)** 를 적용해  
3) 지급 금액/근거/로그가 **감사 가능**하도록 배치 단위로 생성한다.

참조:
- 결제/정산 이벤트 계약: `02-engine/contracts/settlement_event.schema.json`
- 원장 매핑: `07-revenue/03-ledger-mapping.md`
- 미수금 정책: `07-revenue/04-offset-and-recovery-policy.md`
- 상태 머신: `02-engine/04-state-machines.md`

---

## 0) 용어

- **정산 배치(Settlement Batch)**: 특정 기간(from~to) 동안 파트너별 정산 결과 묶음
- **정산 라인(Settlement Line)**: 케이스별/거래별 정산 구성 요소(케이스 단위가 기본)
- **상계(Offset)**: 지급액에서 미수금을 차감

---

## 1) 입력 이벤트(단일 진실)

정산 엔진은 “테이블”이 아니라 이벤트를 입력으로 삼는다.

필수 입력:
- `PAYMENT_CAPTURED` (매입 확정)
- `REFUND_EXECUTED` (환불 집행 확정)
- (선택) `PAYMENT_CANCELLED`, `PAYMENT_FAILED`
- (정산) `SETTLEMENT_VOIDED` (재계산 트리거)
- (미수금) `PARTNER_RECEIVABLE_CREATED`, `PARTNER_RECEIVABLE_OFFSET_APPLIED`

> v1에서는 “케이스 단위로 결제 1개”를 가정하고 단순화 가능. 추후 다중 결제/분할 결제는 확장.

---

## 2) 배치 생성 주기/범위

권장:
- D+1 배치(전일 확정분)
- 또는 주 1회(초기 운영 단순화)

배치 범위:
- 기간 내 `PAYMENT_CAPTURED.occurredAt` 기준으로 포함
- 환불은 “환불 집행 시점” 기준으로 해당 배치에서 반영하되,
  이미 지급된 케이스면 미수금으로 전환(정책 참조)

---

## 3) 파트너별 정산 가능액 계산(기본)

### 3.1 케이스별 Gross 산정
기본:
- `gross = captured_amount`
- 통화: KRW 기준(다통화는 추후)

### 3.2 플랫폼 이용료(platform_fee)
근거:
- `QUOTE_FINALIZED`/정책(사건팩 수수료율)
- 실제 구현에서는 `platformFee`를 이벤트로 남기는 것도 권장

### 3.3 파트너 지급액(net)
`net = gross - platform_fee - (실비 if pass-through)`

> 실비(pass-through) 처리는 `07-revenue/03-ledger-mapping.md`를 따른다.

---

## 4) 환불 반영 규칙(요약)

환불은 `REFUND_EXECUTED`만을 확정 진실로 취급.

배분:
1) 플랫폼 이용료부터 차감
2) 초과분은 파트너 몫에서 차감

정산 상태:
- 미지급(created): `platform_fee/net`을 직접 감소
- 지급 완료(paid): 파트너 몫 환불은 `PARTNER_RECEIVABLE_CREATED`로 전환

---

## 5) 미수금 상계(Offset) 적용

### 5.1 상계 입력
파트너별 open 미수금 목록:
- FIFO(가장 오래된 것부터)
- 사유 우선순위(대사 오류 > 환불 > 정책 페널티)

### 5.2 상계 가드레일(필수)
정책 변수(예):
- `maxOffsetRatioPerBatch = 0.5` (이번 배치 지급액의 50%까지만 상계)
- `minPayoutAmount = 0` (지급액 최소)

### 5.3 상계 알고리즘(의사코드)
```
payout = sum(net across cases in batch)
offsetBudget = min(payout * maxOffsetRatioPerBatch, payout - minPayoutAmount)

for receivable in receivables_fifo:
  if offsetBudget <= 0: break
  applied = min(receivable.remaining, offsetBudget)
  receivable.remaining -= applied
  offsetBudget -= applied
  payout -= applied
  emit PARTNER_RECEIVABLE_OFFSET_APPLIED(receivableId, settlementId, applied)
```

### 5.4 상계의 회계 처리(요지)
상계는 “지급채무를 줄이고(파트너에게 덜 지급)”, “미수금을 줄이는(회수)” 행위입니다.

원장(예):
- Dr `L_PARTNER_PAYABLE` (상계액)  — 지급채무 감소
- Cr `A_PARTNER_RECEIVABLE` (상계액) — 미수금 감소

---

## 6) 출력 이벤트(정산 엔진 산출물)

필수:
- `SETTLEMENT_TO_PARTNER_CREATED` (partnerId, period, gross/platform/net)
- (지급 시) `SETTLEMENT_TO_PARTNER_PAID`

미수금 관련:
- `PARTNER_RECEIVABLE_CREATED` (지급 후 환불/오류/페널티)
- `PARTNER_RECEIVABLE_OFFSET_APPLIED` (상계 적용 내역)

> 출력 이벤트는 회계/정산/운영 UI의 단일 계약이므로, “배치 화면”도 이 이벤트를 그대로 보여야 한다.

---

## 7) 감사/재현(필수)

정산 배치 생성 시 반드시 남겨야 함:
- 입력 이벤트 범위(from/to)와 사용한 이벤트 수/해시
- 정책 버전(`settlementPolicyVersion`)
- 상계 적용 내역(미수금별 applied amount)
- `audit_logs`에 배치 생성/지급 실행 기록

---

## 8) 운영 안전장치

- 배치 생성은 멱등: `(partnerId, period.from, period.to)` 유니크
- `SETTLEMENT_VOIDED` 발생 시:
  - 기존 배치를 void 처리(역분개/상계 되돌림 정책 포함)
  - 재생성
