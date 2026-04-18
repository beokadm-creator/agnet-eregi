# Firebase 구현 개발 기획(1): Firestore 데이터 모델 & Security Rules — v1

목표: **화면/기능 단위로 쿼리 가능한 모델**을 설계하고, “클라이언트가 악의적이어도” 데이터가 새지 않도록 **Rules로 강제**한다.

전제:
- Auth: Firebase Auth + Custom Claims(`role`, `partnerId`)
- DB: Firestore
- 파일: Cloud Storage
- 서버 로직: Cloud Functions(HTTPS/Callable/Triggers)

---

## 1) ID/권한 원칙(강제)

### 1.1 ID
- 모든 도메인 객체는 Firestore 문서 ID를 **uuid 문자열**로 통일 권장
- 외부 연동 ID(예: PG transactionId)는 별도 필드(`externalId`)로 저장 + unique성은 서버에서 보장

### 1.2 Custom Claims (권장)
- `role`: `user | partner | ops_agent | ops_approver | system`
- `partnerId`: 파트너 계정에만 존재(파트너 조직 문서 ID)
- `isTest`: 테스트/스테이징 계정 구분(선택)

> Claims는 Functions에서만 갱신. 클라이언트에서 role/partnerId를 “입력”받아선 안 됨.

---

## 2) Firestore 컬렉션 설계(조회 화면 중심)

### 2.1 User
`users/{uid}`
- `phone`, `email`, `marketingConsent`, `consentTextVersion`
- `createdAt`, `lastSeenAt`

### 2.2 Partner
`partners/{partnerId}`
- `status`: `active/paused/suspended`
- `verification`: `basic/verified/pro`
- `profile`: partner_profile schema 기반 JSON
- `search`: `regionKo`, `visitable`, `tags[]` (쿼리 최적화용 denormalized)
- `quality`: `reworkRate`, `avgResponseMinutes`, `recentCaseCount` 등

`partners/{partnerId}/users/{uid}`
- 파트너 콘솔 계정. `roleInPartner`(admin/staff), `status`

### 2.3 Funnel(퍼널/진단)
`sessions/{sessionId}`
- `ownerUid`(nullable: 비로그인 퍼널을 허용하면 익명 세션 키를 별도 전략으로)
- `createdAt`, `updatedAt`
- `intent`, `answers`(요약), `resultSetId`(nullable)

`sessions/{sessionId}/events/{eventId}`(선택)
- 진단 타임라인(디버깅/분쟁 대비). 개인식별정보(PII) 금지.

### 2.4 Cases (핵심)
`cases/{caseId}`
- `ownerUid`(user)
- `partnerId`
- `casePackId`
- `status`: `new/in_progress/waiting_user/waiting_partner/completed/cancelled/escalated_to_ops`
- `riskLevel`: `low/medium/high`
- `summary`: 리스트용 스냅샷(회사명, 사건팩 라벨, 최근 업데이트, unreadCount 등)
- `createdAt`, `updatedAt`

서브컬렉션(권장):
- `cases/{caseId}/documents/{documentId}`
- `cases/{caseId}/quotes/{quoteId}`
- `cases/{caseId}/payments/{paymentId}`
- `cases/{caseId}/refunds/{refundId}`
- `cases/{caseId}/timeline/{eventId}` (타임라인 스냅샷, 감사/재현용)

### 2.5 Approvals (승인 게이트)
`approvals/{approvalId}`
- `gate`: `quote_finalize/refund_approve/message_send/pii_view/...`
- `status`: `pending/approved/rejected/cancelled/expired`
- `target`: `{type, ref}` (caseId/quoteId/refundId/partnerId 등)
- `requiredRole`: `ops_approver` 등
- `summaryKo`, `payloadHash`, `createdBy`, `decidedBy`, `createdAt`, `decidedAt`

### 2.6 Settlements / Receivables
`settlements/{settlementId}`
- `partnerId`, `period:{from,to}`
- `status`: `created/paid/voided`
- `gross`, `platformFee`, `net`
- `offsetsApplied[]`: (요약) `{receivableId, amount}`
- `policyVersion`
- `createdAt`, `paidAt`

`partners/{partnerId}/receivables/{receivableId}`
- `status`: `open/offset_applied/waived/collected`
- `amountRemaining`
- `reasonKo`, `sourceRefs[]`, `createdAt`

---

## 3) 쿼리/인덱스 계획(필수로 “먼저” 잡기)

화면별 대표 쿼리:
- User “내 케이스 목록”: `cases where ownerUid == uid orderBy updatedAt desc`
- Partner “케이스 큐”: `cases where partnerId == myPartnerId and status in [...] orderBy updatedAt desc`
- Ops “승인 큐”: `approvals where status == pending and gate == ... orderBy createdAt`
- Settlements “파트너별 목록”: `settlements where partnerId == ... orderBy period.from desc`

> Firestore 복합 인덱스는 실제 쿼리 기준으로 생성되므로, “화면 단위 쿼리 목록”을 먼저 확정한다.

---

## 4) Firestore Rules(핵심 원칙 + 패턴)

### 4.1 공통 함수(개념)
- `isSignedIn()`
- `role()`
- `isOps()` / `isApprover()`
- `partnerId()` (claim)
- `isCaseOwner(case)` / `isCasePartner(case)`

### 4.2 케이스 접근
- user: `cases/{caseId}`에서 `resource.data.ownerUid == request.auth.uid`만 read
- partner: `resource.data.partnerId == request.auth.token.partnerId`만 read
- ops: 전체 read

write 제한(예):
- user는 문서 업로드/보완 제출 등 “허용된 필드”만 업데이트 가능
- partner는 견적/검토 결정 등 “허용된 액션”만 업데이트 가능
- status 전이는 서버(Functions)에서만 수행하는 방식 권장

### 4.3 approvals 접근
- ops만 read/write (role별로 decision 권한 분리)
- partner/user는 자기 케이스에 딸린 approvalId를 “참조 링크”로만 받고 직접 조회는 제한(보수적으로)

---

## 5) Storage Rules(필수)

경로 규칙(권장):
- `cases/{caseId}/documents/{documentId}/{versionId}`

규칙:
- 업로드/다운로드 시 `caseId`에 대한 Firestore 권한을 동일하게 강제
- 업로드는 “사용자/파트너” 모두 가능하되, 메타 문서 생성/확정은 Functions가 수행(무결성)

---

## 6) 데이터 무결성(서버가 반드시 보장해야 하는 것)

Firestore Rules는 “권한”은 잘하지만, 다음은 서버 로직이 필요:
- 멱등키/중복 이벤트 방어(결제/웹훅)
- 상태 머신 전이 검증(금지 전이 차단)
- approval gate 생성/결정/집행
- 정산 배치 생성/상계(정책 버전 고정)

