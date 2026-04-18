# Firebase 구현 개발 기획(10): Security Rules 초안(문서 + 파일화 가이드) — v1

목표: 개발 착수 즉시 Rules를 작성/테스트할 수 있도록, “규칙 패턴”과 “금지 항목”을 명확히 한다.  
실제 Rules 파일 초안은 `13-implementation/firebase.rules/firestore.rules`, `.../storage.rules`에 둔다.

참조:
- 데이터 모델/권한: `13-implementation/08-firebase-data-model-and-security-rules.md`
- 테스트 플랜: `13-implementation/11-firebase-emulator-and-rules-test-plan.md`

---

## 1) 핵심 원칙(반드시 지켜야 함)

1) **클라이언트가 케이스 상태/결제 상태/정산 상태를 직접 수정 금지**  
   - 반드시 Functions에서만 변경
2) user/partner/ops 접근은 Claims(role/partnerId)로 판정
3) Storage 접근은 Firestore 권한과 동일하게 강제(파일만 열리는 사고 방지)

---

## 2) Rules 개발 체크리스트(필수)

- [ ] cases: user 소유/partner 배정/ops role별 read 분리
- [ ] documents: case 권한 상속 + user가 올리는 필드 제한
- [ ] approvals: ops 전용 + approver만 decision 가능
- [ ] settlements/receivables: partnerId 스코프 + ops 전용 write
- [ ] timeline: write는 Functions만, read는 case 권한 상속
- [ ] Storage: 업로드 경로가 caseId를 포함하고, case 권한이 있어야 read/write

