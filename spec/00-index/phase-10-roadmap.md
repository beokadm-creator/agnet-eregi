# Phase 10: 플랫폼 제품화 및 운영 표준화 (Platformization & Governance)

## 1. 개요
Phase 9에서 AI 기반 서류 자동 검증(OCR/Vision)과 파트너 Open API/API Key, 멀티채널 알림의 기반을 마련했습니다.  
Phase 10에서는 이를 “프로덕션 운영 가능한 파트너 플랫폼”으로 끌어올리기 위해 인증/권한, 이벤트 스키마/버전 정책, 재시도/감사/모니터링, 사용량 과금/쿼터 등 **거버넌스와 운영 표준**을 정립합니다.

## 2. 주요 목표
1. **Partner Auth 제품화 (OAuth2 + Scope + Key Rotation)**
   - Partner API Key 발급/회수/회전(Rotation) 및 마지막 사용 시각(lastUsedAt) 기록.
   - OAuth 2.0(Client Credentials) 기반 토큰 발급(스코프 포함)과 API Key 병행 운영 전략 수립.

2. **Webhook Delivery 서비스화 (Retry/Backoff/DLQ/서명)**
   - 이벤트 카탈로그(eventType) 및 페이로드 스키마 버전(version) 정책 확정.
   - 재시도 큐(Cloud Tasks) + 지수 백오프 + DLQ(Dead Letter Queue) + 재전송 UI.
   - HMAC 서명 및 timestamp/nonce 기반 재전송 방지.

3. **사용량 계측 및 레이트리밋/쿼터 (Metering & Quota)**
   - 파트너 API 호출/웹훅 딜리버리/AI OCR 사용량 메트릭 정의.
   - 플랜별 쿼터/레이트리밋 정책과 Ops Console에서의 강제 조정 기능.

4. **운영 관측 고도화 (Observability)**
   - 요청 단위 requestId, partnerId, caseId 기준의 구조적 로그(Structured Logging) 표준화.
   - SLO/에러버짓 기반 알림과 장애 대응(runbook) 연계.

## 3. 세부 마일스톤 (Milestones)

### 3.1 Milestone 10-1: Partner Auth 제품화
- `api_keys`를 평문 저장하지 않고 해시 저장(예: SHA-256) + prefix 표시.
- API Key 회수(revoke), 회전(rotate), 마지막 사용 기록(lastUsedAt) 구현.
- OAuth2(Client Credentials) 토큰 발급 엔드포인트 도입 및 scope 설계(`cases:read`, `cases:write`, `webhooks:manage` 등).

### 3.2 Milestone 10-2: Webhook Delivery 서비스화
- 이벤트 카탈로그 및 페이로드 스키마 버전 규격 정의.
- 전송 실패 시 Cloud Tasks 재시도 + DLQ 적재 + 파트너 콘솔 재전송 UI 추가.
- 서명 검증: `X-AgentRegi-Signature`, `X-AgentRegi-Timestamp` 기반.

### 3.3 Milestone 10-3: Metering & Quota
- 파트너별 사용량 테이블(예: `partner_usage_daily`) 및 집계 배치 구축.
- 레이트리밋/쿼터 정책 엔진(환경변수/Firestore 정책 문서 기반) 구현.

### 3.4 Milestone 10-4: Observability 표준화
- 함수/라우트 레벨에서 공통 로깅 유틸 도입(민감정보 마스킹 포함).
- Ops Console에 “Webhook DLQ”, “API Errors”, “OCR Failure Rate” 대시보드 추가.

## 4. 기대 효과
Phase 10이 완료되면 파트너 API/Webhook/AI 자동화가 기능 구현을 넘어 **정책/운영/과금까지 포함한 플랫폼 제품**으로 완성되며, 엔터프라이즈 파트너 온보딩과 안정적 확장(Scale)이 가능해집니다.

