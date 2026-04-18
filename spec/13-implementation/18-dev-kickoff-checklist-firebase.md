# 개발 착수 체크리스트(Firebase + React) — v1

목표: 이 체크리스트를 그대로 따라 하면 “바로 개발”이 시작되는 상태가 된다.

참조 문서(개발 기획):
- 핵심 기능 로드맵: `13-implementation/07-firebase-react-core-implementation-plan.md`
- 데이터 모델/Rules: `13-implementation/08-firebase-data-model-and-security-rules.md`
- API/배치 설계: `13-implementation/09-firebase-functions-api-and-jobs-plan.md`
- React 아키텍처/배포: `13-implementation/10-react-apps-architecture-and-delivery-plan.md`
- 테스트: `13-implementation/11-firebase-emulator-and-rules-test-plan.md`
- CI/CD: `13-implementation/12-firebase-ci-cd-and-env-management.md`
- 운영준비: `13-implementation/13-firebase-observability-and-ops-readiness.md`
- HTTPS API 계약: `13-implementation/14-firebase-http-api-contract.md`
- 인덱스 플랜: `13-implementation/15-firestore-query-and-index-plan.md`
- 타임라인 이벤트: `13-implementation/16-firebase-case-timeline-event-catalog.md`

---

## 1) 레포 스캐폴딩(최소)

권장 모노레포:
- `apps/user-web`
- `apps/partner-console`
- `apps/ops-console`
- `functions`
- `packages/contracts` (json schema)
- `packages/firebase` (firebase init + typed converters)
- `packages/ui-cards-renderer`

---

## 2) Firebase 프로젝트/환경 세팅

- dev/staging/prod 3개 프로젝트 생성
- 각각에 대해:
  - Firestore/Storage 활성화
  - Authentication 활성화
  - Functions/Hosting 연결

비밀키:
- PG/메시지발송/외부 API 키는 Functions config 또는 Secret Manager에만 저장

---

## 3) Rules 파일 반영(초기)

초안 파일 위치:
- `spec/13-implementation/firebase.rules/firestore.rules`
- `spec/13-implementation/firebase.rules/storage.rules`

해야 할 일:
- 실제 레포의 `firestore.rules`, `storage.rules`로 복사
- Emulator에서 rules 테스트를 먼저 통과시킨 후 staging/prod에 배포

---

## 4) 인덱스 생성

문서:
- `spec/13-implementation/15-firestore-query-and-index-plan.md`

해야 할 일:
- 화면별 쿼리 구현 → 콘솔이 요구하는 복합 인덱스 생성
- 가능한 경우, 미리 정의한 인덱스를 `firestore.indexes.json`로 관리

---

## 5) Functions 구현 순서(추천)

1) `POST /v1/intent`, `POST /v1/diagnosis/answer`, `GET /v1/results`
2) `POST /v1/cases` + `GET /v1/cases/{caseId}`
3) `documents/upload-url` + storage finalize trigger
4) approvals(승인게이트) 컬렉션 + ops decision API
5) PG create + webhook 멱등 처리
6) refunds(request/execute) + 승인게이트 연동
7) settlements(batch generate) + receivables/offset

계약:
- `spec/13-implementation/14-firebase-http-api-contract.md`

---

## 6) 타임라인 이벤트 기록(필수)

문서:
- `spec/13-implementation/16-firebase-case-timeline-event-catalog.md`

원칙:
- “무슨 일이 있었는지”는 반드시 timeline에 남긴다
- PII는 절대 남기지 않는다

---

## 7) Emulator 테스트/CI

로컬:
- emulator start
- rules 테스트
- functions unit test

CI:
- PR마다 contracts validate + rules test + functions test

---

## 8) 첫 E2E 통과 기준(개발 착수 완료의 정의)

- 퍼널 → 케이스 생성 → 문서 업로드/보완 → 견적 → 결제 → 정산 생성
- 승인게이트 1개 이상(예: 환불) 실제로 작동
- Rules 테스트가 “권한 사고”를 막음

