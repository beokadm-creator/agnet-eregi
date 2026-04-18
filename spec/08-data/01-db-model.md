# DB 데이터 모델 초안 — v1 (PostgreSQL 기준)

목표: 본 문서는 “지금까지 정의된 UX/엔진/이벤트/정산”을 **구현 가능한 테이블/필드/제약**으로 내리는 초안이다.  
원칙: **Append-only 이벤트 저장 + 상태 스냅샷(조회 최적화)**의 조합을 기본으로 한다.

---

## 0) 공통 원칙

### 0.1 기본 키/타입
- `id`: UUID(권장) 또는 ULID (정렬성 필요 시). 문서에서는 간결하게 `uuid`로 표기.
- `created_at`, `updated_at`: `timestamptz`
- `deleted_at`: soft-delete가 필요한 엔티티에만(파트너/캠페인 등). **이벤트 테이블은 soft-delete 금지**.
- 큰 가변 데이터: `jsonb` (단, 계약이 있는 payload는 스키마로 검증)

### 0.2 PII 분리(강권)
사용자 연락처/주민번호/사업자번호 등은:
- `pii_*` 테이블로 분리
- 컬럼 단위 암호화(앱 레벨 KMS) + 접근 로그
- 운영자 조회는 티켓/사유 필수(감사)

### 0.3 RBAC/RLS(파트너/운영 콘솔)
권장 접근 제어 레이어(둘 다 사용):
- **앱 레벨 RBAC**: 라우트/기능 단위 권한 체크
- **DB RLS(Row Level Security)**: 파트너가 타 파트너 사건/문서에 접근하지 못하도록 2차 방어

핵심 규칙(예):
- partner 콘솔: `cases.partner_id = current_partner_id()`
- ops 콘솔: 역할/티켓 기반(사유/기간) 접근
- 사용자: `cases.user_id = current_user_id()`

---

## 1) 계정/세션/인증

### 1.1 `users`
사용자 계정(로그인 사용 시). 게스트도 고려하면 `sessions`가 더 중요.

| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| id | uuid | PK |
| status | text | `active/suspended/deleted` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

인덱스:
- `(status)`

### 1.2 `user_pii`
PII 분리 테이블.

| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| user_id | uuid | PK/FK(users.id) |
| phone_enc | text | 암호문 |
| email_enc | text | 암호문 |
| name_enc | text | 암호문(선택) |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

### 1.3 `sessions`
게스트/로그인 공통. 모바일 퍼널에서 “진단 진행”의 기준 단위.

| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| id | uuid | PK (=sessionId) |
| user_id | uuid | nullable FK(users.id) |
| device_fingerprint | text | nullable |
| created_at | timestamptz |  |
| last_seen_at | timestamptz |  |

인덱스:
- `(user_id, created_at desc)`

---

## 2) 퍼널(의도/진단/결과)

### 2.1 `intents`
`INTENT_SUBMITTED`의 스냅샷(조회용).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| session_id | uuid | FK(sessions.id) |
| intent_text | text | 원문 |
| category_hint | text | nullable |
| language | text | default 'ko' |
| created_at | timestamptz |  |

### 2.2 `diagnosis_answers`
진단 문항 단위 기록(append-only). 이벤트 저장과 별도로 “질문별 상태”를 빠르게 조회하기 위함.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| session_id | uuid | FK(sessions.id) |
| case_pack_id | text | nullable |
| question_id | text |  |
| answer_json | jsonb |  |
| created_at | timestamptz |  |

인덱스:
- `(session_id, created_at)`
- `(session_id, question_id)`

### 2.3 `result_sets`
랭킹 결과 묶음(AB/감사/재현). `PARTNER_RANKED`를 materialize 한 개념.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK (=resultSetId) |
| session_id | uuid | FK(sessions.id) |
| case_pack_id | text |  |
| ranked_partner_ids | jsonb | `["p1","p2","p3"...]` |
| explain_json | jsonb | nullable (감사용) |
| ab_json | jsonb | nullable |
| created_at | timestamptz |  |

인덱스:
- `(session_id, created_at desc)`
- `(case_pack_id, created_at desc)`

---

## 3) 파트너(입점) 도메인

> 전체 프로필 정의는 루트의 `spec_partner_profile_schema.yaml`이 단일 소스일 수 있으며, DB는 이를 저장/검색/랭킹 가능한 형태로 정규화/부분 denormalize 한다.

### 3.1 `partners`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| name_ko | text |  |
| type | text | `법무사사무소/법무법인/법률사무소` |
| verification | text | `basic/verified/pro` |
| status | text | `active/paused/suspended` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |
| deleted_at | timestamptz | nullable |

인덱스:
- `(verification, status)`

### 3.2 `partner_profiles`
검색/카드 렌더링을 위한 denormalized JSON 저장(전체를 jsonb로 저장하고, 검색 키만 별도 컬럼으로 유지하는 하이브리드 권장).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| partner_id | uuid | PK/FK(partners.id) |
| profile_json | jsonb | 계약 기반(검증) |
| address_ko | text | nullable |
| region_ko | text | nullable (필터) |
| lat | double precision | nullable |
| lng | double precision | nullable |
| visitable | boolean | default false |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

인덱스:
- `(region_ko)`
- `(visitable)`
- `gist(geography_point)` 또는 `gist(geom)` (PostGIS 사용 시)

### 3.3 `partner_casepack_capabilities`
파트너가 수행 가능한 사건팩 목록(랭킹/필터용).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| partner_id | uuid | FK(partners.id) |
| case_pack_id | text |  |
| enabled | boolean | default true |
| created_at | timestamptz |  |

PK:
- `(partner_id, case_pack_id)`

### 3.4 `partner_quality_metrics_daily`
랭킹에 들어가는 지표를 “일 단위”로 적재(스파이크 완화).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| partner_id | uuid |  |
| date | date |  |
| rework_rate | numeric | 0~1 |
| avg_response_minutes | numeric |  |
| sla_breach_rate | numeric | 0~1 |
| completed_case_count | int |  |

PK:
- `(partner_id, date)`

### 3.5 `partner_users`
파트너 조직 내부 계정(직원/관리자). 파트너 콘솔 접근 주체.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| partner_id | uuid | FK(partners.id) |
| email | text | unique |
| status | text | `active/suspended` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

인덱스:
- `(partner_id, status)`

### 3.6 `partner_onboarding_requests`
온보딩 입력을 “섹션별로 저장”하고, 제출/심사/보완/승인/반려 상태를 관리.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK (=onboardingId) |
| partner_id | uuid | FK(partners.id) |
| status | text | `draft/submitted/under_review/needs_fix/approved/rejected` |
| payload_json | jsonb | 섹션별 입력 스냅샷(스키마 검증 대상) |
| submitted_at | timestamptz | nullable |
| decision_reason_ko | text | nullable |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

인덱스:
- `(status, updated_at desc)`
- `(partner_id, updated_at desc)`

### 3.7 `partner_onboarding_documents`
온보딩 증빙 문서(자격/사업자/정산계좌 등).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| onboarding_id | uuid | FK(partner_onboarding_requests.id) |
| document_type | text | 예: `license`, `business_registration`, `payout_proof` |
| storage_ref | text | 외부 저장소 키 |
| sha256 | text | nullable |
| created_at | timestamptz |  |

인덱스:
- `(onboarding_id)`

### 3.8 `partner_payout_pii`
정산 계좌 등 민감 정보(암호화). ops도 기본 차단 + 승인 게이트로 접근.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| partner_id | uuid | PK/FK(partners.id) |
| bank_account_enc | text | 암호문 |
| depositor_name_enc | text | 암호문 |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

### 3.9 `partner_status_history` (권장)
정지/해제/등급 변경 등을 append-only로 기록(분쟁/감사/정책 집행 증빙).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| partner_id | uuid | FK(partners.id) |
| action | text | `grade_changed/suspended/reinstated/profile_updated` |
| meta_json | jsonb | 사유/변경 필드/기간 등 |
| created_at | timestamptz |  |

---

## 4) 케이스(사건) 도메인

### 4.1 `cases`
조회/권한/검색의 핵심 테이블. 상태는 “이벤트에서 재구성 가능”하지만 UX 응답 속도를 위해 스냅샷을 유지.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK (=caseId) |
| user_id | uuid | nullable FK(users.id) |
| session_id | uuid | FK(sessions.id) |
| partner_id | uuid | nullable FK(partners.id) |
| case_pack_id | text |  |
| status | text | 예: `new/in_progress/waiting_user/waiting_partner/completed/cancelled` |
| risk_level | text | `low/medium/high/critical` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

인덱스:
- `(partner_id, updated_at desc)`
- `(user_id, updated_at desc)`
- `(status, updated_at desc)`

### 4.2 `case_inputs`
케이스팩에 맞춘 입력(정규화가 어려우므로 jsonb + 버저닝).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| case_id | uuid | PK/FK(cases.id) |
| version | int | 1.. |
| input_json | jsonb | casepack schema로 검증 |
| created_at | timestamptz |  |
| created_by_actor_type | text | `user/partner/ops/system` |
| created_by_actor_id | text | nullable |

권장:
- “최신” 버전은 `cases`에 `case_input_version`을 캐시하거나, 뷰로 제공.

### 4.3 `case_checklist_items`
사건팩 체크리스트를 케이스로 materialize(상태/담당/기한 관리).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| case_id | uuid | FK(cases.id) |
| item_key | text | 사건팩 정의 key |
| title_ko | text |  |
| status | text | `todo/doing/done/blocked` |
| due_at | timestamptz | nullable |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

인덱스:
- `(case_id, status)`

---

## 5) 문서/버전/OCR/검토

### 5.1 `documents`
“문서”는 논리 단위(예: 주주명부, 인감증명). 실제 파일은 `document_versions`.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK (=documentId) |
| case_id | uuid | FK(cases.id) |
| slot_id | text | nullable (사건팩 slot) |
| title_ko | text | nullable |
| status | text | `미업로드/검토중/OK/보완필요` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

인덱스:
- `(case_id, slot_id)`

### 5.2 `document_versions`
파일 업로드 단위(append-only). `DOCUMENT_UPLOADED`와 1:1에 가깝다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK (=versionId) |
| document_id | uuid | FK(documents.id) |
| file_name | text |  |
| mime_type | text |  |
| size_bytes | bigint |  |
| sha256 | text | nullable |
| storage_ref | text | 외부 저장소 키 |
| created_at | timestamptz |  |
| created_by_actor_type | text |  |
| created_by_actor_id | text | nullable |

인덱스:
- `(document_id, created_at desc)`
- `(sha256)` (중복 감지/캐시)

### 5.3 `document_ocr_results`
OCR/추출 결과(PII 포함 가능). 접근 제어 강하게.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| document_version_id | uuid | FK(document_versions.id) |
| provider | text |  |
| result_json_enc | text | 암호화된 결과(권장) |
| created_at | timestamptz |  |

### 5.4 `review_requests`
파트너/운영이 특정 문서/슬롯에 대해 검토를 요청한 단위.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK (=reviewRequestId) |
| case_id | uuid | FK(cases.id) |
| requested_by_actor_type | text |  |
| requested_by_actor_id | text | nullable |
| status | text | `requested/in_review/done/cancelled` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

### 5.5 `review_decisions`
검토 결과(append-only). `DOCUMENT_REVIEWED` 이벤트와 연결.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| review_request_id | uuid | FK(review_requests.id) |
| decision | text | `OK/보완필요` |
| issues_json | jsonb | 배열 |
| decided_by_actor_type | text |  |
| decided_by_actor_id | text | nullable |
| created_at | timestamptz |  |

---

## 6) 견적/결제/환불

### 6.1 `quotes`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK (=quoteId) |
| case_id | uuid | FK(cases.id) |
| partner_id | uuid | nullable FK(partners.id) |
| price_min | numeric |  |
| price_max | numeric |  |
| currency | text | default 'KRW' |
| eta_min_hours | numeric |  |
| eta_max_hours | numeric |  |
| assumptions_json | jsonb |  |
| status | text | `draft/finalized/accepted/expired` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

인덱스:
- `(case_id, created_at desc)`
- `(partner_id, created_at desc)`

### 6.2 `quote_consents`
사용자 동의/약관 버전 증빙(분쟁 대비).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| quote_id | uuid | FK(quotes.id) |
| user_id | uuid | nullable |
| consented | boolean |  |
| consent_text_version | text | nullable |
| consented_at | timestamptz |  |

### 6.3 `payments`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK (=paymentId) |
| case_id | uuid | FK(cases.id) |
| quote_id | uuid | nullable FK(quotes.id) |
| amount | numeric |  |
| currency | text |  |
| method | text | `card/transfer/vbank/easy_pay` |
| pg | text |  |
| pg_auth_key | text | nullable |
| status | text | `authorized/captured/failed/cancelled` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

인덱스:
- `(case_id, created_at desc)`
- `(status, updated_at desc)`

### 6.4 `refunds`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK (=refundId) |
| payment_id | uuid | FK(payments.id) |
| case_id | uuid | FK(cases.id) |
| amount | numeric |  |
| currency | text |  |
| reason_ko | text |  |
| status | text | `requested/approved/executed/rejected` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

---

## 7) 정산/회계(원장)

### 7.1 `settlements_to_partner`
파트너 정산 단위(케이스 단위 또는 기간 묶음 단위 가능).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK (=settlementId) |
| partner_id | uuid | FK(partners.id) |
| case_id | uuid | nullable (케이스별 정산이면 not null) |
| period_from | timestamptz | nullable |
| period_to | timestamptz | nullable |
| gross_amount | numeric |  |
| platform_fee | numeric |  |
| net_amount | numeric |  |
| currency | text |  |
| status | text | `created/paid/void` |
| created_at | timestamptz |  |
| paid_at | timestamptz | nullable |
| payout_method | text | default 'bank_transfer' |
| bank_ref | text | nullable |

인덱스:
- `(partner_id, created_at desc)`
- `(status, created_at desc)`

### 7.2 `ledger_entries`
복식부기 원장(선택이지만 “감사/대사”를 위해 강력 추천). 이벤트 기반으로 생성.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| occurred_at | timestamptz | 분개 발생 시각 |
| case_id | uuid | nullable |
| partner_id | uuid | nullable |
| event_id | uuid | nullable (아래 events 테이블) |
| account_code | text | 계정과목 코드 |
| dr_amount | numeric | 차변 |
| cr_amount | numeric | 대변 |
| currency | text |  |
| memo_ko | text | nullable |
| created_at | timestamptz |  |

인덱스:
- `(occurred_at)`
- `(case_id, occurred_at)`
- `(event_id)`

---

## 8) 광고(스폰서)

### 8.1 `ad_campaigns`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK (=campaignId) |
| partner_id | uuid | FK(partners.id) |
| status | text | `active/paused/ended` |
| budget_amount | numeric |  |
| currency | text |  |
| starts_at | timestamptz |  |
| ends_at | timestamptz |  |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

### 8.2 `ad_impressions` / `ad_clicks`
정산의 증빙(append-only).

공통 컬럼:
- `id uuid PK`
- `campaign_id uuid`
- `session_id uuid`
- `case_id uuid nullable`
- `partner_id uuid`
- `occurred_at timestamptz`
- `meta_json jsonb` (위치, 카드 id 등)

인덱스:
- `(campaign_id, occurred_at)`
- `(session_id, occurred_at)`

---

## 9) 이벤트 저장소(감사/재현의 핵심)

### 9.1 `domain_events`
**append-only** 이벤트 원장. 본 저장소는 다음 계약을 만족해야 한다:
- `spec/02-engine/events/case_event.schema.json`
- (결제/정산 상세) `spec/02-engine/contracts/settlement_event.schema.json` (data 검증용)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK (=eventId) |
| event_type | text | `INTENT_SUBMITTED` 등 |
| version | text | `v1` |
| occurred_at | timestamptz |  |
| producer_service | text |  |
| producer_version | text |  |
| actor_type | text | `user/partner/ops/system` |
| actor_id | text | nullable |
| session_id | uuid | nullable |
| case_id | uuid | nullable |
| partner_id | uuid | nullable |
| trace_json | jsonb | requestId/correlationId 등 |
| data_json | jsonb | 스키마 검증 대상 |
| created_at | timestamptz | insert 시각(=서버 수신) |

인덱스:
- `(case_id, occurred_at)`
- `(partner_id, occurred_at)`
- `(event_type, occurred_at)`
- `gin(data_json)` (필요 시. 과도한 json 검색은 피함)

권장 제약:
- `unique(id)`는 기본
- `check (occurred_at <= created_at + interval '5 minutes')` 같은 sanity check(선택)

---

## 10) 감사로그(민감 조회/권한/승인)

### 10.1 `audit_logs`
“누가/왜/무엇을” 열람/변경했는지.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| actor_type | text |  |
| actor_id | text | nullable |
| action | text | 예: `VIEW_PII`, `APPROVE_FIX_REQUEST`, `EXPORT_CASE` |
| target_type | text | `case/document/user_pii/...` |
| target_id | text | nullable |
| reason_ko | text | nullable (ops 티켓/사유) |
| meta_json | jsonb | nullable |
| created_at | timestamptz |  |

인덱스:
- `(actor_type, actor_id, created_at desc)`
- `(target_type, target_id, created_at desc)`

---

## 10-A) 승인 게이트(Approval Gate)

### 10-A.1 `approval_requests`
승인 대기/완료/반려를 관리하는 중심 테이블. “확정” 액션은 여기서 통제.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK (=approvalRequestId) |
| approval_gate | text | 예: `quote_finalize`, `refund_approve`, `message_send` |
| status | text | `pending/approved/rejected/cancelled/expired` |
| target_type | text | `case/quote/refund/message/partner/pii` |
| target_ref | text | nullable (caseId/quoteId 등) |
| required_role | text | nullable (ops_approver 등) |
| summary_ko | text | nullable |
| payload_hash | text | nullable |
| payload_json | jsonb | nullable (민감 payload는 hash + ref 권장) |
| created_by_actor_type | text | `system/partner/ops` |
| created_by_actor_id | text | nullable |
| created_at | timestamptz |  |
| expires_at | timestamptz | nullable |

인덱스:
- `(status, created_at desc)`
- `(approval_gate, status, created_at desc)`
- `(target_type, target_ref)`

### 10-A.2 `approval_decisions`
승인/반려 결정의 append-only 기록(감사/분쟁 대비).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| approval_request_id | uuid | FK(approval_requests.id) |
| decision | text | `approved/rejected` |
| reason_ko | text | nullable |
| decided_by_actor_type | text | `ops/partner` |
| decided_by_actor_id | text | nullable |
| decided_at | timestamptz |  |

인덱스:
- `(approval_request_id, decided_at desc)`

---

## 11) 권한(RBAC) 테이블(간단 버전)

### 11.1 `roles`, `permissions`, `role_permissions`, `actor_roles`
운영자/파트너 계정에 역할을 부여.

- `roles(id uuid, name text unique, scope text)`  
  - scope 예: `ops`, `partner`
- `permissions(id uuid, code text unique, description_ko text)`
- `role_permissions(role_id, permission_id)` PK 복합키
- `actor_roles(actor_type text, actor_id text, role_id uuid, created_at timestamptz)`  
  - actor_type: `ops|partner`

---

## 12) 최소 구현 순서(권장)
1) `domain_events` + `cases` + `documents/document_versions` (감사/재현 기반 확보)  
2) `partners/partner_profiles/partner_casepack_capabilities` (랭킹/노출)  
3) `quotes/payments/refunds/settlements/ledger_entries` (정산/대사)  
4) `audit_logs` + RLS (운영 안정화)
