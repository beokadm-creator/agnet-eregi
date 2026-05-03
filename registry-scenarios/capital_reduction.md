# 등기 시나리오 — 자본금 감소
- scenarioKey: capital_reduction
- 등기종류(표준명): 자본금 감소
- 카테고리: 자본·주식
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

### 4-2. 케이스 특화(자본금 감소)
- case.capitalReduction.*

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
  "scenarioKey": "capital_reduction",
  "title": "자본금 감소",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["감자", "자본금 감소", "자본 감소"] },
  "questions": [
    {
      "id": "q_reduction_type",
      "type": "single_choice",
      "text": "어떤 방식의 감자인가요?",
      "options": ["유상감자", "무상감자", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "감자 방식에 따라 채권자보호절차와 실무 난이도가 달라집니다.",
      "next": "q_creditor_notice"
    },
    {
      "id": "q_creditor_notice",
      "type": "single_choice",
      "text": "채권자보호절차(공고/최고) 준비 상태는 어떤가요?",
      "options": ["준비됨", "준비 필요", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "감자 사건은 채권자보호절차 누락 시 일정과 리스크가 크게 커집니다.",
      "next": "q_shareholder_scope"
    },
    {
      "id": "q_shareholder_scope",
      "type": "single_choice",
      "text": "감자 대상 주주 범위는 어떤가요?",
      "options": ["전 주주", "일부 주주", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "일부 주주만 대상이면 이해관계 조정과 서류 구성이 복잡해질 수 있습니다.",
      "next": "q_reduction_scale"
    },
    {
      "id": "q_reduction_scale",
      "type": "single_choice",
      "text": "감자 규모는 어느 정도인가요?",
      "options": ["1천만원 이하", "1천만원~1억원", "1억원 이상"],
      "required": true,
      "depth": 3,
      "why": "규모가 큰 감자는 추가 검토와 공고/정산 절차가 길어질 수 있습니다.",
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
      "text": "특이사항이나 요청사항을 간단히 적어주세요.",
      "required": false,
      "next": null
    }
  ],
  "previewBase": {
    "minPrice": 320000,
    "maxPrice": 650000,
    "etaDays": 7,
    "requiredDocs": ["주주총회 의사록", "채권자보호절차 관련 자료", "주주명부"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_reduction_type", "op": "eq", "value": "유상감자" }], "addMinPrice": 120000, "addMaxPrice": 220000, "addEtaDays": 2 },
    { "when": [{ "questionId": "q_creditor_notice", "op": "in", "value": ["준비 필요", "모르겠음"] }], "addEtaDays": 2 },
    { "when": [{ "questionId": "q_shareholder_scope", "op": "eq", "value": "일부 주주" }], "addMinPrice": 80000, "addMaxPrice": 150000, "addEtaDays": 1 },
    { "when": [{ "questionId": "q_reduction_scale", "op": "eq", "value": "1억원 이상" }], "addMinPrice": 100000, "addMaxPrice": 200000, "addEtaDays": 1 }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_reduction_type", "op": "eq", "value": "모르겠음" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "감자 방식이 '모르겠음'인 경우 현재 계획(유상/무상 여부, 배당/정산 여부 등)을 특이사항에 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["자본·주식"],
    "desiredScenarioKeys": ["capital_reduction"],
    "preferredTags": ["감자"]
  }
}
```
