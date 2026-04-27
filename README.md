# AgentRegi Platform (법률/행정 서비스 중개 및 자동화 플랫폼)

AgentRegi는 사용자의 법률/행정/등기 사건을 파트너(전문가)와 매칭하고, 필요한 서류 수집부터 관공서 제출(E-Filing)까지 전 과정을 End-to-End로 자동화 및 관리하는 대규모 플랫폼입니다. 본 저장소는 B2C 사용자, B2B 파트너(엔터프라이즈 포함), 내부 운영자를 위한 시스템 및 백엔드 인프라를 모두 포함하는 **Monorepo**로 구성되어 있습니다.

## 🚀 프로젝트 성과 요약 (Phase 11 최종 완료)

초기 MVP 모델부터 대규모 엔터프라이즈 SaaS 확장까지 총 11개의 릴리즈 페이즈(Phase)를 거쳐 개발이 완료되었습니다.

1. **Phase 0~4 (MVP & 운영 기반)**
   - 이벤트 기반(Event-Driven) 아키텍처 및 안전한 감사 로그(Audit Log) 구축.
   - 사용자 퍼널(진단/추천)부터 결제, 환불, 파트너 정산까지의 핵심 라이프사이클 구현.
   - 세밀한 RBAC(역할 기반 접근 제어) 및 Firestore RLS(보안 규칙) 적용 완료.
2. **Phase 5~6 (지능화 & 초자동화)**
   - AI 기반 서류 자동 판독(Document AI) 및 결함 사전 차단.
   - 카카오톡, Slack, SMS 옴니채널 알림 및 딥링크 지원.
   - B2G(정부24, 대법원 등) 전자신청 패키지 자동 전송 및 공과금 자동 납부.
3. **Phase 7~9 (글로벌 확장 & AI 고도화)**
   - 외부 시스템 연동을 위한 B2B Open API 구축 및 다국어(i18n)/다중 통화(Stripe) 지원.
   - 24/7 AI CS 챗봇 및 파트너용 AI 어시스턴트 도입.
   - 재시도/백오프 로직이 포함된 고급 Webhook 발송 시스템 구축.
4. **Phase 10~11 (플랫폼 제품화 & 엔터프라이즈 SaaS)**
   - 엔터프라이즈 고객을 위한 조직(Organization) > 워크스페이스(Workspace) > 멤버(Member) 계층화 및 Advanced RBAC.
   - 파트너별 API Key 관리, OAuth2 (Client Credentials), Rate Limiting 및 사용량 계측(Metering/Quota).
   - 커스텀 서류 템플릿, 자동화 룰(배정 등) 및 SLA/매출 분석 리포팅 대시보드 구축.
   - Observability 표준화(구조적 로그, SLO, 에러버짓, 대시보드).

## 🏗 아키텍처 및 폴더 구조 (Monorepo)

본 프로젝트는 `npm workspaces`를 활용한 모노레포 구조로 설계되었으며, 핵심 기술 스택으로 **React, TypeScript, Vite, Tailwind CSS, Firebase (Firestore, Functions, Auth)** 를 사용합니다.

```text
/firebase-react
├── apps/
│   ├── user-web/          # 사용자(B2C) 웹 애플리케이션 (퍼널, 진단, 결제)
│   ├── partner-console/   # 파트너(B2B) 콘솔 (케이스 관리, 서류 검토, 워크스페이스, API 설정)
│   └── ops-console/       # 내부 운영(Ops) 콘솔 (모니터링, SLA 브리치 관리, 정산, 고객 지원)
├── functions/             # Firebase Cloud Functions 백엔드 (API, 워커, Webhook, B2G, AI 연동 등)
└── packages/
    ├── firebase/          # 공통 Firebase 초기화 및 유틸리티
    └── ui-components/     # 공통 UI 컴포넌트 라이브러리
```

## 🛠 주요 기술 스택
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Playwright (E2E Test)
- **Backend**: Node.js, Firebase Cloud Functions (Gen 2)
- **Database**: Cloud Firestore (NoSQL, 보안 규칙 기반 RLS 적용)
- **Authentication**: Firebase Auth (Magic Link, 카카오 로그인 등 지원)
- **Integrations**: TossPayments / Stripe (결제), Twilio / SendGrid / Slack / 카카오 알림톡 (알림), OpenAI / Google Cloud Vision (AI/OCR)
- **CI/CD & Ops**: GitHub Actions, Firebase Hosting

## 💻 실행 방법 (Local Development)

### 필수 요구사항
- Node.js (v20+ 권장)
- Firebase CLI (`npm install -g firebase-tools`)

### 설치 및 로컬 에뮬레이터 실행
```bash
# 의존성 설치
npm install

# Firebase 로컬 에뮬레이터 실행 (Firestore, Auth, Functions)
npm run emulators

# 개별 앱 개발 서버 실행 (새로운 터미널에서 각각 실행)
npm run dev:user     # 사용자 웹
npm run dev:partner  # 파트너 콘솔
npm run dev:ops      # 운영자 콘솔
```

## 🧪 테스트 실행

```bash
# 전체 워크스페이스 린트 및 빌드
npm run lint
npm run build

# Playwright E2E 테스트 실행 (예: 파트너 콘솔)
cd firebase-react/apps/partner-console
npx playwright test
```

## 📄 문서화 (Specifications)

기획 및 아키텍처 상세 설계, Phase별 마일스톤 등은 `spec/` 폴더 내에 마크다운 문서로 체계적으로 관리되고 있습니다.
- [로드맵 및 백로그](./spec/00-index/roadmap-and-backlog.md)
- [Phase 11 상세 스펙](./spec/00-index/phase-11-roadmap.md)
