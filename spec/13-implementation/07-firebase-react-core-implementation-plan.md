# Firebase + React 구현 전환: 핵심 서비스 기능 구현 개발 기획 — v1

전제: 본 프로젝트의 **DB/인프라/백엔드 실행 환경은 Firebase 기반**으로 구현한다.
- DB: Firestore
- 파일: Cloud Storage
- 서버 로직: Cloud Functions(필요 시 Cloud Run 연계)
- 인증: Firebase Auth (+ Custom Claims)
- 푸시/메시징: FCM(선택), 외부 발송사는 Cloud Functions에서 연동

목표: 기능 구현 착수를 위한 **개발 기획(에픽/흐름/데이터 모델/권한/작업 순서/검증 기준)** 을 고정한다.  
비목표: 특정 PG/문서 OCR 벤더 선정, UI 디테일(컴포넌트 디자인)은 별도 문서에서 확정.

---

## 0) 제품 구성(앱 3종) & 권한 모델(요지)

프론트:
- User App (React): 퍼널(진단) → 결과 → 케이스 진행/문서 업로드/결제
- Partner Console (React): 케이스 큐/문서 검토/견적/진행/정산 조회
- Ops Console (React): 승인 게이트/환불/분쟁/파트너 온보딩/정산 배치/감사

Auth/RBAC(권장):
- Firebase Auth UID를 주체로 사용
- `customClaims.role`: `user | partner | ops_agent | ops_approver | system`
- `customClaims.partnerId`: 파트너 소속 계정에만 부여

---

## 1) 핵심 도메인 흐름(“이게 구현 우선순위”)

### 1.1 퍼널(진단) → 결과(추천 리스트)
1) 의도 입력(intent)
2) 질문/답변 반복(진단)
3) 결과: 추천 파트너 + 안내 카드(UI Cards Contract) + 고지(disclosure)
4) 파트너 선택 → 케이스 생성

성공 기준:
- 퍼널 API/로직이 “계약 기반 카드 UI”로 렌더 가능
- 추천 결과는 광고/방문/등급 정책을 준수(정책 문서 링크)

### 1.2 케이스(사건) 생성/상태 머신
상태(요지):
- `new` → `in_progress` → `waiting_user` ↔ `waiting_partner` → `completed`
- 예외: `cancelled`, `escalated_to_ops`

성공 기준:
- 상태 전이마다 **감사 가능한 로그**가 남음(이벤트/로그/변경 이력)
- “금지 전이”는 서버에서 차단(프론트만 믿지 않음)

### 1.3 문서 업로드/버전/검토
1) 사용자: slot별 문서 업로드(버전 관리)
2) 파트너: 검토 요청/결정(OK/보완필요)
3) 사용자: 보완 업로드

성공 기준:
- Storage에 업로드된 파일과 Firestore 메타가 일관
- 파트너/사용자 간 접근은 Firestore Rules + Storage Rules로 강제

### 1.4 견적 확정/동의/결제
1) 파트너: 견적 작성/확정(승인 게이트 가능)
2) 사용자: 견적 동의
3) 결제: 외부 PG 연동(웹훅/대사/멱등성)
4) 환불: 승인 게이트 + 집행

성공 기준:
- 결제/환불은 반드시 멱등키/중복 웹훅 방어
- “승인 필요”는 412(또는 Firebase 친화적 오류 규격)로 UI에서 처리 가능

### 1.5 정산/원장/미수금(회수/상계)
1) 정산 배치 생성(일/주)
2) 지급 처리 + 증빙/상태
3) 지급 후 환불 → 미수금 생성
4) 차기 정산에서 상계 적용

성공 기준:
- 파트너/운영이 같은 “정산 사실”을 봄(이벤트/스냅샷/리포트 일치)
- 미수금 상계는 가드레일(상계 한도/최소지급) 적용

---

## 2) Firebase 데이터 모델(권장, 컬렉션/문서)

> Firestore는 조인이 어렵기 때문에 “조회 화면 단위”로 읽기 최적화된 스냅샷을 둔다.

### 2.1 users
`users/{uid}`
- profile(연락처/동의버전/마케팅동의 등)
- createdAt, lastSeenAt

### 2.2 partners
`partners/{partnerId}`
- profile(단일 소스: partner_profile schema 기반)
- status, verification(basic/verified/pro)

`partners/{partnerId}/users/{uid}`
- partner 콘솔 계정(권한/상태)

### 2.3 cases
`cases/{caseId}`
- ownerUid
- partnerId
- casePackId
- status, riskLevel
- timestamps
- denormalized: summary(리스트용), counters(문서 미완료 등)

서브컬렉션:
- `cases/{caseId}/documents/{documentId}`
- `cases/{caseId}/quotes/{quoteId}`
- `cases/{caseId}/payments/{paymentId}`
- `cases/{caseId}/refunds/{refundId}`
- `cases/{caseId}/timeline/{eventId}` (권장: 타임라인용 이벤트 스냅샷)

### 2.4 approvals (승인 게이트)
`approvals/{approvalId}`
- gate, status(pending/approved/rejected/expired)
- targetRef(caseId/quoteId/refundId/partnerId 등)
- requiredRole, summaryKo, payloadHash, createdBy, decidedBy

> ops 콘솔의 핵심 큐. 쿼리 가능한 필드만 top-level로 유지.

### 2.5 settlements / receivables (정산/미수금)
`settlements/{settlementId}`
- partnerId, period(from,to), status(created/paid/voided)
- gross/platformFee/net
- offsetsApplied[], policyVersion

`partners/{partnerId}/receivables/{receivableId}`
- status(open/offset_applied/waived/collected)
- amountRemaining
- reasonKo, sourceRefs

---

## 3) Security Rules 설계(최소 요구사항)

### 3.1 Firestore Rules
- user: 자신의 `cases`만 read/write(허용된 필드만)
- partner: `partnerId`가 일치하는 케이스만 read, 제한된 write(검토/견적 등)
- ops: 전체 read, 승인/환불/정산은 role별로 write 제한

### 3.2 Storage Rules
- 업로드 경로에 `caseId` 포함(예: `cases/{caseId}/documents/{documentId}/{versionId}`)
- Firestore의 권한과 동일한 접근 제약을 Storage에도 적용(“파일만 열리는” 사고 방지)

---

## 4) Cloud Functions(서버 로직) 분해(권장)

HTTP Callable/HTTPS:
- 퍼널/진단 응답 생성(정책 적용 포함)
- 파트너 추천/랭킹
- 견적 확정/승인게이트 생성
- 결제 생성 요청(클라이언트 토큰/리다이렉트)
- PG 웹훅 수신(멱등/서명검증/재시도)
- 환불 요청/승인/집행(승인게이트)
- 정산 배치 생성(스케줄)

Trigger:
- Firestore onWrite로 “타임라인/스냅샷” 동기화(주의: 무한루프 방지)
- Storage finalize로 문서 메타 업데이트(sha256/size) 및 OCR 큐잉(선택)

---

## 5) 개발 순서(추천 로드맵)

### Milestone 1: 퍼널 + 케이스 생성(MVP)
- User App: intent/diagnosis/results UI
- Functions: 퍼널/추천 로직(초기에는 rule-based)
- Firestore: cases 최소 스키마

### Milestone 2: 문서 업로드/검토
- Storage 업로드 + 문서 메타
- Partner Console: 검토 큐/결정

### Milestone 3: 견적/결제/환불(승인 게이트 포함)
- approvals 컬렉션 + ops 큐
- PG 연동 + 웹훅 + 멱등성
- 환불 플로우

### Milestone 4: 정산/미수금(상계)
- 정산 배치 생성(스케줄)
- 지급/상계 가드레일
- Ops Console: 정산/미수금 화면

---

## 6) 테스트/검증(개발 기획 기준)

필수 자동 검증:
- Rules 테스트(Firestore/Storage): user/partner/ops 권한 시나리오
- Functions 통합 테스트: 멱등키/웹훅 중복/승인게이트 412 흐름
- 계약 검증: UI Cards / 이벤트(타임라인) / 정산 페이로드

필수 E2E 시나리오:
- 퍼널 → 케이스 → 문서 업로드 → 보완 요청/제출 → 견적 → 결제 → 정산 → (지급 후) 부분 환불 → 미수금 생성 → 차기 정산 상계

---

## 7) 기존 문서와의 정합(중요)

기존에 작성된 PostgreSQL/RLS/로컬 SQL 기반 문서는 **레거시 참고**로만 유지하고,
실제 구현은 본 문서(Firebase/React) 기준으로 “데이터 모델/권한/트리거/배치”를 재구성한다.

