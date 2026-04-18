# 제품 분석(Analytics) 택소노미 — v1

목표: “이탈률/전환율/품질/정산”을 **데이터로 운영**하기 위한 이벤트/속성 표준을 정의한다.  
원칙: 도메인 이벤트(`domain_events`)는 감사/대사 중심이고, 제품 분석 이벤트는 퍼널/UX 중심이다.  
가능하면 **하나의 이벤트를 두 목적(감사+분석) 모두에 쓰되**, 과도한 PII를 포함하지 않는다.

---

## 0) 네이밍/구조 규칙

### 0.1 이벤트 네이밍
- 형식: `NAMESPACE_ACTION` (대문자 스네이크)
- 예: `FUNNEL_INTENT_SUBMITTED`, `RESULTS_VIEWED`, `DOC_UPLOAD_STARTED`

> 이미 도메인 이벤트 카탈로그(`02-engine/events/domain_events.md`)가 있으므로, 제품 분석은 “도메인 이벤트 + UX 이벤트”로 구성한다.

### 0.2 공통 속성(모든 이벤트)
| 필드 | 타입 | 설명 |
|---|---|---|
| `eventId` | string | (선택) 분석 파이프라인용 ID |
| `occurredAt` | string(datetime) | 발생 시각 |
| `sessionId` | string | 게스트 포함 세션 |
| `userId` | string? | 로그인 시에만 |
| `caseId` | string? | 케이스 생성 이후 |
| `partnerId` | string? | 파트너 선택/진행 이후 |
| `platform` | string | `web/pwa/ios/android/partner_pc/ops_pc` |
| `appVersion` | string? | 클라이언트 버전 |
| `requestId` | string? | 서버 처리 추적 |
| `correlationId` | string? | 여정 단위 상관관계 |
| `ab` | object? | 실험 키/버킷 |

### 0.3 개인정보(PII) 금지
분석 이벤트에는 아래를 넣지 않는다.
- 주민번호/사업자번호/계좌/카드, 이메일/전화 원문, 문서 OCR 원문
- 자연어 입력(intentText) 원문도 **원칙적으로 금지**(필요 시 해시/카테고리화)

권장:
- `intentCategory`(분류 결과), `intentLength`, `containsRegionHint` 등 파생값만

---

## 1) KPI ↔ 이벤트 매핑

### 1.1 핵심 KPI(UX 스펙 참조)
참조: `01-ux/01-ux-overview.md`

| KPI | 정의 | 측정 이벤트 |
|---|---|---|
| 홈→진단 시작률 | Home 진입 대비 Intent 제출 | `FUNNEL_HOME_VIEWED` / `INTENT_SUBMITTED` |
| 진단 완료율 | 진단 시작 대비 결과 진입 | `DIAGNOSIS_STARTED` / `RESULTS_VIEWED` |
| 파트너 선택률 | 결과 노출 대비 선택 | `RESULTS_VIEWED` / `PARTNER_SELECTED` |
| TTFU | 파트너 선택→첫 업로드 시간 | `PARTNER_SELECTED` / `DOCUMENT_UPLOADED` |
| 보완요청률 | 검토 대비 보완필요 비율 | `DOCUMENT_REVIEWED(decision=보완필요)` |
| SLA 준수율 | SLA 브리치 비율 | `SLA_BREACH_DETECTED` |

---

## 2) 퍼널 이벤트(필수)

### 2.1 Home
- `FUNNEL_HOME_VIEWED`
  - props: `entryPoint`(deeplink/organic/ad), `referrerDomain`(가능 시)

- `INTENT_SUBMITTED` *(도메인 이벤트 재사용)*
  - props(추가): `intentCategory`(예: 법인-임원변경), `intentLength`, `categoryHintUsed`

### 2.2 Diagnosis
- `DIAGNOSIS_STARTED`
  - props: `candidateCasePackIds`(1~3), `firstQuestionId`

- `DIAGNOSIS_ANSWERED` *(도메인 이벤트 재사용)*
  - props(추가): `questionId`, `answerType`(single/multi/text), `questionIndex`

- `DIAGNOSIS_COMPLETED`
  - props: `questionCount`, `elapsedSeconds`, `finalCasePackId`

### 2.3 Results
- `RESULTS_VIEWED` *(도메인 이벤트 재사용)*
  - props(추가): `resultSetId`, `rankedCount`, `sponsorShown`(bool)

- `RESULTS_COMPARE_OPENED`
  - props: `rank`(1~3), `partnerId`

- `PARTNER_SELECTED` *(도메인 이벤트 재사용)*
  - props(추가): `selectedRank`, `selectionMethod`(recommended/compare/sponsor)

---

## 3) 케이스/문서 이벤트(필수)

- `CASE_CREATED` *(도메인 이벤트 재사용)*

- `DOC_UPLOAD_STARTED`
  - props: `slotId?`, `fileType`, `sizeBucket`

- `DOCUMENT_UPLOADED` *(도메인 이벤트 재사용)*
  - props(추가): `slotId?`, `mimeType`, `sizeBytesBucket`

- `DOCUMENT_CLASSIFIED` *(도메인 이벤트 재사용)*
  - props(추가): `method`(ai/user/partner/ops), `confidence`

- `DOCUMENT_REVIEW_REQUESTED` / `DOCUMENT_REVIEWED` *(도메인 이벤트 재사용)*
  - props(추가): `decision`, `issueCount`, `criticalIssueCount`

- `FIX_REQUEST_SENT` / `FIX_SUBMITTED` *(도메인 이벤트 재사용)*

---

## 4) 결제/정산 이벤트(필수)

도메인 이벤트를 분석에도 재사용하되, **금액은 버킷/범위**로만 측정(PII/민감 최소화).

- `QUOTE_FINALIZED`
  - props: `priceMinBucket`, `priceMaxBucket`, `etaBucket`

- `PAYMENT_AUTHORIZED` / `PAYMENT_CAPTURED`
  - props: `amountBucket`, `method`

- `REFUND_REQUESTED` / `REFUND_APPROVED` / `REFUND_EXECUTED`
  - props: `refundAmountBucket`, `reasonCategory`

- `SETTLEMENT_TO_PARTNER_CREATED` / `SETTLEMENT_TO_PARTNER_PAID`
  - props: `netAmountBucket`

---

## 5) 광고 이벤트(필수)

- `SPONSOR_IMPRESSION` *(도메인 이벤트 재사용)*
  - props: `campaignId`, `placement`(carousel/top/bottom), `position`

- `SPONSOR_CLICKED` *(도메인 이벤트 재사용)*
  - props: `campaignId`, `placement`, `position`

부정 클릭/중복 제거:
- 동일 sessionId + campaignId + 짧은 구간(예: 5초) 중복 제거(정책)

---

## 6) 데이터 품질 규칙(필수)

### 6.1 중복/유실 방지
- 클라이언트 이벤트는 배치 전송 가능(오프라인 대비)
- 서버 수신 시 `requestId`/`eventId`로 중복 제거

### 6.2 이벤트 버전
- 이벤트마다 `schemaVersion` 포함 권장(예: `v1`)
- 변경은 “추가” 위주(필드 제거 금지)

### 6.3 카디널리티 제한
대량 고유값(예: intentText 원문) 금지.
- `intentCategory`처럼 분류된 값만 허용

