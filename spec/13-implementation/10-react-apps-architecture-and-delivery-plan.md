# Firebase 구현 개발 기획(3): React 앱 아키텍처 & 전달(Delivery) 계획 — v1

목표: React(사용자/파트너/운영) 3개 앱을 “같은 규칙/같은 계약”으로 개발할 수 있게,
라우팅/상태/데이터 접근/권한/배포 단위를 명확히 한다.

---

## 1) 앱 구성(권장)

모노레포(권장):
- `apps/user-web` (React)
- `apps/partner-console` (React)
- `apps/ops-console` (React)
- `packages/ui` (공용 UI)
- `packages/contracts` (UI 카드/이벤트/정산 계약 json schema)
- `packages/firebase` (firebase init, hooks, typed converters)
- `functions/` (Cloud Functions)

---

## 2) 화면 단위 “API 계약” 원칙

모든 화면은 아래 중 하나로 데이터를 받는다:
- Firestore query(읽기 전용 스냅샷)
- HTTPS Functions(상태 전이/결제/승인 등 “액션”)

금지:
- 클라이언트가 케이스 상태/결제 상태 같은 핵심 필드를 직접 업데이트

---

## 3) 상태 관리/데이터 패턴(권장)

데이터:
- Firestore: `react-firebase-hooks` 또는 자체 훅 래퍼
- 서버 액션: `fetch` 기반 HTTPS Functions 호출(토큰 첨부)

상태:
- 전역 상태는 최소화(세션/로그인/feature flags 정도)
- 케이스 상세 화면은 “caseId” 기준으로 Firestore 스냅샷 구독

오프라인:
- user app은 기본 오프라인 캐시 허용(읽기)
- partner/ops는 데이터 정합이 중요하므로 제한적으로 사용

---

## 4) UI Cards Renderer(핵심 공용 모듈)

퍼널/결과/고지 UI는 “서버가 내려주는 카드 계약”을 렌더링하는 구조를 유지:
- `packages/ui-cards-renderer`
- 카드 스키마: `02-engine/contracts/ui_cards.schema.json`

목표:
- 정책/문구/노출 순서를 서버에서 바꿔도 프론트 배포 없이 반영 가능

---

## 5) 에러/승인 대기 UX 규칙

승인 게이트:
- 서버가 “승인 필요” 응답을 주면, UI는 approvalId로 ops/partner 승인 화면으로 유도
- user app은 “처리중/확정 대기” 상태를 명확히 보여줌

에러:
- 사용자 메시지(`messageKo`)와 디버그용 `requestId`를 분리해서 표시

---

## 6) 배포/환경 분리(권장)

Firebase 프로젝트 분리:
- `dev` / `staging` / `prod`

각 환경별:
- Firestore Rules/Indexes
- Storage Rules
- Functions config(비밀키/PG 키)

CI(최소):
- contracts validate
- rules unit test(emulator)
- functions unit/integration test
- build & deploy(스테이징 자동, 프로드는 승인)

