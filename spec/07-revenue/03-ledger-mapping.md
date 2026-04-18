# 원장(복식부기) 매핑 & 분개 생성 규칙 — v1

목표: 통합 결제 구조에서 “대사/감사/정산”이 가능하려면, 모든 금전 이벤트를 **원장 분개**로 떨어뜨릴 수 있어야 한다.  
본 문서는 `ledger_entries` 생성 규칙(계정과목/차변·대변/참조)을 정의한다.

참조:
- DB: `08-data/01-db-model.md` (`ledger_entries`, `settlements_to_partner`)
- 정산 이벤트 계약: `02-engine/contracts/settlement_event.schema.json`
- 도메인 이벤트: `02-engine/events/case_event.schema.json`

---

## 0) 핵심 원칙(반드시)

1) **실비(pass-through)는 매출이 아니다**: UI/정산/원장에서 분리  
2) “확정”은 이벤트로 남는다: `QUOTE_FINALIZED`, `QUOTE_ACCEPTED`, `PAYMENT_CAPTURED`  
3) 원장은 append-only: 수정은 “역분개(반대 분개)”로 처리  
4) 대사 기준은 **결제/환불 웹훅 + 내부 이벤트**의 일치

---

## 1) 계정과목(예시 코드 체계)

> 실제 계정과목 코드는 회계/세무와 합의해 확정. 시스템은 코드 테이블화 가능해야 함.

자산:
- `A_CASH_PG` : PG 예치금/미수금(결제 수납)
- `A_LEGAL_FEES_HELD` : 실비 예수/대납 예정(사용자에게 받은 실비)

부채:
- `L_PARTNER_PAYABLE` : 파트너 지급채무
- `L_REFUND_PAYABLE` : 환불 지급채무(승인~집행 사이)

수익:
- `R_PLATFORM_FEE` : 플랫폼 이용료 매출

비용:
- `E_PG_FEE` : PG 수수료(선택)
- `E_REFUND_FEE` : 환불 수수료(선택)

---

## 2) 이벤트 → 분개 매핑(핵심)

표기 규칙:
- Dr = 차변, Cr = 대변
- amount는 KRW 기준(다통화는 확장)

### 2.1 `PAYMENT_CAPTURED`
전제: 결제 수납이 실제로 확정된 시점(대사 기준점).

입력 데이터(최소 필요):
- `paymentId`, `caseId`, `amount`(총액)
- `amountBreakdown`: `legalFees`, `partnerFee`, `platformFee` (권장: 별도 이벤트로도 분리 가능)

분개(예):
1) Dr `A_CASH_PG` (총액)
2) Cr `A_LEGAL_FEES_HELD` (실비)  ← 실비를 “보관/대납 예정” 자산으로 분리
3) Cr `L_PARTNER_PAYABLE` (파트너 보수)
4) Cr `R_PLATFORM_FEE` (플랫폼 이용료)

> 실비를 “자산”으로 두는지 “부채(예수금)”로 두는지는 회계 정책에 따라 달라질 수 있으므로, 계정과목은 설정 가능해야 함.

### 2.2 `SETTLEMENT_TO_PARTNER_CREATED`
목적: 파트너 지급 대상 확정(지급채무 확정).

분개(예):
- (이미 `PAYMENT_CAPTURED`에서 `L_PARTNER_PAYABLE`를 잡았다면) 별도 분개가 없을 수도 있음  
- 또는 배치 단위로 payable을 “정산 배치 payable”로 재분류하는 내부 분개(선택)

### 2.3 `SETTLEMENT_TO_PARTNER_PAID`
목적: 실제 지급.

분개(예):
1) Dr `L_PARTNER_PAYABLE` (지급액)
2) Cr `A_CASH_PG` 또는 `A_CASH_BANK` (지급 출금 계정)

### 2.4 `REFUND_APPROVED` → `REFUND_EXECUTED`
환불은 2단계가 이상적:
- 승인 시점: “환불 채무”를 잡아 대기(선택)
- 집행 시점: 실제 출금

분개(예, 집행 시점 기준):
1) Dr `L_REFUND_PAYABLE` (또는 직접 매출/자산 감소)
2) Cr `A_CASH_PG`

부분 환불(예):
- 플랫폼 이용료만 환불/또는 파트너 보수 일부 환불 등 케이스별로, `amountBreakdown` 기준으로 대응 계정을 다르게 한다.

환불 배분(권장, 단순 규칙):
- 환불은 **플랫폼 이용료부터 차감**(광고/플랫폼 책임 이슈의 대부분이 플랫폼 몫)
- 플랫폼 이용료를 초과한 환불은 **파트너 보수/정산**에서 차감
- 이미 정산이 지급(paid)된 이후라면:
  - 차감이 아니라 **회수(미수금)** 로 잡고, 다음 정산에서 상계(정책 필요)
  - 계정 예시: `A_PARTNER_RECEIVABLE`(파트너 미수금)

### 2.5 `SETTLEMENT_VOIDED`
정산 무효는 “역분개 + 재생성”이 원칙.

---

## 3) 분개 생성 엔진 요구사항(개발 요구)

필수 기능:
- 이벤트 수신 → 분개 룰 적용 → `ledger_entries` append-only insert
- 룰 버전 관리: `ledgerRuleVersion`
- 역분개 생성 기능(rollback)
- 대사 리포트:
  - PG 정산 파일/웹훅 vs 내부 원장
  - 케이스별/파트너별 잔액

권장 테이블(추가 가능):
- `ledger_rules` (룰/버전)
- `ledger_reconciliations` (대사 결과)

---

## 4) 실비(pass-through) 처리(제품/운영 주의점)

실비는 다음이 반드시 분리되어야 함:
- UI: 별도 라인 + “실비/법정비용” 고지
- 이벤트: breakdown 필드로 분리(총액만 저장 금지)
- 원장: 플랫폼 매출과 분리(매출 인식 금지)
- 정산: 실비 지급(대납) 흐름이 있다면 별도 이벤트/증빙 필요
