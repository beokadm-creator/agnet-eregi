# 오케스트레이션(화면/이벤트별 엔진 호출) — 단일 소스 안내

본 폴더의 오케스트레이션 단일 소스는 아래 YAML입니다.

- `spec_engine_orchestration.yaml`

이 파일은 다음을 포함합니다.

## 1) 엔진 정의
- intent_router / casepack_rule_engine / pricing_engine / eta_engine / partner_search_ranker / doc_review_engine / notification_engine

## 2) UI 연동
- 모바일: Home → MiniDiagnosis → Results → PartnerDetail → CaseWorkspace
- PC: Partner Console, Ops Console

## 3) 승인 게이트
- message_send / quote_finalize / high_risk_case

## 4) 개발 시 권장 구현 방식

### A. 프론트(모바일)
- 화면 전이/카드 렌더링은 **엔진 출력(JSON) 기반**으로만 수행
- “확정”은 버튼 클릭 이벤트가 만들어내는 별도 이벤트로 취급(승인/동의 로그)

### B. 백엔드(엔진)
- 규칙 엔진은 결정적(deterministic)이어야 함(같은 입력 → 같은 출력)
- AI 엔진은 모든 출력에 `confidence`, `sourceRefs`, `disclosures`를 포함
- 모든 엔진 호출은 `requestId`로 추적 가능(감사/분쟁 대응)

