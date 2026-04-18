# Firebase 구현 개발 기획(4): Emulator 기반 Rules/Functions 테스트 플랜 — v1

목표: Firebase 기반 구현에서 가장 위험한 영역인 **Security Rules**와 **멱등/웹훅/승인게이트 로직**을 “로컬/CI에서 자동 검증” 가능하게 만든다.

---

## 1) 테스트 범위(우선순위)

### 1.1 Rules 테스트(최우선)
대상:
- Firestore Rules
- Storage Rules

검증 포인트:
- user: 본인 케이스/문서만 접근 가능
- partner: 본인 partnerId 케이스만 접근 가능
- ops: role별로 승인/환불/정산 write 권한 분리
- “클라가 직접 status/payment를 업데이트”하려는 시도 차단

### 1.2 Functions 테스트(우선)
대상:
- 승인게이트 생성/결정/집행
- PG 웹훅 멱등 처리
- 환불 플로우(승인→집행)
- 정산 배치 생성(미수금 상계 포함)

### 1.3 계약 테스트(상시)
대상:
- UI Cards schema
- Timeline event schema(케이스 타임라인)
- Settlement payload schema

---

## 2) 로컬 개발(Emulator) 구성(권장)

Emulator:
- Auth Emulator
- Firestore Emulator
- Storage Emulator
- Functions Emulator

권장 로컬 플로우:
1) `firebase emulators:start`
2) 테스트 시드 적재(테스트 전용 script)
3) Rules/Functions 테스트 실행

---

## 3) Rules 테스트 시나리오(필수 케이스 목록)

### 3.1 Case 접근
- user A: caseA read ✅
- user A: caseB read ❌
- partner P1: case of P1 read ✅
- partner P1: case of P2 read ❌
- ops_agent: approvals read ✅, approvals decision ❌
- ops_approver: approvals decision ✅

### 3.2 Document/Storage 접근
- user: `cases/{caseId}/documents/...` 업로드 ✅ (본인 케이스)
- partner: 같은 경로 다운로드 ✅ (배정된 케이스)
- 다른 케이스는 업/다운로드 ❌

### 3.3 Approvals 접근
- ops만 approvals 목록 read ✅
- user/partner approvals 컬렉션 직접 read ❌ (보수적으로)

---

## 4) Functions 테스트 시나리오(필수)

### 4.1 Webhook 멱등
- 같은 `pgEventId` 2회 호출 → 1회만 상태 변경, 나머지 no-op

### 4.2 Approval gate
- 환불 요청 → approval 생성 → 승인 전 집행 시도 실패
- 승인 후 집행 성공 + 상태/타임라인 기록

### 4.3 Settlement batch
- 미수금 존재 시 상계 적용(상계 한도 50%)
- 상계 후 settlement/receivables/timeline 일관

---

## 5) CI 적용(권장)

PR마다:
- 계약 검증
- emulator 기반 rules unit test
- functions unit test

메인 브랜치:
- staging deploy 자동
- prod deploy는 승인(ops_approver와 유사한 “릴리즈 승인” 프로세스)

