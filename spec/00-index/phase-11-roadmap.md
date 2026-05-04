# Phase 11: 엔터프라이즈 SaaS 확장 및 팀 협업 고도화 (Enterprise SaaS & Team Collaboration)

## 1. 개요
Phase 10을 통해 파트너 API, 웹훅 딜리버리, 쿼터/사용량 계측 등 "플랫폼으로서의 기반(Platformization & Governance)"을 완성했습니다.
Phase 11에서는 단일 파트너(개인)가 아닌 **대규모 엔터프라이즈 파트너(법무법인, 회계법인 등)**가 팀 단위로 AgentRegi를 도입하여 SaaS처럼 사용할 수 있도록 **조직/팀 워크스페이스 구조, RBAC(Role-Based Access Control), 커스텀 템플릿, SLA 모니터링 고도화**를 구축합니다.

## 2. 주요 목표
1. **엔터프라이즈 조직 및 팀 워크스페이스 구축 (Team & Workspace)**
   - 기존 `partnerId` 단일 구조를 `Organization(조직) -> Workspace(팀/부서) -> Member(구성원)` 구조로 확장.
   - 케이스 배정(Assignment) 및 팀 내 협업(내부 코멘트, 멘션) 기능 도입.

2. **세분화된 역할 기반 접근 제어 (Advanced RBAC)**
   - 파트너 조직 내 Owner, Admin, Member, Viewer 등 커스텀 역할 생성 및 권한 위임.
   - 특정 케이스나 민감한 서류에 대한 열람 권한(Access Policy) 제어.

3. **엔터프라이즈 커스텀 템플릿 및 자동화 룰 (Custom Templates & Rules)**
   - 파트너가 자체적인 서류 요청 양식, 견적서 템플릿, 고객 응대 템플릿을 생성/관리.
   - 특정 조건(예: 고액 사건, 특정 지역)에 따라 자동으로 특정 멤버에게 배정되는 Rule Engine 도입.

4. **엔터프라이즈 SLA 및 리포팅 대시보드 (Enterprise Analytics)**
   - 파트너 콘솔 내에 팀원별 처리 속도, 고객 만족도(CSAT), 매출 기여도를 분석하는 통계 대시보드 신설.
   - 데이터 내보내기(CSV/Excel) 및 주기적 이메일 리포트 발송.

## 3. 세부 마일스톤 (Milestones)

### 3.1 Milestone 11-1: 조직 및 워크스페이스 구조 개편
- Firestore 데이터 모델 마이그레이션 (`organizations`, `workspaces` 컬렉션 도입).
- `partner-console`에 조직 관리(Organization Settings) 탭 추가 및 부서/팀 생성 기능.
- 초대 링크(Invite Link) 기반의 팀원 온보딩 플로우 고도화.

### 3.2 Milestone 11-2: 엔터프라이즈 RBAC 및 케이스 할당
- 파트너 멤버별 권한 매트릭스(Permission Matrix) 구현 및 미들웨어 적용.
- 케이스 워크보드에 "담당자(Assignee)" 지정 기능 추가.
- 담당자 변경 시 내부 알림(In-app Notification) 및 감사 로그(Audit Log) 기록.

### 3.3 Milestone 11-3: 커스텀 템플릿 시스템
- 파트너 콘솔에 "템플릿 관리(Template Manager)" 메뉴 신설.
- JSON 기반의 동적 폼 빌더를 통해 고객에게 요청할 커스텀 서류 양식 생성.
- 케이스 생성 시 파트너가 정의한 커스텀 템플릿을 선택하여 적용하는 로직 구현.

### 3.4 Milestone 11-4: 엔터프라이즈 애널리틱스
- `partner-console` 대시보드 홈 개편 (팀원별 퍼포먼스 차트, SLA 위반 위협 케이스 하이라이트).
- 매출 및 처리 건수에 대한 기간별(Daily/Weekly/Monthly) 집계 파이프라인.

## 4. 기대 효과
이 페이즈가 완료되면 AgentRegi는 단순한 중개/단건 처리 플랫폼을 넘어, 대형 파트너사들이 자체 업무 시스템으로 활용할 수 있는 **완전한 B2B Enterprise SaaS**로 진화합니다. 이는 파트너 락인(Lock-in) 효과를 극대화하고 구독형(SaaS) 매출 모델을 안착시키는 핵심 원동력이 됩니다.
