# 로드맵 & 백로그(전체 범위) — v1

목표: “MVP를 안 하더라도” 개발이 성공하려면 **릴리즈 단위(Phase)** 로 쪼개서 병렬 개발/검증/운영 리스크를 관리해야 합니다.  
본 문서는 기능을 **에픽(Epic) → 스토리(Story) → 수용기준(AC)** 로 정리해, 개발 착수 가능한 수준의 기획 백로그를 제공합니다.

---

## 0) 제품 릴리즈 단계(권장)

### Phase 0 — 기반(Infra/Contracts)
목표: 이후 기능이 얹힐 “계약/로그/권한/문서저장/이벤트”의 뼈대를 확정.
- 이벤트 저장소 + 감사로그
- DB 스키마/마이그레이션
- 문서 저장(버전/권한/보관)
- RBAC/RLS(최소)
- 관측(로그/메트릭/트레이싱)

### Phase 1 — 사용자 퍼널 + 매칭 + 케이스 워크스페이스
목표: “유입→진단→추천→선택→케이스 생성→서류 업로드”의 닫힌 루프.
- 홈(자연어/카테고리) + 미니 진단
- 추천 1안 + 비교 Top3 + 스폰서 영역
- 케이스 생성/조회
- 문서 슬롯/업로드/기본 검토 요청

### Phase 2 — 파트너/운영 콘솔 + 수동검토 안전밸브
목표: 실제 운영 가능한 수준(Manual review, SLA, 메시지 승인).
- 파트너 케이스 큐/상세/문서 검토/보완요청(승인게이트)
- 운영자 수동검토 큐 + 에스컬레이션
- SLA 타이머/브리치 감지

### Phase 3 — 결제/정산/환불 + 광고 과금
목표: 매출/대사 가능한 운영 체계.
- 견적 확정/동의
- 결제/환불 상태 머신
- 정산 배치/리포트
- 스폰서 노출/클릭 정산

### Phase 4 — 고도화(품질/자동화/확장)
목표: 사건팩 확장, 리스크 자동화, 파트너 SaaS/팀 기능.
- 사건팩 확장(기타등기/부동산 등)
- 품질지표/랭킹 고도화
- 파트너 팀 계정/권한/템플릿

### Phase 5 — 스케일업 및 지능화 (Scale-up & AI Intelligence)
목표: 누적된 데이터와 AI를 활용하여 수동 운영 비용을 최소화하고, 옴니채널을 통해 사용자/파트너 경험을 극대화합니다.
- AI 문서 인식(Document AI) 및 결함 사전 차단
- 옴니채널 알림(Slack, 카카오톡, SMS) 및 매직 링크
- 24/7 AI CS 챗봇 및 파트너용 AI 어시스턴트
- 데이터 기반 소요 시간(ETA) 예측 및 동적 파트너 매칭 최적화

### Phase 6 — 초자동화 및 B2G 연동 (Hyper-Automation & B2G Integration)
목표: 플랫폼 내 서류를 대법원 등 관공서에 직접 제출(E-Filing)하여 수작업을 완전히 제거(Zero-Touch)합니다.
- 공공기관 인증서 및 자격증명 중앙 관리 (GCP Secret Manager)
- B2G 전자신청 패키지 자동 전송 (IROS, 정부24 등)
- 공과금 및 세금 파싱 및 자동 납부 연동
- 관공서 처리 상태(보정명령 등) 폴링 및 실시간 동기화

### Phase 7 — B2B 파트너십 및 글로벌 확장 (B2B API & Global Localization)
- **EP-14 B2B 오픈 API 연동**: 외부 B2B 플랫폼에서 당사 시스템으로 사건팩을 위탁할 수 있는 Webhook/API 연동(OAuth2 기반).
- **EP-15 글로벌 다국어 지원**: `react-i18next` 기반의 다국어(i18n) 시스템과 Firestore 기반 다중 통화(결제) 및 환율 관리 로직 추가.
- [상세 스펙: 65-b2b-open-api.md](../13-implementation/65-b2b-open-api.md)
- [상세 스펙: 66-global-localization.md](../13-implementation/66-global-localization.md)

### Phase 8 — 프로덕션 스케일업 및 완전 자동화 (Scale & Maturity)
- **EP-16 프론트엔드 UI/UX 고도화 및 테스트**: Component Library 도입, React Testing Library 및 E2E 테스트 커버리지 확장.
- **EP-17 인프라 보안 및 컴플라이언스**: Firebase App Check, 2FA(이중 인증), PII(개인식별정보) 암호화 등 보안 적용.
- [상세 스펙: phase-8-roadmap.md](./phase-8-roadmap.md)

### Phase 9 — 지능형 자동화 및 파트너 확장 (Intelligent Automation & Partner Ecosystem)
- **EP-18 AI 기반 서류 자동 검증 (OCR/Vision)**: 사용자 증빙 서류에 대한 AI 1차 판독 및 필수 항목 누락 자동 확인.
- **EP-19 파트너 오픈 API 및 고급 Webhook**: ERP/CRM 연동용 Public API Key 발급 및 재시도 로직 포함된 Webhook 발송 시스템.
- **EP-20 고급 멀티채널 고객 알림**: 케이스 진행 상황을 이메일(Sendgrid) 및 SMS(Twilio)로 자동 발송하는 템플릿 시스템.
- [상세 스펙: phase-9-roadmap.md](./phase-9-roadmap.md)

### Phase 10 — 플랫폼 제품화 및 운영 표준화 (Platformization & Governance)
- **EP-21 Partner Auth 제품화**: API Key 회수/회전, lastUsedAt, OAuth2(Client Credentials) + scope 도입.
- **EP-22 Webhook Delivery 서비스화**: 재시도/백오프/DLQ, 서명, 이벤트 카탈로그/스키마 버전 정책.
- **EP-23 Metering & Quota**: 파트너별 사용량 계측, 플랜별 레이트리밋/쿼터, 운영자 강제 조정.
- **EP-24 Observability 표준화**: 구조적 로그/트레이스, SLO/에러버짓, Ops 대시보드 고도화.
- [상세 스펙: phase-10-roadmap.md](./phase-10-roadmap.md)

> 참고: “MVP를 안 한다”는 의미는 Phase 1~3을 모두 하겠다는 것으로 해석하되, **릴리즈 순서/의존성 관리**는 여전히 필요합니다.

---

## 1) 에픽 목록(전체)

### EP-01 사용자 퍼널(홈→진단→결과)
- EP-01-01 자연어 의도 입력/세션
- EP-01-02 미니 진단(3~7문항) + 자동 저장
- EP-01-03 가치 프리뷰(비용/시간/준비물) 카드
- EP-01-04 결과(추천 1안 + 비교 Top3 + 더보기)

### EP-02 매칭/랭킹/광고(노출 정책 포함)
- EP-02-01 파트너 필터링(역량/지역/가용성)
- EP-02-02 랭킹(품질/SLA/가격/ETA/광고 분리)
- EP-02-03 스폰서(광고) 노출/클릭 트래킹

### EP-03 케이스 워크스페이스(사용자)
- EP-03-01 케이스 생성/조회/타임라인
- EP-03-02 문서 슬롯/업로드/버전
- EP-03-03 알림(다음할일/보완/마감)

### EP-04 파트너 콘솔(PC)
- EP-04-01 케이스 큐/필터/SLA 뷰
- EP-04-02 문서 검토/보완요청(승인게이트)
- EP-04-03 견적 확정/동의 요청

### EP-05 운영 콘솔(PC)
- EP-05-01 수동검토 큐(고리스크/분쟁/정책 위반)
- EP-05-02 SLA 브리치/재배정/정지
- EP-05-03 환불/정산/광고 정책 운영

### EP-06 결제/환불/정산(회계/대사)
- EP-06-01 결제(승인/매입) + PG 연동
- EP-06-02 환불(요청/승인/집행)
- EP-06-03 정산 배치(파트너 지급) + 원장/리포트

### EP-07 파트너 입점/검증(Verified/Pro)
- EP-07-01 입점 신청/서류/심사
- EP-07-02 등급/정책 위반/정지/재심사
- EP-07-03 파트너 SaaS 구독(플랜/청구/연체)

### EP-08 플랫폼 기반(보안/관측/법무)
- EP-08-01 Auth/RBAC/RLS/감사로그
- EP-08-02 문서 저장/암호화/보관/삭제요청
- EP-08-03 관측(제품 분석 + 운영 모니터링)
- EP-08-04 약관/개인정보/책임분리 문구/동의 로그

### EP-09 AI 문서 인식 및 검증 (Document AI)
- EP-09-01: 업로드 문서 OCR 자동 판독 및 정보 추출
- EP-09-02: 결함 문서(유효기간, 서명 누락 등) 사전 차단
- EP-09-03: 민감 개인정보(주민번호 등) 식별 및 마스킹

### EP-10 옴니채널 알림 및 외부 연동 (Omni-channel)
- EP-10-01: 사용자 대상 카카오 알림톡/SMS 연동
- EP-10-02: 파트너/운영팀 대상 Slack/Teams 연동
- EP-10-03: 보안 딥링크(Magic Link) 워크스페이스 진입

### EP-11 지능형 CS 및 대화형 에이전트 (AI Agent)
- EP-11-01: 24/7 LLM 기반 CS 챗봇 도입
- EP-11-02: 대화형 진단 챗봇 인터페이스
- EP-11-03: 파트너용 AI 어시스턴트 (답변/견적 초안)

### EP-12 데이터 기반 예측 및 동적 최적화 (Data Analytics)
- EP-12-01: ETA 및 승인 확률 예측 모델링
- EP-12-02: 실시간 파트너 Capacity 기반 매칭
- EP-12-03: 이탈(Drop-off) 자동 감지 및 리마인드

### EP-13 B2G 연동 (공공기관 E-Filing)
- EP-13-01: 공공기관 인증서(Credential) 암호화 관리
- EP-13-02: 대법원/정부24 패키지 자동 전송 워커
- EP-13-03: 공과금 및 세금 자동 파싱/납부 연동
- EP-13-04: 공공기관 심사 상태 폴링 및 보정명령 에스컬레이션

### EP-14 B2B Open API 및 파트너십 연동
- EP-14-01: JWT 기반 API 인증 및 Rate Limiting
- EP-14-02: 케이스 관리 API (생성/조회) 및 서류 업로드
- EP-14-03: 상태 변화 실시간 알림을 위한 Webhook 연동

### EP-15 글로벌 확장 및 지역화 (Global & Localization)
- EP-15-01: 다국어(i18n) 번역 및 메타데이터 파이프라인
- EP-15-02: 글로벌 결제(Stripe) 및 실시간 환율 기반 견적
- EP-15-03: 아포스티유(Apostille) 문서 AI 자동 판독 및 매뉴얼 리뷰

---

## 2) 핵심 스토리(예시) + 수용기준(AC)
> 아래는 “개발이 바로 가능한 형태”의 AC 예시입니다. 실제로는 각 에픽별로 반복 생성합니다.

### S-01 홈에서 의도 제출
- Story: 사용자는 홈에서 자연어로 의도를 입력해 진단을 시작한다.
- AC
  1. `POST /v1/intent` 호출 시 sessionId가 없으면 서버가 신규 sessionId를 발급한다.
  2. 응답은 UI 카드 계약(`ui_cards.schema.json`)을 만족한다.
  3. 이벤트 `INTENT_SUBMITTED`가 `domain_events`에 append-only로 저장된다(중복 방지: requestId로 멱등).

### S-02 진단 응답 저장 및 가치 프리뷰 갱신
- Story: 사용자는 진단 문항에 답하고, 즉시 가격/시간/준비물 프리뷰를 본다.
- AC
  1. `POST /v1/diagnosis/answer`는 questionId+answerDelta를 받는다.
  2. 응답에는 다음 질문 카드 + 업데이트된 ValuePreviewCard가 포함된다.
  3. 이벤트 `DIAGNOSIS_ANSWERED`가 기록되고, answer는 원문 그대로 저장된다(jsonb).

### S-03 결과 화면에서 추천/비교/광고 노출
- Story: 사용자는 추천 1안과 Top3 비교를 보고 파트너를 선택한다.
- AC
  1. `GET /v1/results`는 `RecommendedPartnerCard` + `CompareListTop3`(+optional SponsorCarousel)를 반환한다.
  2. `RESULTS_VIEWED` 이벤트가 기록된다(AB 버킷 포함 가능).
  3. 광고 카드 노출은 반드시 `disclosures`에 sponsored가 포함되고, 라벨은 “광고”로 고정된다.

### S-04 케이스 생성 및 워크스페이스 진입
- Story: 사용자는 파트너를 선택해 케이스를 생성하고, 문서 슬롯을 확인한다.
- AC
  1. `POST /v1/cases` 성공 시 `CASE_CREATED` 이벤트가 기록된다.
  2. 케이스 조회(`GET /v1/cases/{caseId}`)는 문서 슬롯 목록과 상태를 제공한다.

---

## 3) 백로그 운영 규칙(필수)
- 모든 Story는 “이벤트/로그/권한”을 AC에 포함한다(나중에 붙이면 운영이 붕괴).
- 모든 “확정” 액션은 승인게이트/동의 로그를 남긴다.
- “광고/추천”은 데이터 레벨에서 분리(카드 타입/디스클로저로 강제).

## 4) 자동 백로그 산출 규칙 (Pilot Gate)
운영 효율화를 위해 `pilot_gate_evidence` 검증 실패 데이터를 기반으로 매일 자동으로 백로그 후보(스프린트 이슈 티켓 초안)를 생성합니다. (`POST /v1/ops/reports/pilot-gate/backlog` API 활용)

**Severity(심각도) 판별 규칙(고정):**
- **Sev1 (Critical)**: `fail > 0` 이면서 `slot_filing_receipt`(접수증) 누락이 포함된 경우 (가장 치명적인 증거 누락)
- **Sev2 (High)**: `fail > 0` 이면서 서명본(`_signed`로 끝나는 슬롯) 누락이 포함된 경우
- **Sev3 (Medium)**: 그 외 (기타 필수 문서 누락 등 경미/간헐적 오류)

**출력 항목 구성:**
- `title`: `[게이트 누락] {slotId} 검증 실패 자동화 대응`
- `severity`: 위 규칙에 따른 1~3
- `impactCount`: 해당 슬롯 누락이 발생한 케이스 수
- `evidenceIds`: 실패 증거 ID 샘플 (최대 3개)
- `sampleCaseIds`: 실패 케이스 ID 샘플 (최대 3개)
- `reproSteps`: 재현 및 디버깅 단계 (자동 생성)
- `acceptanceCriteria`: 해결을 위한 수용 기준 (자동 생성)
