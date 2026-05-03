# 등기 시나리오 — 현물출자
- scenarioKey: in_kind_contribution
- 등기종류(표준명): 현물출자
- 카테고리: 특수
- 버전: v1
- 상태: draft
- 작성자/작성일:
- 참고 링크:
  - https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EC%83%81%EB%B2%95
  - https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EC%83%81%EC%97%85%EB%93%B1%EA%B8%B0%EB%B2%95
  - https://www.law.go.kr/lsInfoP.do?lsiSeq=160002
  - https://www.iros.go.kr/

## 0. 한줄 요약
- 

## 1. 범위
### 1-1. 포함
- 
### 1-2. 제외
- 
### 1-3. 유사 케이스 구분 기준
- 

## 2. 결과물(필수 산출물)
### 2-1. 기본
- 
### 2-2. 조건부
- 

## 3. 프로세스(실무 단계)
- Step 1:
- Step 2:
- Step 3:
- Step 4:
- Step 5:
- Step 6:

## 4. 반드시 수집해야 하는 정보(정규화 필드)
### 4-1. 공통(모든 등기 공통)
- corp.*
- stakeholders.*
- process.*
- risk.*

### 4-2. 케이스 특화(현물출자)
- case.inKindContribution.*

### 4-3. 예외/리스크
- 

### 4-4. 입력값 제약/조합 룰
- 

## 5. 질문 설계(퍼널)
### depth 1
- 
### depth 2
- 
### depth 3
- 

## 6. Preview Rules(가격/ETA/서류)
- 

## 7. PartnerMatch
- 

## 8. 근거
- 

## 9. 추가 확인 질문
- 

## 10. Funnel Scenario JSON (ops_funnel_scenarios용)
```json
{
  "schemaVersion": 1,
  "scenarioKey": "in_kind_contribution",
  "title": "현물출자",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["현물출자", "부동산 현물출자", "특허 현물출자", "자산 출자"] },
  "questions": [
    {
      "id": "q_asset_type",
      "type": "single_choice",
      "text": "현물출자 자산 유형은 무엇인가요?",
      "options": ["부동산", "동산/재고", "지식재산권(특허/상표 등)", "기타", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "자산 유형에 따라 감정/평가/등기 연계(부동산 등) 절차가 달라집니다.",
      "next": "q_valuation_ready"
    },
    {
      "id": "q_valuation_ready",
      "type": "single_choice",
      "text": "가액 산정/감정평가 준비 상태는 어떤가요?",
      "options": ["준비됨", "준비 필요", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "현물출자는 가액 산정이 핵심이며, 누락 시 보정/반려 위험이 큽니다.",
      "next": "q_contribution_stage"
    },
    {
      "id": "q_contribution_stage",
      "type": "single_choice",
      "text": "현물출자가 어떤 상황에서 발생하나요?",
      "options": ["설립 시", "증자(신주발행) 시", "기타", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "설립/증자에 따라 결의 문서와 첨부서류가 달라집니다.",
      "next": "q_stakeholders_complexity"
    },
    {
      "id": "q_stakeholders_complexity",
      "type": "single_choice",
      "text": "출자자/이해관계자가 복수인가요?",
      "options": ["단일", "복수", "모르겠음"],
      "required": true,
      "depth": 3,
      "why": "이해관계자가 많을수록 서명/증빙/권리관계 검토가 늘어납니다.",
      "next": "q_region"
    },
    {
      "id": "q_region",
      "type": "single_choice",
      "text": "어느 지역(관할) 관련 업무인가요?",
      "options": ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "기타"],
      "required": true,
      "next": "q_notes"
    },
    {
      "id": "q_notes",
      "type": "text",
      "text": "자산 종류/가액/권리관계 등 특이사항을 적어주세요.",
      "required": false,
      "next": null
    }
  ],
  "previewBase": {
    "minPrice": 600000,
    "maxPrice": 1400000,
    "etaDays": 10,
    "requiredDocs": ["현물출자 대상 자산 자료", "가액 산정/감정 관련 자료", "결의서류(설립/증자)"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_asset_type", "op": "in", "value": ["부동산", "지식재산권(특허/상표 등)", "기타", "모르겠음"] }], "addMinPrice": 150000, "addMaxPrice": 350000, "addEtaDays": 2 },
    { "when": [{ "questionId": "q_valuation_ready", "op": "in", "value": ["준비 필요", "모르겠음"] }], "addEtaDays": 3 },
    { "when": [{ "questionId": "q_stakeholders_complexity", "op": "in", "value": ["복수", "모르겠음"] }], "addMinPrice": 80000, "addMaxPrice": 160000, "addEtaDays": 1 }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_asset_type", "op": "in", "value": ["기타", "모르겠음"] }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "자산 유형이 불명확하면 자산 종류와 대략 가액을 특이사항에 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["설립"],
    "desiredScenarioKeys": ["in_kind_contribution"],
    "preferredTags": ["현물출자"]
  }
}
```
