# 개발 기획 관점 Gap 분석(v1)

목표: 현재 spec(UX/엔진/사건팩/파트너/AI/정산/이벤트/DB)는 “아키텍처·계약” 중심으로 잘 정리되어 있습니다.  
다만 **실제 개발 착수/스프린트 운영**을 위해서는 “기획 산출물(요구사항/상태머신/운영 SOP/관측/법무)” 계층이 추가로 필요합니다.

---

## A. 제품 기획(백로그/범위/수용 기준) — 현재 공백이 큰 영역

### A1) MVP 범위 정의서(반드시)
- 무엇을 **v1에서 한다/안 한다**가 문서로 고정되어야 개발이 흔들리지 않음
- 각 기능의 “완료(Definition of Done)” / “데이터 로그(이벤트)”까지 포함

권장 산출물:
- `spec/00-index/roadmap-and-mvp-scope.md`
- `spec/00-index/backlog-epics-and-stories.md` (Epic → User Story → Acceptance Criteria)

### A2) 상태 머신(케이스/문서/결제/환불) (반드시)
현재는 문서/정산에서 개념적으로 언급되어 있으나, 구현을 위해서는 상태 전이 표가 필요.

권장 산출물:
- `spec/02-engine/04-state-machines.md`
  - case_status 전이(예: new → in_progress → waiting_user …)
  - document_slot_status 전이(미업로드/검토중/OK/보완필요)
  - payment/refund/settlement 상태 전이

### A3) 화면별 요구사항(상세) + 마이크로카피(추천)
UX 개요는 있으나, 개발 기획에서는:
- 화면별 필수 필드/예외 케이스/empty state/오류 state
- 알림 문구/동의 문구/책임분리 문구
가 추가로 필요.

권장 산출물:
- `spec/01-ux/04-screen-requirements.md`
- `spec/01-ux/05-copy-and-disclosures.md`

---

## B. 운영 기획(Ops/CS/SOP) — “플랫폼” 성공의 핵심

### B1) 운영 콘솔 요구사항(수동검토/분쟁/환불/정산) (필수)
Ops 콘솔이 있어야 “Manual review” 안전밸브가 실제로 작동합니다.

권장 산출물:
- `spec/09-ops/01-ops-console-requirements.md`
- `spec/09-ops/02-manual-review-playbook.md`

### B2) CS(고객지원)/분쟁 처리 플로우(필수)
환불/클레임/파트너 변경/반려 등은 CS 플로우가 없으면 운영이 무너짐.

권장 산출물:
- `spec/09-ops/03-cs-and-dispute-handling.md`

### B3) SLA 정의서 + 타이머 정책(필수)
SLA는 용어만 있으면 안 되고, “측정 시작점/정지점/예외”가 필요.

권장 산출물:
- `spec/09-ops/04-sla-policy.md`

---

## C. 파트너 온보딩/컴플라이언스(입점) — 신뢰/광고/정산을 위해 필요

### C1) 파트너 입점 온보딩 플로우 + 검증(Verified/Pro) 정책(필수)
파트너 등급이 광고/추천/노출에 직접 연결되므로, 검증 기준이 문서화되어야 함.

권장 산출물:
- `spec/04-partners/02-onboarding-and-verification.md`
  - 제출 서류, 심사, 갱신 주기
  - 위반/정지 정책

### C2) 파트너 결제(구독)/청구서/세금계산서(선택~중요)
파트너 SaaS 구독을 한다면:
- 플랜/청구/연체/다운그레이드 정책이 필요.

권장 산출물:
- `spec/07-revenue/02-partner-saas-billing.md`

---

## D. 기술 기획(비기능/보안/관측/테스트) — “서비스 운영”에 필수

### D1) 인증/권한/세션 정책(필수)
현재 DB 모델에는 users/sessions가 있지만,
- 로그인(카카오/애플/구글/휴대폰) 범위
- 파트너/운영 계정 발급/2FA
- RLS 적용 범위
가 기획/정책으로 고정되어야 합니다.

권장 산출물:
- `spec/10-security/01-auth-rbac-rls.md`

### D2) 파일 저장/문서 수명주기/버전 정책(필수)
문서 업로드는 “저장소/암호화/백업/보관기간/삭제요청”이 있어야 함.

권장 산출물:
- `spec/10-security/02-document-storage-and-retention.md`

### D3) 관측(Analytics + Observability) (필수)
- 퍼널 KPI 측정을 위한 이벤트(제품 분석)
- 장애 대응을 위한 메트릭/트레이싱/알람(운영 관측)

권장 산출물:
- `spec/02-engine/05-analytics-taxonomy.md`
- `spec/11-platform/01-observability-and-alerting.md`

### D4) API 계약(OpenAPI) + 오류/재시도/멱등성(필수)
현재는 REST 예시 문서가 있으나, 개발에는 다음이 필요:
- OpenAPI 스펙(요청/응답/에러코드)
- idempotency key, retry policy, rate limiting

권장 산출물:
- `spec/02-engine/openapi_v1.yaml`
- `spec/02-engine/06-api-error-and-idempotency.md`

---

## E. 법무/약관/책임분리 문서(필수에 가까움)
AI/플랫폼 책임분리, 광고 라벨, 개인정보 처리 등은 UI만으로는 부족하고 문서/약관이 필요.

권장 산출물:
- `spec/12-legal/01-terms-privacy-disclosures.md` (초안 템플릿 수준이라도)

---

## 추천 진행 순서(개발 착수 기준)
1) **MVP 범위 + 백로그(에픽/스토리/수용기준)**  
2) **상태 머신(케이스/문서/결제/환불)**  
3) **Ops 콘솔 요구사항 + 수동검토 플레이북**  
4) **Auth/RBAC/RLS + 문서 저장/보관 정책**  
5) **OpenAPI + 오류/멱등성/재시도 규칙**  

