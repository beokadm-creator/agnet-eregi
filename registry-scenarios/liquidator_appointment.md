# 등기 시나리오 — 청산인 선임
- scenarioKey: liquidator_appointment
- 등기종류(표준명): 청산인 선임
- 카테고리: 종료·청산
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

### 4-2. 케이스 특화(청산인 선임)
- case.liquidatorAppointment.*

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
  "scenarioKey": "liquidator_appointment",
  "title": "청산인 선임",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["청산인 선임", "청산인 등록", "청산인 변경"] },
  "questions": [
    {
      "id": "q_liquidator_count",
      "type": "single_choice",
      "text": "청산인은 몇 명 선임되나요?",
      "options": ["1명", "2명 이상", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "청산인 수에 따라 의사결정/서류 정리와 공고 방식이 달라질 수 있습니다.",
      "next": "q_liquidator_internal"
    },
    {
      "id": "q_liquidator_internal",
      "type": "single_choice",
      "text": "청산인은 내부 임원/주주인가요, 외부 인사인가요?",
      "options": ["내부 인사", "외부 인사", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "외부 인사면 인감/취임 관련 추가 확인이 필요할 수 있습니다.",
      "next": "q_liquidator_docs_ready"
    },
    {
      "id": "q_liquidator_docs_ready",
      "type": "single_choice",
      "text": "청산인 취임 관련 서류는 준비되어 있나요?",
      "options": ["준비됨", "준비 필요", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "취임승낙/인감/인적사항 자료 누락은 보정의 주요 원인입니다.",
      "next": "q_liquidator_timing"
    },
    {
      "id": "q_liquidator_timing",
      "type": "single_choice",
      "text": "언제까지 처리가 필요하신가요?",
      "options": ["긴급(1~2일)", "일반(3~5일)", "여유(1주 이상)"],
      "required": true,
      "depth": 3,
      "why": "긴급 여부는 파트너 배정과 우선순위 판단에 영향을 줍니다.",
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
    "minPrice": 220000,
    "maxPrice": 420000,
    "etaDays": 4,
    "requiredDocs": ["청산인 선임 결의서류", "취임승낙서", "인적사항 자료"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_liquidator_count", "op": "eq", "value": "2명 이상" }], "addMinPrice": 60000, "addMaxPrice": 120000, "addEtaDays": 1 },
    { "when": [{ "questionId": "q_liquidator_internal", "op": "eq", "value": "외부 인사" }], "addMinPrice": 50000, "addMaxPrice": 90000 },
    { "when": [{ "questionId": "q_liquidator_docs_ready", "op": "in", "value": ["준비 필요", "모르겠음"] }], "addEtaDays": 1 },
    { "when": [{ "questionId": "q_liquidator_timing", "op": "eq", "value": "긴급(1~2일)" }], "addMinPrice": 40000, "addMaxPrice": 70000 }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_liquidator_internal", "op": "eq", "value": "모르겠음" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "청산인 후보 구성이 불명확하면 내부/외부 후보 상황을 특이사항에 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["종료·청산"],
    "desiredScenarioKeys": ["liquidator_appointment"],
    "preferredTags": ["청산인"]
  }
}
```
