# Phase 9: 지능형 자동화 및 파트너 확장 (Intelligent Automation & Partner Ecosystem)

## 1. 개요
Phase 8까지 시스템의 성능, 테스트, 보안 등 프로덕션 레벨의 인프라 구축(Scale & Maturity)을 완수했습니다.
Phase 9에서는 본격적으로 AI 및 외부 시스템 연동을 통한 **지능형 서류 검증(AI OCR/Vision)**과 파트너 생태계 확장을 위한 **파트너 오픈 API 및 Webhook 고도화**를 목표로 합니다.

## 2. 주요 목표
1. **AI 기반 서류 자동 검증 (Intelligent Document Processing)**
   - 사용자가 업로드한 증빙 서류(사업자등록증, 신분증 사본 등)를 AI(Google Cloud Vision API 또는 Document AI)를 통해 자동 판독.
   - 필수 기재 항목(이름, 등록번호, 발급일자 등) 누락 여부를 실시간으로 체크하여 사용자에게 즉각적인 피드백 제공 (수동 검토 리소스 대폭 절감).

2. **파트너 오픈 API 및 연동 생태계 구축 (Partner Ecosystem)**
   - 대형 파트너사(회계법인, 법무법인 등)가 자체 ERP/CRM과 AgentRegi를 연동할 수 있도록 **Public API Key 발급 및 OAuth 2.0 기반 인증** 도입.
   - 사건 접수, 서류 보완 요청, 결제 완료 등의 주요 이벤트를 파트너사 시스템으로 실시간 전송하는 **고급 Webhook 시스템 (재시도 로직, 서명 검증 포함)** 구축.

3. **고급 알림 및 커뮤니케이션 채널 (Advanced Notifications)**
   - 기존의 단순 로그/Slack 알림을 넘어, 사용자(고객)에게 카카오 알림톡, SMS, 이메일로 케이스 진행 상황을 자동 발송하는 멀티채널 알림 시스템.
   - 템플릿 기반의 알림 발송 로직(Sendgrid, Twilio 연동).

## 3. 세부 마일스톤 (Milestones)

### 3.1 Milestone 9-1: AI 서류 검증 파이프라인
- `functions/src/lib/vision.ts` 구현: GCP Vision API 연동.
- 서류 업로드 시 백그라운드 Trigger(`onDocumentCreated`)로 OCR을 수행하고 `evidenceRequests` 상태를 자동 업데이트.
- 판독 실패 시에만 파트너/운영자의 수동 검토 큐(Manual Review Queue)로 폴백(Fallback).

### 3.2 Milestone 9-2: 파트너 Open API 및 Webhook 고도화
- 파트너 콘솔 내 "개발자 설정(Developer Settings)" 메뉴 추가 (API Key 발급, Webhook Endpoint 관리).
- Webhook 발송 실패 시 지수 백오프(Exponential Backoff) 기반의 재시도(Retry) 큐 시스템(Cloud Tasks) 구현.
- 파트너 API 전용 Rate Limiting 미들웨어 도입.

### 3.3 Milestone 9-3: 멀티채널 고객 알림 시스템
- 케이스 상태(Draft -> Pending -> In Progress -> Completed) 변경 시 알림 이벤트 발행.
- 이메일(Sendgrid) 및 SMS(Twilio) 전송 모듈(`functions/src/lib/notifications.ts`) 구축.

## 4. 기대 효과
이 페이즈가 완료되면 수동으로 진행되던 서류 검토 작업이 AI를 통해 대폭 자동화되어 **건당 처리 비용(Unit Cost)이 극적으로 감소**합니다. 또한 파트너사들이 자체 시스템과 연동할 수 있게 되어 **엔터프라이즈 B2B 고객 유치**가 훨씬 수월해집니다.
