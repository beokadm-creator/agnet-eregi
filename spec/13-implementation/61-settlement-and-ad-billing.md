# Settlement & Ad Billing (EP-06-03, EP-02-03)

## 1. 개요
플랫폼의 핵심 수익 모델인 결제 대금 정산(Settlement)과 파트너 스폰서 광고 과금(Ad Billing) 체계를 정의합니다.
실시간 정산이 아닌 일/주/월 단위 배치를 통해 집계하며, 파트너에게 지급할 순매출에서 광고비를 상계(Netting)하여 최종 지급액을 산출하는 구조를 갖춥니다.

## 2. 에픽 및 스토리 구성

### EP-06-03 정산 배치 및 원장/리포트
- **주기적 정산 집계 (Batch)**: 정산 주기에 맞춰 `captured` 결제와 `executed` 환불을 집계하고, 플랫폼 수수료를 차감한 정산 대상 금액을 산출합니다.
- **광고비 상계 (Netting)**: 산출된 정산 대상 금액에서 파트너가 미납한 스폰서 광고비(`ad_billings`)를 차감하여 최종 파트너 지급액(`netSettlementAmount`)을 확정합니다.
- **정산 승인 및 이체 (Ops)**: 생성된 정산 건(`calculated`)을 운영자가 확인 후 승인(`approved`)하고, 실제 이체가 완료되면 `transferred` 상태로 변경합니다.
- **정산 리포트 제공 (Partner)**: 파트너가 자신의 콘솔에서 결제액, 수수료, 광고 차감액이 명시된 상세 정산 내역을 조회할 수 있습니다.

### EP-02-03 스폰서 광고 정산 및 트래킹
- **노출/클릭 트래킹**: 사용자 화면에 스폰서 파트너가 노출되거나 클릭될 때 이벤트를 수집합니다. (동일 IP/유저의 단기간 중복 클릭은 어뷰징 필터링 처리)
- **일일 광고비 과금 (Batch)**: 매일 자정에 전날의 유효 클릭/노출을 집계하여 CPC/CPM 단가를 곱해 파트너별 일일 광고비(`ad_billings`)를 생성합니다.
- **예산 제어 (Budget Control)**: 파트너가 설정한 일일/월간 예산을 초과하면 광고 캠페인 상태를 `budget_exhausted`로 변경하여 노출을 중단합니다.

---

## 3. 데이터 모델 (Firestore 스키마)

### 3.1 `settlements` (정산 원장)
- `id`: string
- `partnerId`: string
- `periodStart`, `periodEnd`: Timestamp
- `totalPaymentAmount`: number (총 결제액)
- `totalRefundAmount`: number (총 환불액)
- `platformFee`: number (플랫폼 수수료)
- `adDeductionAmount`: number (차감된 광고비)
- `netSettlementAmount`: number (최종 파트너 지급액)
- `status`: "calculated" | "approved" | "transferred"
- `createdAt`, `updatedAt`: Timestamp

### 3.2 `ad_campaigns` (광고 캠페인)
- `id`: string
- `partnerId`: string
- `status`: "active" | "paused" | "budget_exhausted"
- `type`: "CPC" | "CPM"
- `bidAmount`: number (입찰 단가)
- `dailyBudget`: number (일일 예산 제한)
- `updatedAt`: Timestamp

### 3.3 `ad_billings` (일일 광고 과금 집계)
- `id`: string
- `partnerId`: string
- `targetDate`: string (YYYY-MM-DD)
- `validImpressions`, `validClicks`: number
- `billingAmount`: number (청구 광고비)
- `isSettled`: boolean (정산 시 상계 처리 여부)

---

## 4. API 명세 (HTTP API Contract)

### 4.1 정산 배치 실행 (Internal)
`POST /v1/ops/settlements/batch`
- **Request**: `{ "periodEnd": "2026-05-31T23:59:59Z" }`
- **동작**: 미정산 결제/환불 및 미상계 광고비를 긁어와 `settlements`를 생성하고, 대상 레코드들의 상태를 `settled: true`로 마킹합니다. (트랜잭션 롤백 보장)

### 4.2 정산 상태 변경 (Ops)
`POST /v1/ops/settlements/:id/status`
- **Request**: `{ "status": "approved" | "transferred", "memoKo": "5월분 지급 완료" }`
- **동작**: 권한(`ops_operator` 이상) 확인 후 상태를 변경하고 `ops_audit_events`에 기록합니다.

### 4.3 광고 트래킹 이벤트 (User)
`POST /v1/ads/events`
- **Request**: `{ "partnerId": "p_123", "eventType": "click", "source": "search_result" }`
- **동작**: 클라이언트에서 발생한 이벤트를 수집 큐(또는 Firestore `ad_events` 컬렉션)에 Append-only로 기록합니다.

### 4.4 파트너 정산/광고 조회 (Partner)
- `GET /v1/partner/settlements`: 본인의 정산 원장 목록 및 상세 내역 조회
- `GET /v1/partner/ads/campaigns`: 본인의 광고 캠페인 상태 및 예산 조회
- `PUT /v1/partner/ads/campaigns/:id`: 입찰 단가 및 일일 예산 수정

---

## 5. 설계 원칙 및 주의사항
1. **멱등성과 트랜잭션**: 정산 배치는 실패 후 재시도 시 금액이 중복 합산되지 않도록 엄격한 멱등키와 분산 트랜잭션을 사용해야 합니다.
2. **어뷰징 방지 (Click Fraud)**: 광고 트래킹 API는 악의적인 봇이나 경쟁사의 무효 클릭을 걸러내기 위해 IP, 세션 토큰, 시간 윈도우 기반의 Rate Limiting 로직이 필수적입니다.
3. **불변성 (Immutability)**: 한 번 생성된 `settlements`나 `ad_billings`는 절대 수정할 수 없으며, 오차가 발생하면 다음 정산 주기에 `Adjustment(보정)` 항목을 추가하는 방식으로 회계 무결성을 유지합니다.