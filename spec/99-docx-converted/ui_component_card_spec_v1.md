**UI 컴포넌트 & 카드 스펙 v1 (엔진 연동)**

작성일: 2026-04-13

## 1. 목표
- 엔진 출력이 어떤 UI 컴포넌트에 어떻게 표시되는지(데이터 계약)를 고정한다.
- 이탈률을 줄이기 위해 진단 단계부터 ‘비용/시간/준비물’ 가치 프리뷰를 제공한다.
- 선택 피로를 줄이기 위해 결과 화면은 ‘추천 1안 + 비교 Top3’를 기본값으로 한다.
- 신뢰를 위해 ‘광고 라벨 고정’ 및 ‘확정 아님’(AI/견적) 디스클로저를 강제한다.

## 2. 카드 공통 표준(근거/광고/확정여부)
- 확정 아님: AI 검토/견적/ETA는 기본 ‘범위+전제조건’만. 확정은 승인 게이트 이후.
- 근거 표시: 추천 근거 1~3줄 + sourceRefs(사건팩/가격룰/통계) 기록.
- 광고 라벨: 스폰서 영역은 ‘광고’ 라벨을 상시 노출. 숨김 금지.
- 정정 UX: 사용자가 ‘틀림’ 표시 시 해당 항목 잠금 + 수동검토 라우팅.

## 3. 핵심 컴포넌트(모바일 사용자)
- SearchBar → intent_router
- DiagnosisQuestionCard → casepack_rule_engine
- ValuePreviewCard → casepack_rule_engine + pricing/eta(optional)
- RecommendedPartnerCard / CompareListTop3 / SponsorCarousel → partner_search_ranker + pricing_engine + eta_engine
- DocSlotCard + AIReviewCard → doc_review_engine(on upload) + 승인 게이트

## 4. 제공 파일
- spec_ui_components_and_cards.yaml

