# 2주 실행 계획 (기획/개발 병행)

작성일: 2026-04-17  
원칙: **뼈대 먼저(End-to-End 흐름 고정)** → 그 위에 모듈화/디테일을 얹는다.

---

## 0) 현재 상태(요약)
- 엔진: 서류/서명본/자동 전진(draft_filing→filing_submitted) + 자동 완료(filing_submitted→completed) + 제출패키지/리포트 다운로드 + PACKAGE_READY 이벤트까지 연결됨
- 남은 핵심: 파트너 콘솔 UX를 “실사용 작업보드” 형태로 재구성 + 운영/가시성 최소 요건

---

## 1) 이번 스프린트 목표(Deliverables)
1) partner-console “케이스 작업보드” 화면(케이스 처리 동선 1개로 고정)  
2) 모듈 분리(작업보드/문서/서명본/제출/완료) + 테스트 가능한 구조  
3) 파일럿 운영 체크리스트(리스크/모니터링/수동 복구 포인트) 1장

---

## 2) 모듈화 설계(기획 + 개발 동시)

### 2.1 Frontend 모듈(권장)
- `CaseWorkboardPage`
  - `StageHeader` (stage/canAdvance/reasonKo/CTA)
  - `DocsReviewPanel`
  - `DraftFilingPanel` (템플릿 생성/서명본 업로드/누락표)
  - `FilingSubmittedPanel` (접수정보/접수증/자동완료 상태)
  - `CompletionPanel` (다운로드/패키지/리포트)
  - `TimelinePanel` (PACKAGE_READY CTA 포함)

### 2.2 API 접근 레이어(권장)
- `api.ts` (공통 fetch + 에러 처리)
- `useCase(caseId)` / `useWorkflow(caseId)` / `useDocuments(caseId)` / `useTimeline(caseId)`
- “업무 상태 집계” 유틸:
  - `computeMissingSlots(requiredSlots, documents)`
  - `computeSignedEvidenceStatus(...)`

---

## 3) 2주 일정(마일스톤)

### Week 1: “작업보드 뼈대” 고정 + 최소 기능 완주
**D1~D2**
- partner-console 작업보드 레이아웃(섹션 고정)
- stage 헤더: canAdvance/reasonKo/다음 CTA/다운로드 CTA

**D3~D4**
- DraftFilingPanel:
  - 필수 서류/서명본 상태표(누락 0개 목표)
  - 서명본 업로드 UX 개선(현재 데모 플로우를 패널화)
  - 자동 전진 발생 시 UI 배지/토스트

**D5**
- FilingSubmittedPanel:
  - 접수정보 + 접수증 업로드/검토 + 자동완료 상태 표시
  - 완료 시 “다운로드 섹션” 자동 강조(현재 일부 구현 → 정리)

### Week 2: 모듈 분리 + 안정화 + 파일럿 체크
**D6~D7**
- 컴포넌트 분리(파일 구조 정리) + 타입 정리
- API 훅/유틸 정리(중복 제거)

**D8~D9**
- Ops/감사 가시성 개선:
  - 타임라인 핵심 이벤트 필터/배지
  - 오류/재시도 UX(네트워크 실패 시)

**D10**
- 파일럿 운영 체크리스트 문서화(간단)
- “케이스 1건 end-to-end” 리허설 스크립트 정리(누가 무엇을 누르면 되는지)

---

## 4) 리스크 & 대응
- (R1) 문서 슬롯/필수 조건이 케이스 타입 확장 시 급격히 늘어날 수 있음  
  → 이번 스프린트는 corp_officer_change_v1 고정, requiredSlots 계산 로직을 재사용 가능하게 유지
- (R2) 데모 UI 코드가 커지면서 유지보수 비용 증가  
  → Week2에 모듈 분리/훅화 필수

---

## 5) 완료 정의(DoD)
- partner-console에서 “작업보드” 한 화면으로 케이스 완료까지 진행 가능
- 자동 전진/자동 완료가 일어나는 순간 사용자에게 명확히 보임(단계/이벤트/CTA)
- 제출패키지 ZIP에 서명본/현황리포트 포함, 완료 CTA는 항상 노출

