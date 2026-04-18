# 구현 준비물(4): 시드데이터 & 로컬 개발 플로우 — v1

목표: 개발자가 로컬에서 “퍼널→케이스→문서→견적→(가짜)결제→이벤트/정산”을 끝까지 재현할 수 있게 한다.  
원칙: 로컬은 **익명/샘플 데이터**만 사용하고, 프로덕션 PII를 절대 가져오지 않는다.

참조:
- 사건팩: `casepack_*_v1.yaml`
- 파트너 스키마: `spec_partner_profile_schema.yaml`, 최소 계약: `02-engine/contracts/partner_profile.schema.json`
- 이벤트 계약: `02-engine/events/case_event.schema.json`
- OpenAPI: `02-engine/openapi_v1.yaml`
- 테스트/QA: `13-implementation/03-test-and-qa-plan.md`

---

## 0) 로컬 개발 목표 시나리오(필수 3개)

### 시나리오 A: 정상 퍼널
1) `/v1/intent` → 2) `/v1/diagnosis/answer` 반복 → 3) `/v1/results`

### 시나리오 B: 케이스/문서
1) `/v1/cases` 생성 → 2) 문서 업로드 → 3) 검토 요청/결정

### 시나리오 C: 견적/결제(샌드박스) + 환불
1) 견적 확정/수락 → 2) (샌드박스) 결제 승인/매입 이벤트 생성 → 3) 환불 요청/승인/집행

---

## 1) 시드 데이터 구성(권장 최소 세트)

### 1.1 사건팩 3종(이미 존재)
- 설립등기: `casepack_corp_incorporation_v1.yaml`
- 임원변경: `casepack_corp_officer_change_v1.yaml`
- 본점이전: `casepack_corp_hq_move_v1.yaml`

### 1.2 파트너 샘플 10개(필수)
목표: 랭킹/광고/방문 옵션을 모두 테스트할 수 있게 분포를 만든다.

샘플 분포(예):
- 유형: 법무사사무소 6 / 법무법인 3 / 법률사무소 1
- 등급: Basic 4 / Verified 4 / Pro 2
- 방문 가능: 4개
- SLA/품질 지표: 상/중/하 섞기
- 광고 캠페인: 2개(Verified/Pro만)

필드:
- `partner_profiles.profile_json`은 `partner_profile.schema.json` 또는 YAML 스키마를 만족
- `partner_casepack_capabilities`에 사건팩 매핑

샘플 파일(시작점):
- `13-implementation/seeds/partners.seed.json`
- `13-implementation/seeds/ads.seed.json`
- `13-implementation/seeds/case_events.sample.jsonl` (케이스 이벤트 스트림 샘플)

### 1.3 가격 룰 샘플
최소:
- 사건팩별 min~max 범위
고급:
- `spec_pricing_rules_dsl.yaml` 샘플 룰 2~3개

---

## 2) 로컬 인프라(권장)

필수 구성:
- PostgreSQL (RLS 테스트 가능해야 함)
- Object storage 대체(MinIO 또는 로컬 파일 저장소)
- Queue/Worker(선택): 문서 분류/OCR/정산 배치 흉내

권장 도커 컴포즈 구성(개념):
- `postgres`
- `minio`
- `api-server`
- `worker`(선택)

---

## 3) 이벤트 재현(Replay) 도구(강력 권장)

왜 필요?
- 이 시스템의 진실은 `domain_events`에 있으므로,
- “이벤트 리플레이로 스냅샷 재구성”이 가능해야 운영 복구/테스트가 쉬움.

필수 기능:
- 케이스 단위로 이벤트 스트림을 읽어 `cases/documents/quotes/payments` 스냅샷을 재구성
- 특정 시점까지 replay(디버깅)
- 스키마 검증 실패 이벤트를 격리(Dead-letter)

---

## 4) 로컬에서 결제/웹훅 흉내내기

원칙:
- 실제 PG 키 없이 “샌드박스 모드”로 결제 이벤트를 생성한다.

방법(예):
- `POST /internal/dev/pg/webhook` 같은 개발 전용 엔드포인트(프로덕션 배포 금지)
- 입력: webhook payload(authorized/captured/failed/refund)
- 출력: 내부 이벤트 발행 + payments/refunds 상태 반영

보안:
- dev 환경에서만 활성화(feature flag)
- stage/prod에서는 빌드 자체에 포함하지 않거나 라우트 제거

---

## 5) 로컬 개발 체크리스트

- [ ] DB 마이그레이션 적용(`domain_events` 포함)
- [ ] 시드 파트너/사건팩 로드
- [ ] 퍼널 3 API가 카드 계약을 만족
- [ ] 케이스 생성 후 문서 업로드/검토 이벤트가 쌓임
- [ ] 결제 샌드박스 이벤트로 정산/원장 분개까지 생성
- [ ] RLS: partner A가 partner B 케이스 접근 불가 확인
