# 엔진(규칙 + AI) 개요 — 무엇을, 어디서, 왜 쓰는가

이 문서는 “UX 화면에서 엔진을 어디에 어떻게 붙일지”를 이해하기 위한 개발용 개요입니다.  
세부 호출 지점/출력은 `spec_engine_orchestration.yaml`을 단일 소스로 봅니다.

---

## 1) 엔진은 2종류가 있다

### A. 규칙 엔진(Rules)
설명 가능하고 재현 가능한 영역을 담당합니다.

- 사건팩 분기/체크리스트/서류 슬롯/상태/SLA
- 리스크/뎁스 산출(수치화)
- 가격 룰(기본가+가산) 계산
- 알림 트리거(마감/SLA/다음 할 일)

### B. AI 엔진(AI)
“불완전 입력”을 정리해주는 영역을 담당합니다.

- 자연어 → 사건팩 후보(업무 라우팅)
- 업로드 문서 → 슬롯 분류/불일치 후보/보완 포인트(초안)
- 메시지 초안 생성(승인 게이트 필수)

원칙: AI는 **확정 권한이 없다**. 항상 “추천/초안/경고”까지만.

---

## 2) 핵심 엔진 구성(권장 7개)

1. **intent_router (AI)**  
   - 자연어 1줄 → 사건팩 후보(1~3개) + 최소 질문(3~7개)

2. **casepack_rule_engine (Rules)**  
   - 사건팩 + 입력값 → 분기 적용, 서류/체크리스트/리스크/뎁스 산출

3. **partner_search_ranker (Hybrid)**  
   - 필터링(역량/지역/가용성) + 정렬(SLA/품질/가격)  
   - 스폰서(광고)는 별도 영역 + 라벨 고정

4. **pricing_engine (Rules)**  
   - 파트너 가격 룰(DSL) 기반 예상 견적 “범위” 산출  
   - 확정은 QUOTE_FINALIZED(승인/동의) 이벤트에서만

5. **eta_engine (Hybrid)**  
   - 사건팩 기본 + 분기 가산 + 파트너 통계/용량 → ETA 범위 산출

6. **doc_review_engine (AI+Rules)**  
   - 업로드 문서 텍스트/OCR → 슬롯 분류, 누락/불일치 후보, 보완 메시지 초안  
   - 메시지 발송은 승인 게이트 필수

7. **notification_engine (Rules)**  
   - 다음 할 일/마감/SLA 브리치 기반 재진입 알림

---

## 3) 엔진이 호출되는 위치(UX 기준 한 줄 요약)

- **Home(모바일)**: intent_router  
- **Mini Diagnosis(모바일)**: casepack_rule_engine (+ 필요 시 pricing/eta 프리뷰)  
- **Results(모바일)**: partner_search_ranker + pricing_engine + eta_engine  
- **Case Workspace(모바일)**: doc_review_engine(on upload) + notification_engine  
- **Partner Console(PC)**: doc_review_engine + pricing_engine(범위) → 사람 확정

---

## 4) 승인 게이트(확정 금지 영역)

승인 게이트는 기술적으로는 “상태 전이 조건 + 감사 로그”입니다.

- AI 보완 메시지 발송: 파트너/운영 승인 필수
- 견적 확정: 파트너(또는 운영) 확정 + 사용자 동의 로그
- 고리스크 케이스: 운영자 수동검토(manual_review) 후 진행

---

## 5) 참고 스펙

- 오케스트레이션 단일 소스: `spec_engine_orchestration.yaml`
- UI 카드/컴포넌트 계약: `spec_ui_components_and_cards.yaml`
- 파트너 프로필/가격 룰: `spec_partner_profile_schema.yaml`, `spec_pricing_rules_dsl.yaml`

