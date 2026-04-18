# 파트너 온보딩 구현 스펙: API/DB/승인게이트 — v1

목표: `04-partners/02-onboarding-and-verification.md`의 “업무 플로우”를 실제 구현 단위(API/DB/권한/승인게이트/이벤트)로 내린다.

참조:
- OpenAPI(기본): `02-engine/openapi_v1.yaml`
- 승인게이트 이벤트: `02-engine/events/case_event.schema.json` (`APPROVAL_*`)
- 파트너 이벤트: `02-engine/events/domain_events.md` (`PARTNER_*`)
- 보안/권한: `10-security/01-auth-rbac-rls.md`
- DB 초안: `08-data/01-db-model.md`

---

## 1) 주요 엔드포인트(요약)

> 상세 계약은 OpenAPI에 반영한다.

### 1.1 파트너(셀프 서비스)
- `POST /v1/partners/onboarding/draft`
  - 온보딩 초안 생성(=onboardingId 발급)
- `PUT /v1/partners/onboarding/{onboardingId}`
  - 섹션별 업데이트(identity/license/payout/capabilities/pricing/sla/capacity/compliance)
- `POST /v1/partners/onboarding/{onboardingId}/submit`
  - 제출(심사 대기)
- `GET /v1/partners/onboarding/{onboardingId}`
  - 상태 조회(under_review/needs_fix/approved/rejected 등)

### 1.2 운영(Ops)
- `GET /v1/ops/partners/onboarding?status=...`
  - 심사 큐 조회
- `POST /v1/ops/partners/onboarding/{onboardingId}/decision`
  - 결정(approve/reject/needs_fix) + 사유
- `POST /v1/ops/partners/{partnerId}/grade`
  - 등급 변경(basic/verified/pro) — 승인게이트 적용 권장
- `POST /v1/ops/partners/{partnerId}/suspend`
  - 정지(사유/기간)
- `POST /v1/ops/partners/{partnerId}/reinstate`
  - 정지 해제

---

## 2) 승인게이트(Approval Gates) 매핑(권장)

파트너 관련 “확정” 행위는 승인게이트로 통제:
- `partner_onboarding_approve` : 온보딩 최종 승인/반려/보완요청
- `partner_grade_change` : 등급 변경(Verified/Pro)
- `partner_suspend` : 정지/해제

이벤트:
- 요청 생성: `APPROVAL_REQUESTED`
- 승인/반려: `APPROVAL_APPROVED` / `APPROVAL_REJECTED`

> 승인게이트는 “UI 버튼”이 아니라, **감사/분쟁/부정 방지**의 핵심 데이터 장치다.

---

## 3) DB 테이블(권장)

### 3.1 `partner_users` (파트너 조직 내 계정)
- `id uuid PK`
- `partner_id uuid FK(partners.id)`
- `email text unique`
- `status text` (`active/suspended`)
- `created_at`, `updated_at`

### 3.2 `partner_user_pii` (선택)
연락처 등 민감 정보를 분리/암호화.

### 3.3 `partner_onboarding_requests`
- `id uuid PK` (=onboardingId)
- `partner_id uuid FK`
- `status text` (`draft/submitted/under_review/needs_fix/approved/rejected/suspended`)
- `payload_json jsonb` (섹션별 입력 스냅샷, 스키마 검증)
- `submitted_at timestamptz null`
- `decision_reason_ko text null`
- `created_at`, `updated_at`

### 3.4 `partner_onboarding_documents`
- `id uuid PK`
- `onboarding_id uuid FK`
- `document_type text` (사업자등록증/자격증빙/정산계좌증빙 등)
- `storage_ref text`
- `sha256 text null`
- `created_at`

### 3.5 `partner_status_history` (권장)
정지/해제/등급 변경 등의 히스토리를 append-only로 저장.

---

## 4) 이벤트 발행 규칙

### 4.1 온보딩
- draft 생성: (선택) `PARTNER_PROFILE_UPDATED`
- submit: `PARTNER_ONBOARDING_SUBMITTED`
- needs_fix: `PARTNER_ONBOARDING_NEEDS_FIX`
- approve: `PARTNER_ONBOARDING_APPROVED` (+ 필요 시 `PARTNER_GRADE_CHANGED`)
- reject: `PARTNER_ONBOARDING_REJECTED`

### 4.2 등급/정지/프로필 변경
- grade: `PARTNER_GRADE_CHANGED`
- suspend/reinstate: `PARTNER_SUSPENDED` / `PARTNER_REINSTATED`
- profile/pricing/capabilities 변경: `PARTNER_PROFILE_UPDATED` (changedFields 포함)

---

## 5) 권한(RBAC/RLS) 요약

### 5.1 파트너
- 자기 `partner_id`의 onboarding만 조회/수정 가능

### 5.2 운영
- ops_agent: 조회/보완요청 draft 생성 가능
- ops_approver: 승인/반려/정지/등급 변경 가능(승인게이트 포함)

### 5.3 감사
- 모든 결정은 `audit_logs`에 사유/증빙 링크 포함

