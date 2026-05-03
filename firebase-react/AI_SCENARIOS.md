# AI 개입 지점 & 시나리오 (User / Partner / Ops / Workers)

## 목적

- “AI가 어디에, 어떤 권한으로, 어떤 데이터로 개입하는지”를 한 눈에 파악
- 자연어 입력(유저 챗봇/퍼널)에서 **다음 단계(CTA)** 로 유도되는지 점검
- 등기 케이스(제출/케이스) **사전 등록(미리 생성)** 가능 여부 확인

## 시스템 용어(현재 코드 기준)

- **Funnel Session**: 진단/매칭 퍼널 세션 (`funnel_sessions`)
- **User Submission**: 유저가 파트너 처리 파이프라인으로 넘기는 “제출물” (`user_submissions`)
- **Partner Case**: 파트너 콘솔에서 처리하는 케이스 (`cases`)
- **Evidence**: 증거물/서류 (`evidences`)
- **Ops Incident**: 운영 인시던트 (`ops_incidents`)

## 공통 LLM 엔진

- 엔진: Functions 공통 LLM 엔진이 운영자 설정(GLM) 기반으로 호출
- 설정: `ops_settings/llm` + Secret Manager(`ops_llm_glm_api_key`)

## 1) User (유저 화면) — AI 개입 시나리오

### 1-1. 퍼널(진단/매칭) 자연어 입력 → 다음 단계 유도

- 입력: `POST /v1/funnel/intent` 의 `intentText`
- 진행: 질문(현재는 더미 질문 셋) → 답변 누적 → 결과 페이지로 이동
- AI 보조(추가): `POST /v1/funnel/sessions/:sessionId/ai/suggestions`
  - 생성 내용: 요약/다음 단계/추천 기준/추가 질문
  - 저장 위치: `funnel_sessions/{sessionId}.aiSuggestions`
  - 결과 노출: `GET /v1/funnel/sessions/:sessionId/results` 의 `ai`
  - 입력 컨텍스트: `scenarioKey/scenarioVersion` + `registry_scenario_cards`(등기 시나리오 카드) 포함
  - 시나리오 카드 갱신: `npm run gen:scenario-cards` (repo root의 `registry-scenarios/*.md` 기반)

### 1-2. 제출 상세에서 “현재 상황/다음 액션” 생성

- 트리거: 유저 화면에서 “AI 도우미 생성/갱신” 클릭
- API:
  - `POST /v1/user/submissions/:id/ai/assist` 생성(저장)
  - `GET /v1/user/submissions/:id/ai/assist` 조회
- 저장 위치: `user_submissions/{id}.aiAssist`
- 입력 컨텍스트: `user_submissions.input.funnel.scenarioKey`가 있으면 `registry_scenario_cards`(등기 시나리오 카드) 포함
- 기대 효과:
  - 유저가 현재 해야 할 일을 요약해서 이탈/헷갈림 감소

### 1-3. 유저 챗봇(자연어) → 다음 단계(CTA) 유도

- 트리거: user-web FloatingChatWidget
- API:
  - `POST /v1/chatbot/sessions`
  - `POST /v1/chatbot/sessions/:sessionId/messages`
- 정책:
  - 응답에 항상 CTA 1~3개 포함 (예: `/funnel` 시작, 대시보드로 이동, 제출 상세 확인 등)

## 2) Partner (파트너 콘솔) — AI 개입 시나리오

### 2-1. 증거물 AI 검토(결함/누락/요청 메시지)

- 트리거: 파트너 콘솔에서 증거물 “AI 검토” 클릭
- API: `POST /v1/partner/cases/:caseId/evidences/:evidenceId/ai/review`
- 저장 위치: `evidences/{evidenceId}.aiReview`
- 사용:
  - 결함/누락 항목을 정리
  - 고객에게 보낼 요청 메시지 초안 생성

### 2-2. 워커 기반 자동 후보 생성(needs_review)

- 트리거: evidence.status 가 uploaded → Vision 검증에서 `needs_review` 판정
- 저장 위치: `evidences/{evidenceId}.aiReviewCandidate`
- 정책:
  - 자동 전이/자동 발송은 하지 않음(제안만)

## 3) Ops (운영) — AI 개입 시나리오

### 3-1. 인시던트 AI triage(요약/원인/확인/조치)

- 트리거: Ops 콘솔 인시던트 상세에서 “AI Triage 생성/갱신”
- API: `POST /v1/ops/incidents/:id/ai/triage`
- 저장 위치: `ops_incidents/{id}.aiTriage`

## 4) 등기 케이스 “미리 등록” 가능 여부

현재 코드에는 두 가지 “사전 등록” 경로가 있습니다.

1) **User Submission을 draft로 미리 생성**
- API: `POST /v1/user/submissions` with `submitNow=false`
- 의미: 유저가 나중에 제출할 건을 “임시저장(draft)”로 보관
- 이후: `POST /v1/user/submissions/:id/submit` 으로 제출 확정

2) **Case를 직접 생성**
- API: `POST /v1/cases`
- 의미: 케이스를 즉시 생성(유저/파트너 관점 혼합 구조)

권장 방향(일원화):
- “유저 등기 흐름”은 `user_submissions` 중심으로 유지하고,
- `cases`는 워커가 파트너 처리 파이프라인에 들어갈 때 생성하는 구조로 두는 편이 단순합니다.

## 5) 최소 검증 체크리스트(프로덕션)

- 퍼널
  - `/funnel`에서 자연어 intent 입력 → 세션 생성 → 결과 페이지 진입
  - 결과 페이지에서 “AI 추천 생성” 클릭 → 추천 노출 확인
- 제출
  - 퍼널 결과에서 파트너 선택 → submission 생성되고 `/submissions/:id`로 이동
  - 제출 상세에서 “AI 도우미 생성” 클릭 → 요약/다음 액션 노출 확인
- 챗봇
  - 챗봇에 “등기 진행하고 싶어요” 입력 → 답변 + 다음 단계(CTA: /funnel 안내 등) 포함 확인
- 파트너
  - Evidence 업로드 → 상세에서 “AI 검토” 클릭 → AI 검토 노출 확인
- 운영
  - 인시던트 상세에서 “AI Triage 생성/갱신” 클릭 → triage 노출 확인
