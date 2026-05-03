# 등기 시나리오 — 주식 분할
- scenarioKey: stock_split
- 등기종류(표준명): 주식 분할
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

### 4-2. 케이스 특화(주식 분할)
- case.stockSplit.*

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
  "scenarioKey": "stock_split",
  "title": "주식 분할",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["주식 분할", "주식분할", "액면분할", "주식수 분할"] },
  "questions": [
    {
      "id": "q_ratio_ready",
      "type": "single_choice",
      "text": "분할 비율(예: 1주→10주)이 정해져 있나요?",
      "options": ["예(정해짐)", "아니오(검토 필요)", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "분할 비율은 주식수/정관 변경 산정의 핵심입니다.",
      "next": "q_shareholder_complexity"
    },
    {
      "id": "q_shareholder_complexity",
      "type": "single_choice",
      "text": "주주 수가 많거나 주주 구조가 복잡한 편인가요?",
      "options": ["단순", "복잡", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "주주가 많으면 통지/서류 정리와 일정이 늘어납니다.",
      "next": "q_timing"
    },
    {
      "id": "q_timing",
      "type": "single_choice",
      "text": "언제까지 처리가 필요하신가요?",
      "options": ["긴급(1~2일)", "일반(3~5일)", "여유(1주 이상)"],
      "required": true,
      "depth": 3,
      "why": "긴급 여부는 결의/정관 변경 일정 조정에 영향을 줍니다.",
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
      "text": "분할 비율/목적 등 특이사항을 적어주세요.",
      "required": false,
      "next": null
    }
  ],
  "previewBase": {
    "minPrice": 300000,
    "maxPrice": 700000,
    "etaDays": 6,
    "requiredDocs": ["주주총회 의사록", "정관(현행/변경안)", "주주명부"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_ratio_ready", "op": "in", "value": ["아니오(검토 필요)", "모르겠음"] }], "addEtaDays": 2 },
    { "when": [{ "questionId": "q_shareholder_complexity", "op": "in", "value": ["복잡", "모르겠음"] }], "addMinPrice": 80000, "addMaxPrice": 180000, "addEtaDays": 1 },
    { "when": [{ "questionId": "q_timing", "op": "eq", "value": "긴급(1~2일)" }], "addMinPrice": 50000, "addMaxPrice": 90000 }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["자본·주식"],
    "desiredScenarioKeys": ["stock_split"],
    "preferredTags": []
  }
}
```
