# 등기 시나리오 — 합병
- scenarioKey: merger
- 등기종류(표준명): 합병
- 카테고리: 조직행위
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

### 4-2. 케이스 특화(합병)
- case.merger.*

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
  "scenarioKey": "merger",
  "title": "합병",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["합병", "흡수합병", "신설합병", "회사 합병"] },
  "questions": [
    {
      "id": "q_merger_type",
      "type": "single_choice",
      "text": "어떤 유형의 합병인가요?",
      "options": ["흡수합병", "신설합병", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "흡수/신설 합병에 따라 절차, 자본/주주 구조, 등기 범위가 달라집니다.",
      "next": "q_company_count"
    },
    {
      "id": "q_company_count",
      "type": "single_choice",
      "text": "합병에 참여하는 회사 수는 몇 개인가요?",
      "options": ["2개", "3개 이상", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "참여 회사가 많을수록 합병계약/부속서류와 일정이 증가합니다.",
      "next": "q_creditor_procedure_ready"
    },
    {
      "id": "q_creditor_procedure_ready",
      "type": "single_choice",
      "text": "채권자보호절차(공고/최고) 준비가 되어 있나요?",
      "options": ["준비됨", "준비 필요", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "합병 사건은 채권자보호절차가 핵심이며 기간에 큰 영향을 줍니다.",
      "next": "q_complexity"
    },
    {
      "id": "q_complexity",
      "type": "single_choice",
      "text": "자산/계약/인력 이관이 복잡한 편인가요?",
      "options": ["단순", "복잡", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "이관이 복잡하면 합병 조건 검토와 문서 정리가 늘어납니다.",
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
      "text": "합병 배경/대상 회사/일정 등 특이사항을 적어주세요.",
      "required": false,
      "next": null
    }
  ],
  "previewBase": {
    "minPrice": 1500000,
    "maxPrice": 3200000,
    "etaDays": 25,
    "requiredDocs": ["합병계약서(초안)", "주주총회 의사록", "채권자보호절차 관련 자료"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_merger_type", "op": "in", "value": ["신설합병", "모르겠음"] }], "addMinPrice": 300000, "addMaxPrice": 800000, "addEtaDays": 4 },
    { "when": [{ "questionId": "q_company_count", "op": "in", "value": ["3개 이상", "모르겠음"] }], "addMinPrice": 250000, "addMaxPrice": 700000, "addEtaDays": 3 },
    { "when": [{ "questionId": "q_creditor_procedure_ready", "op": "in", "value": ["준비 필요", "모르겠음"] }], "addEtaDays": 5 },
    { "when": [{ "questionId": "q_complexity", "op": "in", "value": ["복잡", "모르겠음"] }], "addMinPrice": 200000, "addMaxPrice": 500000, "addEtaDays": 3 }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_merger_type", "op": "eq", "value": "모르겠음" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "합병 유형이 불명확하면 흡수/신설 여부와 대상 회사를 특이사항에 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["조직행위"],
    "desiredScenarioKeys": ["merger"],
    "preferredTags": ["합병"]
  }
}
```
