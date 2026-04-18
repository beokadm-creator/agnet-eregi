# 정산 상계/회수 정책(파트너 미수금) — v1

목표: 부분 환불/분쟁 조정 등으로 “이미 지급된 파트너 몫”을 되돌려야 할 때,
1) 플랫폼이 임의로 차감하지 않고(분쟁 리스크),  
2) **미수금(Receivable)로 계상 → 다음 정산에서 상계**하는 표준 절차를 제공한다.

참조:
- 결제/정산 이벤트 계약: `02-engine/contracts/settlement_event.schema.json`
- 결제 흐름/웹훅: `07-revenue/02-pg-webhooks-and-payment-flow.md`
- 원장 매핑: `07-revenue/03-ledger-mapping.md`
- CS/분쟁/환불 플레이북: `09-ops/04-cs-and-dispute-handling.md`
- 약관/동의 증빙: `12-legal/01-terms-privacy-disclosures.md`

---

## 0) 정의

- **파트너 미수금(Partner Receivable)**: 파트너에게 이미 지급된 금액 중, 환불/정산 오류/정책 위반 등으로 플랫폼이 회수해야 하는 금액
- **상계(Offset)**: 다음 정산에서 지급 예정 금액에서 미수금을 차감하여 지급액을 줄이는 행위
- **회수(Recovery)**: 상계로 충분히 회수되지 않는 경우 별도 청구/이체 등으로 회수(초기에는 정책만 정의)

---

## 1) 미수금이 발생하는 대표 케이스

1) **정산 지급 후(partner settlement paid) 환불 집행**
   - 플랫폼 몫(플랫폼 이용료)만으로 환불이 충당되지 않아 파트너 몫까지 환불이 필요한 경우
2) **정산 오류(대사 오류/중복 지급)**
3) **정책 위반 페널티**
   - 광고 부정/허위 프로필로 인한 벌점(정책에 따라 차감 가능)

> “미수금 생성”은 법무/운영 승인 게이트를 타는 것을 권장합니다(근거/분쟁 대비).

---

## 2) 환불 배분 우선순위(기본 규칙)

기본(권장):
1) 환불은 **플랫폼 이용료부터 차감**
2) 플랫폼 이용료를 초과한 환불은 **파트너 지급분에서 차감**

정산 상태에 따른 처리:
- 정산이 아직 `created`(미지급): `net_amount`를 직접 감소(=지급채무 감소)
- 정산이 `paid`(지급 완료): 파트너 몫 차감분은 **미수금으로 계상**하고, 다음 정산에서 상계

---

## 3) 상계(Offset) 정책

### 3.1 상계 적용 시점
권장:
- 정산 배치 생성 시(`SETTLEMENT_TO_PARTNER_CREATED` 생성 로직 내부)
- 또는 지급 직전(보수적)

### 3.2 상계 순서
권장:
- 가장 오래된 미수금부터(FIFO)
- 동일 날짜면 사유 우선순위(대사 오류 > 환불 > 정책 페널티)

### 3.3 상계 한도(가드레일)
파트너 관계/분쟁 리스크를 고려한 최소 가드레일:
- 한 배치에서 상계 가능한 최대 비율(예: 50%)
- 또는 최소 지급 보장액(예: 0원 이상)

> 초기에는 상계 “추천”만 하고 ops 승인 후 집행하는 운영 방식도 가능.

### 3.4 상계 부족(미수금 잔존)
- 다음 배치로 carry-over
- 장기 미회수 시 회수(Recovery) 절차로 전환(별도 정책)

---

## 4) 데이터 모델(권장)

### 4.1 미수금 테이블(권장 신규)
운영 구현에서는 아래 테이블을 두는 것을 권장합니다.

`partner_receivables`
- `id`(uuid)
- `partner_id`(uuid)
- `case_id`(uuid nullable)
- `amount`(money)
- `status`(`open/offset_applied/waived/collected`)
- `reason_ko`
- `source_event_id`(uuid nullable)
- `created_at`, `updated_at`

`partner_receivable_offsets`
- `id`(uuid)
- `receivable_id`(uuid)
- `settlement_id`(uuid)
- `amount`(money)
- `applied_at`

> 로컬 최소 DB에서는 `A_PARTNER_RECEIVABLE` 원장 계정으로만 표현했지만, 운영에서는 위처럼 “대상/잔액/상계 내역”이 필요합니다.

---

## 5) 이벤트/감사(권장)

정산 이벤트 계약에 아래 이벤트를 추가해, 회계/정산 엔진과 운영 UI가 같은 사실을 보게 합니다.

- `PARTNER_RECEIVABLE_CREATED`
  - 미수금 생성(사유/근거 포함)
- `PARTNER_RECEIVABLE_OFFSET_APPLIED`
  - 특정 정산 배치에서 얼마를 상계했는지

승인/감사:
- 고액/정책 페널티/분쟁건은 `APPROVAL_REQUESTED`(gate: `refund_approve` 또는 별도 gate)로 통제
- 모든 생성/상계는 `audit_logs`에 기록(사유/근거 링크 포함)

---

## 6) 원장(분개) 규칙(요지)

미지급 정산에서 차감되는 경우:
- Dr `L_PARTNER_PAYABLE` (차감액)
- Cr `A_CASH_PG` (환불 출금이 함께 일어나면) 또는 별도 환불 분개로 처리

지급 완료 후 미수금으로 전환:
- Dr `A_PARTNER_RECEIVABLE` (회수할 금액)
- Cr (환불 출금 계정과 결합되거나, 정산 재분류로 처리)

상계 적용:
- Dr `L_PARTNER_PAYABLE` (지급채무 감소)
- Cr `A_PARTNER_RECEIVABLE` (미수금 감소)

> 실제 계정과목/분개는 세무/회계 검토가 필요하며, 시스템은 계정과목 테이블화를 전제로 한다.

