# 프로덕트 수준 개발 착수 문서(1): 모듈 분해/연결성/누락 방지 맵 — v1

목표: Firebase + React 기반으로 “프로덕트 수준” 구현에 들어가기 전에,
1) 개발 뎁스를 **모듈(경계)** 로 쪼개고  
2) 모듈 간 **연결(인터페이스/이벤트/데이터 소유권)** 을 고정하며  
3) 빠지는 것이 없도록 **체크리스트/인수조건** 을 제공한다.

참조(기존 문서):
- 핵심 개발 기획: `13-implementation/07-firebase-react-core-implementation-plan.md`
- 데이터/Rules: `13-implementation/08-firebase-data-model-and-security-rules.md`
- Functions 설계: `13-implementation/09-firebase-functions-api-and-jobs-plan.md`
- React/배포: `13-implementation/10-react-apps-architecture-and-delivery-plan.md`
- 테스트/CI/운영: `13-implementation/11~13-*.md`
- API 계약: `13-implementation/14-firebase-http-api-contract.md`
- 인덱스 플랜: `13-implementation/15-firestore-query-and-index-plan.md`
- 타임라인 이벤트: `13-implementation/16-firebase-case-timeline-event-catalog.md`

---

## 0) 시스템 구성(최상위)

### 클라이언트(React)
- User Web: 퍼널/케이스/문서 업로드/결제
- Partner Console: 케이스 큐/문서 검토/견적/진행 관리
- Ops Console: 승인 큐/파트너 온보딩/환불/정산/감사

### Firebase
- Firestore: “읽기 최적화 스냅샷” 저장소 + 상태 소스
- Storage: 문서 파일 저장
- Cloud Functions(HTTPS): 모든 “액션/상태 전이/외부 연동”의 단일 실행 경로
- Cloud Scheduler: 정산 배치/SLA 스캔/클린업

### 외부 연동(Functions에서만)
- PG(결제/환불 웹훅)
- 메시징(카카오/이메일/SMS)
- OCR/문서 검토(선택)

---

## 1) 모듈(경계) 정의 — “이대로 레포 패키지로 분리”

아래 모듈은 코드 레벨로 분리하고, 각 모듈은 **자기 데이터/자기 규칙**을 가진다.

### M1. Auth/RBAC 모듈
- 책임: Firebase Auth, Custom Claims(role/partnerId), 세션/로그인 UX
- 산출물:
  - claims 발급/갱신 Functions
  - 공용 `requireRole()` 미들웨어(Functions)
  - 클라이언트용 `useAuth()` 훅

### M2. Funnel/Diagnosis 모듈
- 책임: intent/diagnosis/results 생성, 세션 저장, 카드 렌더 계약 제공
- 인터페이스:
  - HTTPS: `/v1/intent`, `/v1/diagnosis/answer`, `/v1/results`
  - Firestore: `sessions/{sessionId}`
- 주의: 비로그인 퍼널 허용 여부는 정책 결정(익명/토큰 전략 필요)

### M3. Partner Discovery/Ads 모듈
- 책임: 추천/랭킹, 광고 스폰서 노출, disclosure 카드 생성
- 인터페이스:
  - Results 응답에 `partners[]`, `disclosureCards[]`로 제공
  - Firestore: `partners/{partnerId}`, `adCampaigns/*`(있다면)

### M4. Case 모듈(상태 머신)
- 책임: 케이스 생성/배정/상태 전이, 권한/가시성, 타임라인 기록
- 인터페이스:
  - HTTPS: `/v1/cases`, `/v1/cases/{caseId}`, `/v1/cases/{caseId}/transition`
  - Firestore: `cases/{caseId}`, `cases/{caseId}/timeline/*`

### M5. Document 모듈(Storage + 검토 워크플로우)
- 책임: 업로드 URL 발급, 버전/슬롯, 검토 요청/결정, 보완 루프
- 인터페이스:
  - HTTPS: upload-url, submit-fix, review-request/review-decision
  - Storage: `cases/{caseId}/documents/{documentId}/{versionId}`
  - Firestore: `cases/{caseId}/documents/*`

### M6. Quote 모듈(견적)
- 책임: draft/finalize/accept, 약관/동의 버전 기록, 승인게이트 연동(필요 시)
- 인터페이스:
  - HTTPS: draft/finalize/accept
  - Firestore: `cases/{caseId}/quotes/*`
  - 타임라인 이벤트 필수

### M7. Payments/Refunds 모듈(PG + 멱등)
- 책임: 결제 생성, 웹훅 수신/검증/멱등, 환불 승인/집행
- 인터페이스:
  - HTTPS: payments/create, pg/webhook, refunds/request/execute
  - Firestore: `cases/{caseId}/payments/*`, `cases/{caseId}/refunds/*`
  - Idempotency store: `idempotencyKeys/*` (권장)

### M8. Approvals 모듈(승인 게이트)
- 책임: approval 생성/결정/감사/만료, ops 큐 제공
- 인터페이스:
  - HTTPS: ops approvals decision
  - Firestore: `approvals/*`
  - 규칙: 고위험 액션은 승인 없이 집행 불가(서버가 보장)

### M9. Settlements/Receivables 모듈(정산/미수금)
- 책임: 정산 배치 생성(스케줄), 지급, 미수금 생성/상계(가드레일)
- 인터페이스:
  - HTTPS: ops settlements generate/pay (또는 스케줄)
  - Firestore: `settlements/*`, `partners/{partnerId}/receivables/*`

### M10. Observability/Audit 모듈(운영준비)
- 책임: requestId/correlationId, 구조화 로그, 감사 로그, 런북 유도
- 인터페이스:
  - Firestore: `auditLogs/*`(또는 BigQuery/GCP Logging)
  - 타임라인(PII 금지) 정책 준수

---

## 2) 데이터 소유권(“누가 최종 진실인가”)

규칙: “상태”는 Firestore에 존재하지만, **상태 변경은 Functions만** 한다.

| 도메인 | 소유 모듈 | Firestore 경로 | 클라이언트 write |
|---|---|---|---|
| Session | M2 | `sessions/*` | 제한적(또는 서버만) |
| Case | M4 | `cases/*` | 금지(서버 전용) |
| Timeline | M4/M10 | `cases/*/timeline/*` | 금지(서버 전용) |
| Document meta | M5 | `cases/*/documents/*` | 금지(서버 전용) |
| Quote | M6 | `cases/*/quotes/*` | 금지(서버 전용) |
| Payment/Refund | M7 | `cases/*/payments/*`, `cases/*/refunds/*` | 금지(서버 전용) |
| Approval | M8 | `approvals/*` | ops만 |
| Settlement/Receivable | M9 | `settlements/*`, `partners/*/receivables/*` | ops만 |

---

## 3) 모듈 간 연결(인터페이스) — “여기가 깨지면 사고”

### 3.1 이벤트/타임라인 연결(분쟁/감사 핵심)
- 모든 모듈은 상태 변경 시 **타임라인 이벤트**를 남긴다.
- 이벤트 카탈로그: `13-implementation/16-firebase-case-timeline-event-catalog.md`
- PII 금지(문서 URL/OCR 원문/계좌/주민번호)

### 3.2 Approval 게이트 연결(고위험 액션 공통)
- M6(견적 finalize), M7(환불), M5(메시지 발송), M10(PII 열람)
- 공통 패턴:
  1) 승인 필요 시 `approvals/*` 생성
  2) API는 412 `APPROVAL_REQUIRED`로 반환
  3) 승인 후에만 재시도/집행 가능

### 3.3 멱등성 연결(결제/환불/승인/정산)
- Idempotency-Key를 강제하고, 서버에서 “한 번만” 처리되게 저장
- 재시도/웹훅 중복은 항상 발생한다고 가정(필수)

---

## 4) 프로덕트 수준 “누락 방지 체크리스트”

### A. 보안/권한
- [ ] Rules 테스트가 CI에서 돈다(에뮬레이터)
- [ ] 클라이언트 직접 status/payment/settlement 업데이트 차단
- [ ] Storage Rules가 Firestore 권한과 동치

### B. 돈(결제/환불/정산)
- [ ] PG 웹훅 서명 검증
- [ ] 웹훅 멱등(같은 이벤트 2번 와도 안전)
- [ ] 환불은 승인 게이트 + 감사 로그
- [ ] 정산 배치/미수금 상계 가드레일(상계 한도/최소 지급)

### C. 문서/PII
- [ ] PII 저장 위치/접근 정책 명확(필드/버킷/권한)
- [ ] 타임라인에는 PII 금지

### D. 운영준비
- [ ] requestId/correlationId(caseId/sessionId) 표준화
- [ ] 장애 런북(웹훅/정산/권한사고) 준비

---

## 5) “프로덕 수준 착수”를 위한 개발 단계(쪼개기)

Phase 0 (기반)
- Rules 테스트/CI 파이프라인부터 고정
- 공통 라이브러리(인증/에러/멱등/타임라인 writer) 제작

Phase 1 (코어 플로우 1)
- User: 퍼널→케이스 생성→타임라인
- Partner: 케이스 큐(읽기) + 기본 상태 전이(수락/대기)

Phase 2 (문서/견적)
- 문서 업로드/검토 루프
- 견적 draft/finalize/accept + 승인게이트(선택)

Phase 3 (결제/환불)
- PG create + webhook + 상태/타임라인
- 환불 승인/집행

Phase 4 (정산/미수금/운영)
- 배치 생성/지급/상계
- 운영 지표/알림/런북 완성

