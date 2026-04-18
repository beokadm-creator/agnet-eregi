# 프로덕트 수준 개발 착수 문서(2): Phase 0(기반) 모듈화/공용화 작업 계획 — v1

목표: 프로덕션 품질에서 가장 중요한 “공통 기반”을 먼저 구현해서,
이후 모듈(M2~M10)을 붙일 때 **중복/누락/권한 사고/멱등 사고**를 방지한다.

전제: `13-implementation/19-product-module-breakdown-and-integration-map.md`의 모듈 경계를 따른다.

---

## 0) Phase 0 산출물(반드시 먼저)

### F0-1. 공통 HTTP/에러 규격
- 응답 envelope: `{ok,data}` / `{ok:false,error{code,messageKo,requestId,details}}`
- 코드 표준화: `UNAUTHENTICATED/FORBIDDEN/APPROVAL_REQUIRED/...`
- requestId 발급/전파(헤더 `X-Request-Id`)

### F0-2. Auth/RBAC 미들웨어
- Functions에서 `requireAuth()`, `requireRole()` 공용화
- Custom Claims(role/partnerId) 기준으로 권한 체크

### F0-3. 타임라인 writer(PII 금지)
- “상태 변경 시 반드시 타임라인 기록”을 함수로 강제
- meta에 PII 키가 들어오면 서버에서 실패(가드)
- 코드(레포): `firebase-react/functions/src/lib/timeline.ts`

### F0-4. 멱등성 프레임워크
- `Idempotency-Key` 강제 대상:
  - 결제 생성/웹훅 처리/환불 요청/승인 결정/정산 생성/지급
- 저장소: `idempotencyKeys/{scope}:{key}`
- 동일 키 재호출 시 동일 response 반환
- 코드(레포): `firebase-react/functions/src/lib/idempotency.ts`

연결성 원칙(데드코드 방지):
- Phase 0에서 만든 멱등성은 “나중에 적용”이 아니라, **즉시** 최소 2개 엔드포인트에 적용해 사용 중이어야 한다.
  - 예: `funnel.intent`, `cases.create`, `approvals.decision`, `refunds.execute`

### F0-5. Rules 테스트/CI 게이트
- emulator 기반 rules test가 PR에서 반드시 실행
- 테스트 케이스는 문서(11-*)의 시나리오와 1:1로 매칭

---

## 1) 레포/코드 구조(권장)

### Cloud Functions
```
functions/src/
  lib/
    http.ts           // ok/fail + requestId
    auth.ts           // requireAuth + role helpers
    firestore.ts      // ref helpers
    timeline.ts       // writeTimelineEvent + PII guard
    idempotency.ts    // (다음 단계) withIdempotency
  routes/
    v1/
      funnel.ts
      cases.ts
      ...
  index.ts            // wiring only
```

### React
```
packages/firebase      // emulator connect + init
packages/api-client    // (권장) token attach + error normalize
apps/*                 // 화면 + hooks
```

---

## 2) 완료 기준(Phase 0 Done Definition)

- [ ] 모든 Functions 엔드포인트가 공통 `ok/fail`을 사용
- [ ] requireAuth/role 체크가 누락되지 않게 구조화(라우트 단위)
- [ ] 타임라인 writer가 케이스/문서/결제/환불/정산에 적용될 구조가 준비됨
- [ ] Idempotency 저장소 + 1개 엔드포인트에서 실제 동작
- [ ] rules test 스모크가 로컬/CI에서 돌며, 핵심 사고를 막음
