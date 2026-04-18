# API & 이벤트 스펙(개발용) — v1

목표: 프론트(모바일/PC)와 엔진(규칙+AI), 그리고 파트너/정산 시스템이 “데이터 계약”으로 붙게 한다.

> 이 문서는 API/이벤트의 “형태”를 정의합니다. 실제 구현 언어/프레임워크는 독립입니다.

---

## 1) 아키텍처 원칙

1. **UX는 카드(JSON)로 렌더링**: 홈/진단/결과는 서버가 준 카드 묶음으로 표현(AB 테스트/개선 용이)
2. **규칙 엔진은 결정적**: 같은 입력이면 같은 출력(재현/감사)
3. **AI는 추천/초안**: 확정은 승인 게이트 + 로그
4. **이벤트는 감사/정산의 뼈대**: 최소 이벤트 세트로도 대사 가능해야 함

---

## 2) UI 카드 계약(단일 소스)

- `02-engine/contracts/ui_cards.schema.json`

카드 예시:
- `value_preview`: 진단 중 가치(비용/시간/준비물) 프리뷰
- `recommended_partner`: 추천 1안
- `compare_list_top3`: 비교 Top3
- `sponsor_carousel`: 광고(라벨 고정)
- `doc_slot`, `ai_review`: 사건 진행(업로드/검토)

---

## 3) 모바일(사용자) API (REST 예시)

> 계약 파일:
> - OpenAPI: `02-engine/openapi_v1.yaml`
> - 공통 에러/멱등성/재시도/레이트리밋: `02-engine/06-api-error-and-idempotency.md`

### 3.1 Intent → 진단 시작

`POST /v1/intent`

입력:
- intentText (자연어)
- categoryHint(optional)
- sessionId(게스트 세션)

출력(카드):
- 초기 `DiagnosisQuestionCard` + `ValuePreviewCard`(초기값)

### 3.2 진단 응답

`POST /v1/diagnosis/answer`

입력:
- sessionId
- casePackId(optional: 후보 중 확정된 경우)
- answerDelta (단일 문항 응답)

출력(카드):
- 다음 질문 카드
- 업데이트된 `ValuePreviewCard`

### 3.3 결과 리스트

`GET /v1/results?sessionId=...`

출력(카드):
- `RecommendedPartnerCard`
- `CompareListTop3`
- `SponsorCarousel`

### 3.4 파트너 선택 → 사건 생성

`POST /v1/cases`

입력:
- sessionId
- selectedPartnerId
- finalCasePackId
- caseInput (현재까지 확정된 입력)

출력:
- caseId
- 사건 워크스페이스 초기 카드(문서 슬롯/체크리스트/다음 할 일)

---

## 4) 사건 워크스페이스 API (모바일/PC 공통)

### 4.1 케이스 조회

`GET /v1/cases/{caseId}`

출력:
- 상태, 체크리스트, 문서 슬롯, 타임라인 이벤트, 카드(요약)

### 4.2 문서 업로드(버전 생성)

`POST /v1/cases/{caseId}/documents`

서버 동작:
- DOCUMENT_UPLOADED 이벤트 생성
- doc_review_engine 트리거(슬롯 분류/불일치 후보)

### 4.3 문서 검토 요청/결과 확정(파트너)

`POST /v1/cases/{caseId}/review/request`
`POST /v1/cases/{caseId}/review/decision`

가드:
- 메시지 발송/보완요청은 승인 게이트(파트너/운영)

### 4.4 견적 확정/사용자 동의

`POST /v1/cases/{caseId}/quote/finalize`  (partner/ops)
`POST /v1/cases/{caseId}/quote/accept`    (user)

출력:
- QUOTE_FINALIZED 이벤트 + 동의 로그

---

## 5) 이벤트 토픽(사람 읽는 단일 소스)

- `02-engine/events/domain_events.md`

운영 권장:
- 모든 이벤트는 `caseId`, `partnerId(optional)`, `requestId(optional)`를 포함
- 이벤트 저장소는 불변(append-only) + 감사 조회 가능

---

## 6) 다음 단계(추가해야 할 계약 파일)

1. `02-engine/events/case_event.schema.json` : 공통 이벤트 envelope(감사/대사)
2. `02-engine/contracts/partner_profile.schema.json` : 파트너 카드 렌더링 최소 필드
3. `02-engine/contracts/settlement_event.schema.json` : 결제/환불/정산 이벤트 페이로드
