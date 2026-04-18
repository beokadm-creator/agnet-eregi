# 구현 준비물(3): 테스트·QA 플랜 — v1

목표: 등기/정산/운영(AI 포함) 시스템은 “한 번의 버그”가 금전/법무/신뢰 문제로 이어질 수 있으므로, 테스트는 기능 확인이 아니라 **사고 방지 장치**로 설계한다.

참조:
- 상태 머신: `02-engine/04-state-machines.md`
- OpenAPI: `02-engine/openapi_v1.yaml`
- 이벤트 계약: `02-engine/events/case_event.schema.json`
- 카드 계약: `02-engine/contracts/ui_cards.schema.json`
- 보안: `10-security/*`
- 관측/알림: `11-platform/01-observability-and-alerting.md`

---

## 0) 테스트 레이어(피라미드)

1) **Unit**: 규칙/정책/계산(결정적)  
2) **Contract**: JSON Schema/OpenAPI 검증  
3) **Integration**: DB+RLS+이벤트 저장+오케스트레이션  
4) **E2E**: 퍼널→케이스→문서→견적→결제→환불→정산  
5) **Chaos/DR**: 웹훅 유실/중복, 백업 복구

---

## 1) 계약(Contract) 테스트(필수)

### 1.1 카드 계약 검증
- 대상: 모든 UI 응답(`CardsResponse.cards`)
- 기준: `02-engine/contracts/ui_cards.schema.json`
- 요구:
  - 카드 타입별 required 필드 누락 시 실패
  - disclosures(광고/확정아님) 규칙 위반 시 실패

### 1.2 이벤트 계약 검증
- 대상: `domain_events.data_json`에 저장되는 payload
- 기준:
  - `02-engine/events/case_event.schema.json` (envelope+payload)
  - `02-engine/contracts/settlement_event.schema.json` (money events 세부)

### 1.3 OpenAPI 스펙 검증
- `openapi_v1.yaml` lint/validate
- 호환성 규칙:
  - breaking change 금지(필드 제거/타입 변경)
  - 신규 필드는 optional로 추가

---

## 2) 상태 머신 기반 시나리오 테스트(핵심)

### 2.1 케이스 상태 전이 시나리오
참조: `02-engine/04-state-machines.md`

필수 시나리오:
1) 정상 플로우:
   - `CASE_CREATED` → `CASE_ACCEPTED` → `CASE_COMPLETED`
2) 사용자 대기 플로우:
   - `FIX_REQUEST_SENT` → `waiting_user` → `FIX_SUBMITTED` → 재검토
3) 수동검토 플로우:
   - `RISK_FLAGGED` → `CASE_ESCALATED_TO_OPS` → ops 재개
4) 취소/환불 플로우:
   - `CASE_CANCELLED` + `REFUND_*` 연계

검증 포인트:
- 금지 전이(예: completed에서 in_progress로) 방지
- 전이마다 필수 이벤트가 기록되는지

### 2.2 문서 슬롯 상태 전이
- 업로드 시 `미업로드 → 검토중`
- 검토 확정 시 `검토중 → OK/보완필요`
- 보완 제출 시 `보완필요 → 검토중`

---

## 3) 멱등성/중복 처리 테스트(필수)

참조: `02-engine/06-api-error-and-idempotency.md`

필수 항목:
- `Idempotency-Key` 동일 요청 재전송 시 동일 응답 반환
- 결제/웹훅 중복 수신 시 1회만 반영
- 이벤트 저장은 requestId/correlationId로 중복 방지

---

## 4) 결제/환불/정산 테스트(고위험)

참조:
- `07-revenue/02-pg-webhooks-and-payment-flow.md`
- `07-revenue/03-ledger-mapping.md`

### 4.1 PG 웹훅 시나리오
- 승인 성공/매입 성공
- 승인 성공 후 매입 실패
- 웹훅 유실 후 배치 리컨실리에이션으로 보강
- 웹훅 중복(멱등)

### 4.2 원장/대사
- `PAYMENT_CAPTURED` 시 분개 생성(실비/파트너/플랫폼 분리)
- 부분 환불 시 분개/정산 차감 반영
- `SETTLEMENT_VOIDED` 후 역분개 + 재생성 가능

---

## 5) 보안 테스트(필수)

### 5.1 RBAC
- ops/partner/user 권한 없는 endpoint 접근 차단(403)

### 5.2 RLS(가장 중요)
- partner A가 partner B의 case/document 접근 시 DB 레벨 차단
- user가 타 user의 case 접근 차단

### 5.3 PII/OCR 접근
- 기본 차단 확인
- 승인 게이트 후 임시 접근만 가능
- audit_logs 기록 강제

---

## 6) 부하/성능 테스트(권장)

핵심 지표:
- `/intent`, `/diagnosis/answer`, `/results` p95 지연
- 문서 업로드 처리량/실패율
- 이벤트 저장/조회 지연

시나리오:
- 피크 유입(광고/캠페인)
- 파트너 콘솔 동시 접속(케이스 큐)

---

## 7) 운영 AI 테스트(권장)

참조: `09-ops/02-ai-ops-automation.md`

필수:
- AI가 “금지 액션”을 직접 수행하지 못함(승인 게이트 강제)
- AI 출력에 근거/불확실성/버전 포함
- 실패 시 큐로 라우팅(조용한 실패 금지)

---

## 8) 테스트 데이터/픽스처(연계)

다음 문서에서 샘플 케이스팩/파트너/문서를 제공해야 E2E가 가능:
- `13-implementation/04-seed-and-local-dev.md` (다음 단계)

