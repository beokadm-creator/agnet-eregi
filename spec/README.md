# Spec Pack (개발용)

이 폴더는 “등기 업무 대행 플랫폼(모바일 사용자 + PC 파트너/운영 콘솔)”을 **개발 에이전트/개발자**가 바로 구현할 수 있도록, 문서(DOCX) 기반 산출물을 **MD/YAML/JSON 중심으로 재구성**한 스펙 저장소입니다.

## 빠른 시작(추천 읽기 순서)

1. **UX 개요**: [`01-ux/01-ux-overview.md`](01-ux/01-ux-overview.md)  
2. **엔진(규칙+AI) 오케스트레이션**: [`02-engine/01-engine-overview.md`](02-engine/01-engine-overview.md) + [`02-engine/02-orchestration.md`](02-engine/02-orchestration.md)  
3. **파트너(입점) 플랫폼**: [`04-partners/01-partner-platform.md`](04-partners/01-partner-platform.md)  
   - 온보딩/검증(Verified/Pro): [`04-partners/02-onboarding-and-verification.md`](04-partners/02-onboarding-and-verification.md)
   - 온보딩 구현(API/DB/승인게이트): [`04-partners/03-onboarding-api-and-db.md`](04-partners/03-onboarding-api-and-db.md)
4. **사건팩(Case Pack) 구조**: [`03-casepacks/01-casepack-system.md`](03-casepacks/01-casepack-system.md)  
5. **AI 안전장치/승인게이트**: [`05-ai/01-ai-safety.md`](05-ai/01-ai-safety.md)  
6. **정책(광고/추천/방문)**: [`06-policies/01-recommendation-ads-offline.md`](06-policies/01-recommendation-ads-offline.md)  
7. **수익화 & 회계/세무(정산)**: [`07-revenue/01-monetization-and-settlement.md`](07-revenue/01-monetization-and-settlement.md)
8. **DB 데이터 모델**: [`08-data/01-db-model.md`](08-data/01-db-model.md)
9. **상태 머신(케이스/문서/결제/정산)**: [`02-engine/04-state-machines.md`](02-engine/04-state-machines.md)
10. **OpenAPI 계약**: [`02-engine/openapi_v1.yaml`](02-engine/openapi_v1.yaml) + [`02-engine/06-api-error-and-idempotency.md`](02-engine/06-api-error-and-idempotency.md)
11. **구현 준비물(레포/배포/QA/시드)**: [`13-implementation/01-repo-and-service-architecture.md`](13-implementation/01-repo-and-service-architecture.md) → [`13-implementation/04-seed-and-local-dev.md`](13-implementation/04-seed-and-local-dev.md)
   - 로컬 실행: [`13-implementation/docker-compose.dev.yml`](13-implementation/docker-compose.dev.yml), [`13-implementation/06-local-run-guide.md`](13-implementation/06-local-run-guide.md)
12. **Firebase + React 기반 핵심 기능 구현 개발 기획(최신)**: [`13-implementation/07-firebase-react-core-implementation-plan.md`](13-implementation/07-firebase-react-core-implementation-plan.md)
    - 데이터 모델/Rules: [`13-implementation/08-firebase-data-model-and-security-rules.md`](13-implementation/08-firebase-data-model-and-security-rules.md)
    - Functions API/배치: [`13-implementation/09-firebase-functions-api-and-jobs-plan.md`](13-implementation/09-firebase-functions-api-and-jobs-plan.md)
    - React 앱 아키텍처/배포: [`13-implementation/10-react-apps-architecture-and-delivery-plan.md`](13-implementation/10-react-apps-architecture-and-delivery-plan.md)
    - Emulator/Rules 테스트: [`13-implementation/11-firebase-emulator-and-rules-test-plan.md`](13-implementation/11-firebase-emulator-and-rules-test-plan.md)
    - CI/CD & 환경 관리: [`13-implementation/12-firebase-ci-cd-and-env-management.md`](13-implementation/12-firebase-ci-cd-and-env-management.md)
    - Observability/운영준비: [`13-implementation/13-firebase-observability-and-ops-readiness.md`](13-implementation/13-firebase-observability-and-ops-readiness.md)
    - HTTPS API 계약: [`13-implementation/14-firebase-http-api-contract.md`](13-implementation/14-firebase-http-api-contract.md)
    - 쿼리/인덱스 플랜: [`13-implementation/15-firestore-query-and-index-plan.md`](13-implementation/15-firestore-query-and-index-plan.md)
    - 타임라인 이벤트 카탈로그: [`13-implementation/16-firebase-case-timeline-event-catalog.md`](13-implementation/16-firebase-case-timeline-event-catalog.md)
    - Rules 초안(파일/가이드): [`13-implementation/17-firebase-security-rules-draft.md`](13-implementation/17-firebase-security-rules-draft.md)
    - 개발 착수 체크리스트: [`13-implementation/18-dev-kickoff-checklist-firebase.md`](13-implementation/18-dev-kickoff-checklist-firebase.md)
    - 프로덕트 모듈 분해/연결성/누락 방지 맵: [`13-implementation/19-product-module-breakdown-and-integration-map.md`](13-implementation/19-product-module-breakdown-and-integration-map.md)

## 스펙 “단일 소스” 원칙

- 사람이 읽는 스펙: **Markdown(.md)**  
- 시스템/엔진이 읽는 스펙: **YAML/JSON** (가격 룰, 사건팩, UI 카드 계약 등)  
- DOCX는 공유/리뷰에는 좋지만, 구현 스펙의 단일 소스로는 비효율 → 변환본은 `99-docx-converted/`에 보관

## 폴더 구조

- `00-index/` : 전체 인덱스/용어집/결정사항 로그
- `01-ux/` : 모바일 사용자 UX, PC 파트너/운영 콘솔 UX
- `02-engine/` : 엔진(규칙+AI) 구성, 오케스트레이션, 승인게이트, 캐시/로그 규칙
- `03-casepacks/` : 사건팩(업무 로직) 시스템과 확장 방법
- `04-partners/` : 입점 파트너 프로필/가격표/용량/SLA/품질 지표 및 노출 규칙
- `05-ai/` : AI 안전장치, 이벤트 훅, 출력 스키마, 프롬프트/인젝션 방어
- `06-policies/` : 추천/광고/오프라인 방문 정책, 책임분리 표기 규칙
- `07-revenue/` : 수익화, 결제, 정산, 회계/세무, 환불/대사
- `08-data/` : DB 모델(테이블/필드/인덱스/RBAC/RLS/이벤트 저장소)
- `09-ops/` : 운영 콘솔 요구사항, 수동검토/CS/SLA 플레이북, 운영 AI 자동화
- `10-security/` : 인증/권한(RBAC/RLS), 문서 저장/암호화/보관/삭제(수명주기)
- `11-platform/` : 운영 관측(로그/메트릭/트레이싱), 알림/런북, SLO
- `12-legal/` : 약관/개인정보/AI·광고·방문 고지 템플릿, 동의 로그(증빙) 정책
- `13-implementation/` : 구현 착수용 가이드(레포 구조/배포/비밀/QA/시드/로컬 재현)
- `99-docx-converted/` : 기존 DOCX 산출물의 MD 변환본(참고용)
