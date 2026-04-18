# 인증/권한/Auth-RBAC-RLS 스펙 — v1

목표: 운영을 AI에게 위임하더라도, 데이터/액션이 새지 않게 **권한을 제품 규칙 + DB 규칙**으로 이중 잠금한다.  
원칙: “인증(Auth) → 권한(RBAC) → 행 단위 차단(RLS) → 감사(Audit)”의 순서로 설계한다.

---

## 0) 범위

대상 주체(Actor):
- `user` : 모바일 사용자(게스트 포함)
- `partner` : 파트너 조직(법무사사무소/법무법인/법률사무소) + 소속 사용자(직원)
- `ops` : 플랫폼 운영자
- `system` : 백엔드 서비스/엔진(권한을 가진 서비스 계정)

보호 대상(Resource) 예:
- 케이스(`cases`), 문서(`documents`, `document_versions`, OCR 결과), 결제/환불/정산, 광고 캠페인, 정책/설정, 감사로그

---

## 1) 인증(Auth)

### 1.1 사용자(User) 인증
권장 단계(전체 다 진행 전제, 단계적으로 활성화 가능):
1) 게스트 세션(`sessions`) 기반으로 퍼널 진행  
2) 사건 생성/결제 등 민감 단계에서 로그인/본인확인(선택지)

권장 로그인 수단(예시):
- 소셜: 카카오/애플/구글
- 휴대폰 본인확인(고위험/결제/환불 단계에서 강권)

필수 요구사항:
- 세션 토큰은 httpOnly 쿠키 또는 안전한 토큰 저장소 사용
- `sessionId`는 재발급/탈취 대응을 위해 서버가 관리(만료/회수)

### 1.2 파트너(Partner) 인증
파트너는 “조직” 단위가 있고, 조직 내 여러 계정이 존재.
- 파트너 조직: `partner_id`
- 파트너 계정: `partner_user_id`

필수:
- 2FA(OTP/SMS) 옵션(Verified/Pro 권장)
- IP 제한/디바이스 제한 옵션(고급)

### 1.3 운영자(Ops) 인증
필수:
- SSO 또는 강한 비밀번호 정책 + 2FA
- 권한 상승(approver/admin) 액션은 “재인증(reauth)” 요구 가능

### 1.4 시스템(System) 인증
- 서비스 간 호출은 mTLS 또는 signed JWT(서비스 계정)
- 엔진별로 최소 권한만 부여(예: doc_review_engine은 문서 읽기만, payment_service는 결제/환불만)

---

## 2) 권한 모델(RBAC) — 앱 레벨

### 2.1 권장 RBAC 테이블(이미 DB 초안에 포함)
- `roles`, `permissions`, `role_permissions`, `actor_roles`

권장 권한 코드 예시:
- 케이스: `CASE_READ`, `CASE_UPDATE_STATUS`, `CASE_REASSIGN_PARTNER`
- 문서: `DOC_UPLOAD`, `DOC_READ`, `DOC_REVIEW_DECIDE`, `DOC_OCR_READ`
- 결제/환불: `PAYMENT_READ`, `REFUND_APPROVE`, `REFUND_EXECUTE`
- 정산: `SETTLEMENT_CREATE`, `SETTLEMENT_PAY`, `LEDGER_ADJUST`
- 메시지: `MESSAGE_DRAFT`, `MESSAGE_SEND_APPROVE`
- PII: `PII_VIEW`, `PII_EXPORT`
- 정책/광고: `POLICY_EDIT`, `AD_CAMPAIGN_EDIT`

### 2.2 승인 게이트(운영/AI 공통)
아래 액션은 “권한이 있어도” 게이트를 통과해야 한다.
- 메시지 발송(사용자/파트너 외부 커뮤니케이션)
- 견적 확정/수정(금액/기한 영향)
- 환불 승인/집행
- 파트너 재배정/케이스 동결
- PII 조회/내보내기

권장 레벨(Ops 기준):
- L0 자동(내부 태그/큐 이동)
- L1 ops_agent 승인(낮은 영향)
- L2 ops_approver 승인(금액/외부 커뮤니케이션)
- L3 ops_admin 승인(정책/권한/모델 롤백)

---

## 3) Row Level Security (RLS) — DB 레벨 2차 방어

### 3.1 목적
애플리케이션 버그/AI 도구 오작동이 있어도 “다른 파트너 케이스/문서”가 새지 않게 한다.

### 3.2 권장 RLS 규칙(핵심)
PostgreSQL 기준. 실제 구현은 `current_setting()` 혹은 세션 변수로 주입.

#### `cases`
- partner 콘솔:
  - 허용: `cases.partner_id = current_partner_id()`
- user:
  - 허용: `cases.user_id = current_user_id()` 또는 `cases.session_id = current_session_id()`
- ops:
  - 기본 허용(단, PII/민감은 별도 정책)

#### `documents`, `document_versions`, `review_requests`, `review_decisions`
- 원칙: 문서는 케이스를 통해 권한을 상속
  - 허용: `documents.case_id IN (select id from cases where ...)`

#### `payments/refunds/settlements/ledger_entries`
- 원칙: 케이스/파트너 기준으로 상속
  - partner는 자기 케이스 정산만, ops는 전체(승인 권한 필요)

#### `user_pii`, `document_ocr_results`
- 기본: ops도 **차단**
- 예외: `PII_VIEW` 권한 + 티켓/사유를 “승인 게이트”로 생성한 후, 제한 시간 접근(임시 권한 토큰)

---

## 4) 민감정보(PII) 접근 정책

PII 정책은 “기능”이 아니라 “기본값”이어야 함.
- 기본: 마스킹된 값만 표시(끝 4자리 등)
- 전체 보기: 승인 게이트 + 사유 + 만료(예: 30분)
- 내보내기(export): L3 수준(감사/법무 포함)

필수 로그:
- `audit_logs`: VIEW_PII, EXPORT_PII (actor, reason, target, timestamp)

---

## 5) API 보안(요구사항)

### 5.1 멱등성/재시도 대비(권장)
- 결제/환불/문서 업로드 등은 `Idempotency-Key` 지원
- 이벤트 발행도 requestId 기반 멱등

### 5.2 레이트리밋
- 퍼널 API는 사용자별/세션별 제한
- 파일 업로드는 용량/횟수 제한 + 악성 방지

### 5.3 권한 체크 순서(강제)
1) 인증(토큰/세션)
2) RBAC(권한 코드)
3) 승인 게이트(필요 시)
4) DB RLS(항상)
5) 감사로그 기록(민감 액션은 반드시)

---

## 6) AI 도구 호출(Agentic Ops) 보안 요구사항

운영 AI는 “권한을 가진 사용자처럼” 행동하므로 별도 제약이 필요.

필수:
- AI는 직접 DB 쿼리 금지(반드시 API/도구 호출)
- 도구는 권한 스코프를 가진 토큰으로만 호출(ops_agent/ops_approver 등)
- 승인 게이트는 “AI가 자동 승인” 불가(최소 L1 이상은 사람 승인)
- AI 출력/도구 호출 내역을 `audit_logs` 또는 별도 `ai_actions`에 저장

