# AI 이벤트 훅(개발용)

AI는 “편의 엔진”이지만, 등기 도메인에서는 사고가 치명적이므로 **이벤트 기반 + 승인 게이트**로만 개입합니다.

## 단일 소스

- AI 이벤트 훅 스펙(YAML): [`../../spec_ai_event_hooks.yaml`](../../spec_ai_event_hooks.yaml)

## 훅별 해설(요약)

### 1) AI_INTAKE (CASE_CREATED)
- 목적: 업무(사건팩) 후보 매칭 + 최소 질문 생성 + 초기 비용/ETA 범위 제안
- 사용자 노출: 가능(단, “확정 아님/전제조건” 표준 포함)

### 2) AI_DOC_CLASSIFY (DOCUMENT_UPLOADED)
- 목적: 업로드 파일을 문서 슬롯으로 분류 + 누락 슬롯 갱신
- 사용자 노출: 가능(사용자 정정 UX 필수)

### 3) AI_DOC_REVIEW (DOCUMENT_REVIEW_REQUESTED)
- 목적: 불일치 후보/보완 포인트 추천 + 보완요청 메시지 초안
- 사용자 노출: **승인 후만**(자동 발송 금지)

### 4) AI_QUOTE_ETA (QUOTE_REQUESTED)
- 목적: 사건팩+통계+큐 기반 비용/시간 범위 산정
- 사용자 노출: 운영 승인 후(확정은 QUOTE_FINALIZED에서)

### 5) AI_MESSAGE_ASSIST (MESSAGE_DRAFT_REQUESTED)
- 목적: 고객/파트너 메시지 초안(톤/고지 포함)
- 사용자 노출: 발송 전 승인 필수

### 6) AI_RISK_ESCALATION (RISK_FLAGGED)
- 목적: 고리스크 수동 검토 라우팅 + 이유 요약
- 사용자 노출: 기본 비노출(내부 운영용)

