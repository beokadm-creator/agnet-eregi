# Firebase 구현 개발 기획(5): CI/CD & 환경(Dev/Staging/Prod) 관리 — v1

목표: Firebase 프로젝트/비밀키/Rules/Functions 배포를 “사람 손”이 아니라 **파이프라인**으로 통제한다.

---

## 1) Firebase 프로젝트 분리(필수)

- `project-dev`
- `project-staging`
- `project-prod`

원칙:
- prod는 dev/staging과 **완전히 분리**(Firestore 데이터/Storage 버킷/Functions config)
- Rules/Indexes/Functions는 “같은 소스”에서 배포하되, 환경 변수만 다르게

---

## 2) 배포 대상(artifact)

필수:
- Firestore Rules
- Firestore Indexes
- Storage Rules
- Cloud Functions
- Hosting(React 앱) — user/partner/ops 각각 도메인 분리 권장

---

## 3) 비밀키/환경 변수 관리

권장:
- Firebase Functions config(또는 GCP Secret Manager)
- CI에서는 “환경별” secret을 주입

예:
- PG 키
- 외부 메시징 API 키
- 웹훅 서명 검증 키

원칙:
- 프론트에 비밀키가 들어가면 안 됨
- 결제/환불/정산/메시지 발송은 Functions에서만 실행

---

## 4) CI 파이프라인(권장 단계)

PR:
1) contracts validate
2) rules unit test (emulator)
3) functions unit test
4) build(user/partner/ops)

main:
1) 동일 검증
2) staging deploy(자동)

release tag:
1) 동일 검증
2) prod deploy(승인 필요)

---

## 5) 릴리즈 롤백 전략

Functions:
- 버전 태깅(배포 아티팩트 기록)
- 치명 장애 시 이전 버전 재배포

Rules:
- Rules는 즉시 반영되므로, 배포 전 “rules test” 통과를 강제

데이터 마이그레이션:
- Firestore는 스키마가 느슨하므로, 변경 시 “쓰기 경로”부터 이중 지원(서버에서) 후 점진적 전환

