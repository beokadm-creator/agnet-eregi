# UI 컴포넌트 & 카드 계약(개발용)

## 단일 소스

- UI 컴포넌트/카드 스펙(YAML): [`../../spec_ui_components_and_cards.yaml`](../../spec_ui_components_and_cards.yaml)

## 핵심 원칙(반드시 지켜야 이탈이 줄어듦)

1. **진단 단계부터 가치 선제공**: `ValuePreviewCard`는 기본 탑재(비용/시간/준비물).
2. **선택 피로 최소화**: 결과는 `RecommendedPartnerCard(1)` + `CompareListTop3`가 기본.
3. **신뢰 표준**:
   - AI/견적/ETA는 “확정 아님” 디스클로저를 기본 포함
   - 스폰서(광고)는 라벨 고정(숨김 금지)
   - 추천 근거 1~3줄 + sourceRefs를 카드에 포함
4. **승인 게이트**:
   - AI 메시지 발송은 파트너/운영 승인 후만 가능
   - 견적 확정은 사람 확정 + 사용자 동의 로그

## 컴포넌트 목록(요약)

- Home: `SearchBar`, `CategoryChips`
- Mini Diagnosis: `DiagnosisQuestionCard`, `ValuePreviewCard`
- Results: `RecommendedPartnerCard`, `CompareListTop3`, `SponsorCarousel`
- Partner Detail: `PartnerDetailHeader`(+ MapCard)
- Case: `CaseWorkspaceTabs`, `DocSlotCard`, `AIReviewCard`

