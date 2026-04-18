# 구현 준비물(1): 레포 구조/서비스 분리/모듈 경계 — v1

목표: 현재 spec(UX/엔진/이벤트/DB/보안/운영/정산)를 실제 코드베이스로 옮기기 위한 “구현 청사진”을 제공한다.  
원칙: **계약(스키마) 중심**, 이벤트/감사 기반, 운영 AI가 도구를 호출해도 안전한 구조.

---

## 0) 권장 아키텍처 선택지

### 선택지 A) 모듈러 모놀리식(권장 시작점)
장점:
- 초기 개발 속도/트랜잭션/운영 단순
- 이벤트 저장소/권한/RLS를 빠르게 고정 가능

단점:
- 팀이 커지면 경계가 흐려질 수 있음 → 모듈 경계 규칙이 중요

### 선택지 B) 마이크로서비스(추후)
분리 후보:
- payment/settlement, document processing, search/ranking, ops tooling

> 본 문서는 “A로 시작하되 B로 자연스럽게 쪼갤 수 있게” 경계를 정의한다.

---

## 1) 모듈 경계(도메인별 소유권)

### 1.1 Core Domains
1) Funnel/Session (intent, diagnosis, results)
2) Case (case workspace, status machine)
3) Partner (profile, onboarding, quality metrics)
4) Document (slots, versions, review)
5) Quote/Payment/Refund (money workflow)
6) Settlement/Ledger (reconciliation)
7) Ads (sponsor campaigns, impressions/clicks)
8) Ops (queues, approvals, audit)

### 1.2 Shared Foundations
- Auth/RBAC/RLS
- Event Store (`domain_events`)
- Schema Registry (JSON Schema/OpenAPI)
- Observability/Feature Flags

---

## 2) 레포 구조(권장: Monorepo)

예시(언어/프레임워크 무관):
```
repo/
  apps/
    api-server/            # REST(OpenAPI) + auth + RLS gateway
    mobile-web/            # PWA/앱(카드 렌더링)
    partner-console/       # PC 파트너 업무 콘솔
    ops-console/           # PC 운영 콘솔
  packages/
    spec-contracts/        # JSON Schema/OpenAPI 소스(또는 git subdir로 spec 동기화)
    domain-events/         # 이벤트 타입/producer/trace 유틸
    policy-engine/         # 광고/추천/환불/SLA 규칙 엔진(결정적)
    ai-tooling/            # AI 호출 래퍼(권한/로그/버전)
    db/                    # migrations, seed, RLS policies
  spec/                    # (현재 폴더) 단일 소스 스펙
```

권장 규칙:
- `spec/`은 “단일 소스”로 유지하고, `packages/spec-contracts`가 이를 빌드/배포용으로 변환(예: schema bundle)

---

## 3) 서비스(프로세스) 경계(모놀리식 내부 모듈 → 추후 서비스화)

### 3.1 API Server (Gateway + Orchestrator)
책임:
- OpenAPI endpoint 제공
- 인증/권한 체크(RBAC) + DB RLS 적용 전제
- 엔진 호출 오케스트레이션(규칙/AI)
- 이벤트 발행(`domain_events` append-only)

참조:
- OpenAPI: `02-engine/openapi_v1.yaml`
- 오케스트레이션: `spec_engine_orchestration.yaml`

### 3.2 Engines (라이브러리/내부 서비스)
초기에는 동일 프로세스 내 모듈로 두고, 경계는 “인터페이스”로 고정:
- intent_router
- casepack_rule_engine
- partner_search_ranker
- pricing_engine
- eta_engine
- doc_review_engine
- notification_engine

추후 분리 가능한 형태:
- `EngineInput`/`EngineOutput`를 명시적으로 타입화(스키마)
- 호출 로그/버전(감사)

### 3.3 Payment Adapter
책임:
- PG 연동(승인/매입/웹훅)
- 멱등성/대사
- 결제 관련 이벤트 발행

참조:
- `07-revenue/02-pg-webhooks-and-payment-flow.md`

### 3.4 Settlement/Ledger
책임:
- 이벤트 → 분개 생성(append-only)
- 정산 배치 생성/지급
- 대사 리포트

참조:
- `07-revenue/03-ledger-mapping.md`

---

## 4) 데이터 계약 배치(개발 규칙)

### 4.1 계약의 “단일 소스”
- UI 카드 계약: `02-engine/contracts/ui_cards.schema.json`
- 이벤트 envelope: `02-engine/events/case_event.schema.json`
- 정산 이벤트: `02-engine/contracts/settlement_event.schema.json`
- OpenAPI: `02-engine/openapi_v1.yaml`

### 4.2 CI에서 해야 하는 것(필수)
- JSON Schema 유효성 검사
- OpenAPI 스펙 lint/validate
- (권장) 예시 payload를 스키마로 검증하는 contract test

---

## 5) 상태/이벤트/스냅샷 설계 규칙(필수)

원칙:
- “진실”은 이벤트(`domain_events`)
- 화면/검색 성능을 위해 `cases/documents/...` 스냅샷 테이블을 유지
- 스냅샷은 이벤트로부터 재구성 가능해야 함(재현/복구)

참조:
- DB: `08-data/01-db-model.md`
- 상태 머신: `02-engine/04-state-machines.md`

---

## 6) 구현 체크리스트(바로 착수용)
- [ ] spec를 코드 레포에 포함(서브모듈/서브트리/동기화 방식 결정)
- [ ] `domain_events` 테이블 + append-only write 경로 구현
- [ ] auth/rbac/rls 기본 골격 구현
- [ ] 카드 응답(CardsResponse) 엔드포인트 3개(`/intent`, `/diagnosis/answer`, `/results`) 구현
- [ ] 케이스/문서 업로드 기본 플로우 구현

