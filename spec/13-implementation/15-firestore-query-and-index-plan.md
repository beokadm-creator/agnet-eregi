# Firebase 구현 개발 기획(8): Firestore 쿼리/인덱스 플랜(v1)

목표: 개발자가 “어떤 화면에서 어떤 쿼리”를 쓰는지 확정하고, 그에 필요한 **복합 인덱스**를 미리 정리한다.

참조:
- 데이터 모델: `13-implementation/08-firebase-data-model-and-security-rules.md`
- 앱 아키텍처: `13-implementation/10-react-apps-architecture-and-delivery-plan.md`

---

## 0) 공통 원칙

1) Firestore는 조인이 없으므로 **리스트 화면 단위로 denormalized snapshot**을 둔다.  
2) `orderBy + where` 조합은 대개 복합 인덱스가 필요하다.  
3) `in`/`array-contains-any`는 비용이 크므로, 가능한 “상태별 큐 컬렉션” 분리를 고려한다(Ops 큐 등).

---

## 1) 화면별 대표 쿼리(확정)

### 1.1 User App

#### (U1) 내 케이스 목록
컬렉션: `cases`
- where: `ownerUid == <uid>`
- orderBy: `updatedAt desc`

#### (U2) 케이스 상세
- doc get: `cases/{caseId}`
- subcollection:
  - `cases/{caseId}/documents orderBy updatedAt desc`
  - `cases/{caseId}/timeline orderBy occurredAt asc`

### 1.2 Partner Console

#### (P1) 케이스 큐(상태별)
컬렉션: `cases`
- where: `partnerId == <partnerId>`
- where: `status in ["new","in_progress","waiting_partner","waiting_user"]`
- orderBy: `updatedAt desc`

> status in + orderBy 조합이 인덱스를 요구할 가능성 큼.

#### (P2) 정산 목록
컬렉션: `settlements`
- where: `partnerId == <partnerId>`
- orderBy: `period.from desc`

#### (P3) 미수금 목록
컬렉션: `partners/{partnerId}/receivables`
- where: `status == "open"`
- orderBy: `createdAt asc`

#### (P4) 문서 검토 큐(컬렉션 그룹)
컬렉션: `collectionGroup("documents")`
- where: `partnerId == <partnerId>`
- where: `status in ["uploaded","needs_fix"]`
- orderBy: `updatedAt desc`

### 1.3 Ops Console

#### (O1) 승인 큐
컬렉션: `approvals`
- where: `status == "pending"`
- where: `gate == <gate>` (선택)
- orderBy: `createdAt asc`

#### (O2) 파트너 온보딩 심사 큐
컬렉션: `partnerOnboarding`
- where: `status in ["submitted","under_review","needs_fix"]`
- orderBy: `updatedAt desc`

#### (O3) 정산 배치/지급 관리
컬렉션: `settlements`
- where: `status in ["created","paid"]`
- orderBy: `period.from desc`

---

## 2) 필요한 복합 인덱스(초기 목록)

> 실제 개발 중 Firestore 콘솔이 “인덱스 생성 링크”를 제시하지만, 아래를 먼저 깔아두면 생산성이 올라간다.

### cases
1) `cases(ownerUid, updatedAt desc)`
2) `cases(partnerId, status, updatedAt desc)`  *(status in 지원용)*
3) (선택) `cases(status, updatedAt desc)` *(ops 전용 전체 큐가 필요하면)*

### approvals
1) `approvals(status, createdAt asc)`
2) `approvals(status, gate, createdAt asc)`

### settlements
1) `settlements(partnerId, period.from desc)`
2) `settlements(status, period.from desc)`

### partnerOnboarding
1) `partnerOnboarding(status, updatedAt desc)`

### receivables (subcollection)
1) `partners/{partnerId}/receivables(status, createdAt asc)`

### documents (collectionGroup)
1) `documents(partnerId, status, updatedAt desc)`

---

## 3) 필드 설계 체크리스트(인덱스 실패 방지)

- `updatedAt`, `createdAt`, `occurredAt`는 반드시 Timestamp 타입
- 정렬 필드는 top-level에 둔다(중첩 객체 내부는 쿼리/인덱스가 불편)
- `status`는 string enum(고정 값)
- 큐 화면은 `status`를 1~4개 수준으로 제한(너무 많으면 in 쿼리 폭발)

---

## 4) “쿼리 안 되는 기능”을 위한 대안

예: “파트너별 승인 큐”, “SLA 임박 케이스만”
- Scheduler가 `opsQueues/...` 스냅샷 컬렉션을 생성(denormalized)
- 화면은 그 컬렉션만 조회(단순 쿼리)
