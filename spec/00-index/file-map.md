# 파일 맵(File Map)

“어디가 단일 소스인지”를 빠르게 찾기 위한 지도입니다.

## UX
- 모바일/PC UX 개요: `../01-ux/01-ux-overview.md`
- 텍스트 와이어프레임(요약): `../01-ux/02-wireframes.md`
- UI 컴포넌트/카드 스펙(YAML 단일 소스): `../../spec_ui_components_and_cards.yaml`
- UI 카드 계약(JSON Schema): `../02-engine/contracts/ui_cards.schema.json`

## 엔진(오케스트레이션)
- 개요: `../02-engine/01-engine-overview.md`
- 오케스트레이션 단일 소스(YAML): `../../spec_engine_orchestration.yaml`
- API & 이벤트(개발용): `../02-engine/03-api-and-events.md`
- OpenAPI 계약: `../02-engine/openapi_v1.yaml`
- API 공통 규약(에러/멱등성/재시도/레이트리밋): `../02-engine/06-api-error-and-idempotency.md`
- 상태 머신(케이스/문서/결제/정산): `../02-engine/04-state-machines.md`
- 제품 분석(Analytics) 택소노미: `../02-engine/05-analytics-taxonomy.md`
- 이벤트 카탈로그(사람 읽는): `../02-engine/events/domain_events.md`
- 이벤트 Envelope 계약(JSON Schema): `../02-engine/events/case_event.schema.json`

## 사건팩(업무 로직)
- 스키마 단일 소스(YAML): `../../spec_case_pack_schema.yaml`
- v1 사건팩:
  - `../../casepack_corp_incorporation_v1.yaml`
  - `../../casepack_corp_officer_change_v1.yaml`
  - `../../casepack_corp_hq_move_v1.yaml`
- 기타등기 확장 로드맵: `../../spec_other_registry_roadmap.md`

## 파트너(입점)
- 파트너 프로필 스키마: `../../spec_partner_profile_schema.yaml`
- 파트너 프로필 최소 계약(JSON Schema): `../02-engine/contracts/partner_profile.schema.json`
- 가격 룰 DSL: `../../spec_pricing_rules_dsl.yaml`
- 추천/광고/방문 정책: `../../policy_recommendation_ads_offline.md`
- 파트너 온보딩/검증(Verified/Pro): `../04-partners/02-onboarding-and-verification.md`
- 파트너 온보딩 구현(API/DB/승인게이트): `../04-partners/03-onboarding-api-and-db.md`

## AI
- 안전장치(상세): `../../spec_ai_safety_controls.md`
- AI 이벤트 훅: `../../spec_ai_event_hooks.yaml`
- AI 출력 스키마(JSON Schema): `../../spec_ai_output_schema.json`

## 수익화/정산
- 개발용 정리: `../07-revenue/01-monetization-and-settlement.md`
- 정산 이벤트 페이로드 계약(JSON Schema): `../02-engine/contracts/settlement_event.schema.json`
- 결제/PG 웹훅 & 결제 흐름: `../07-revenue/02-pg-webhooks-and-payment-flow.md`
- 원장(복식부기) 매핑: `../07-revenue/03-ledger-mapping.md`
- 정산 상계/회수(파트너 미수금): `../07-revenue/04-offset-and-recovery-policy.md`
- 정산 배치 생성 로직(미수금 상계): `../07-revenue/05-settlement-batch-generation.md`

## 데이터(DB)
- DB 데이터 모델 초안: `../08-data/01-db-model.md`

## 기획(Gap/다음 산출물)
- 개발 기획 관점 Gap 분석: `gap-analysis.md`
- 로드맵 & 백로그(전체 범위): `roadmap-and-backlog.md`

## 구현(Implementation)
- 레포/서비스 아키텍처: `../13-implementation/01-repo-and-service-architecture.md`
- 환경/배포/비밀/마이그레이션/백업: `../13-implementation/02-env-deploy-secrets-migrations-backup.md`
- 테스트/QA 플랜: `../13-implementation/03-test-and-qa-plan.md`
- 시드/로컬 개발 플로우: `../13-implementation/04-seed-and-local-dev.md`
- Firebase+React 핵심 구현 개발 기획(최신): `../13-implementation/07-firebase-react-core-implementation-plan.md`
- Firebase 데이터 모델/Rules(개발 기획): `../13-implementation/08-firebase-data-model-and-security-rules.md`
- Firebase Functions API/배치 설계(개발 기획): `../13-implementation/09-firebase-functions-api-and-jobs-plan.md`
- React 앱 아키텍처/배포(개발 기획): `../13-implementation/10-react-apps-architecture-and-delivery-plan.md`
- Emulator/Rules 테스트 플랜(개발 기획): `../13-implementation/11-firebase-emulator-and-rules-test-plan.md`
- CI/CD & 환경 관리(개발 기획): `../13-implementation/12-firebase-ci-cd-and-env-management.md`
- Observability/운영준비(개발 기획): `../13-implementation/13-firebase-observability-and-ops-readiness.md`
- HTTPS API 계약(Firebase): `../13-implementation/14-firebase-http-api-contract.md`
- Firestore 쿼리/인덱스 플랜: `../13-implementation/15-firestore-query-and-index-plan.md`
- 케이스 타임라인 이벤트 카탈로그: `../13-implementation/16-firebase-case-timeline-event-catalog.md`
- Security Rules 초안(문서): `../13-implementation/17-firebase-security-rules-draft.md`
- Rules 파일(초안): `../13-implementation/firebase.rules/firestore.rules`, `../13-implementation/firebase.rules/storage.rules`
- 개발 착수 체크리스트(Firebase): `../13-implementation/18-dev-kickoff-checklist-firebase.md`
- 프로덕트 수준 모듈 분해/연결성 맵: `../13-implementation/19-product-module-breakdown-and-integration-map.md`
- Phase 0(기반) 모듈화/공용화 작업 계획: `../13-implementation/20-prod-foundation-module-plan.md`
- 프로덕트 미완 기능 백로그(Phase별 실행 계획): `../13-implementation/21-phased-execution-plan-prod-backlog.md`
- 시드 데이터(파트너 샘플): `../13-implementation/seeds/partners.seed.json`
- 시드 데이터(광고 캠페인): `../13-implementation/seeds/ads.seed.json`
- 시드 데이터(케이스 이벤트 스트림): `../13-implementation/seeds/case_events.sample.jsonl`
- 시드 데이터(파생 이벤트 스트림): `../13-implementation/seeds/derived_events.sample.jsonl`
- 스키마 검증 예시: `../13-implementation/05-schema-validation-examples.md`
- 로컬 docker-compose: `../13-implementation/docker-compose.dev.yml`
- 로컬 실행 가이드: `../13-implementation/06-local-run-guide.md`
- 로컬 최소 마이그레이션(SQL): `../13-implementation/migrations/0001_local_dev_core.sql`
- 로컬 확장 마이그레이션(SQL, 케이스/결제/RLS): `../13-implementation/migrations/0002_local_dev_case_money_rls.sql`
- 로컬 미수금 테이블 마이그레이션(SQL): `../13-implementation/migrations/0003_local_dev_receivables.sql`
- 로컬 시드 로더(Python): `../13-implementation/tools/seed_postgres.py`
- 로컬 이벤트 로더(Python): `../13-implementation/tools/load_domain_events.py`
- 계약 검증 도구(Python): `../13-implementation/tools/validate_contracts.py`
- RLS 스모크 테스트(SQL): `../13-implementation/tools/rls_smoke_test.sql`
- 이벤트 리플레이 스캐폴딩(Python): `../13-implementation/tools/replay_case_snapshot.py`
- 원클릭 로컬 데모 러너(Python): `../13-implementation/tools/run_local_demo.py`
- 로컬 파이썬 의존성(requirements): `../13-implementation/tools/requirements.local.txt`

## 운영(Ops)
- 운영 콘솔 요구사항: `../09-ops/01-ops-console-requirements.md`
- AI 운영 자동화 스펙: `../09-ops/02-ai-ops-automation.md`
- 수동검토 플레이북: `../09-ops/03-manual-review-playbook.md`
- CS/분쟁/환불 플레이북: `../09-ops/04-cs-and-dispute-handling.md`
- SLA 정책: `../09-ops/05-sla-policy.md`
- 승인 게이트 시스템: `../09-ops/06-approval-gate-system.md`

## 보안/권한/문서보관
- 인증/권한(Auth-RBAC-RLS): `../10-security/01-auth-rbac-rls.md`
- 문서 저장/보관/삭제(수명주기): `../10-security/02-document-storage-and-retention.md`

## 플랫폼(관측/알림)
- 운영 관측 & 알림: `../11-platform/01-observability-and-alerting.md`

## 법무/약관/고지
- 약관/개인정보/AI·광고 고지 템플릿: `../12-legal/01-terms-privacy-disclosures.md`
