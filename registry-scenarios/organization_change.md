# 등기 시나리오 — 조직변경
- scenarioKey: organization_change
- 등기종류(표준명): 조직변경
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

### 4-2. 케이스 특화(조직변경)
- case.organizationChange.*

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
  "scenarioKey": "organization_change",
  "title": "조직변경",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["조직변경", "조직 변경", "유한회사 전환", "주식회사 전환", "형태 변경"] },
  "questions": [
    {
      "id": "q_from_to",
      "type": "single_choice",
      "text": "어떤 형태로 조직을 변경하나요?",
      "options": ["주식회사 → 유한회사", "유한회사 → 주식회사", "기타", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "변경 전/후 조직형태에 따라 절차와 정관/자본/임원 구조가 달라집니다.",
      "next": "q_governance_complexity"
    },
    {
      "id": "q_governance_complexity",
      "type": "single_choice",
      "text": "주주/사원 구성과 의사결정 구조가 복잡한 편인가요?",
      "options": ["단순", "복잡", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "구성이 복잡하면 정관/지분/의사록 정리와 검토가 늘어납니다.",
      "next": "q_docs_ready"
    },
    {
      "id": "q_docs_ready",
      "type": "single_choice",
      "text": "정관(현행)과 변경안(초안) 준비 상태는 어떤가요?",
      "options": ["준비됨", "준비 필요", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "조직변경은 정관이 핵심 문서이며 변경안 정리가 필요합니다.",
      "next": "q_timing"
    },
    {
      "id": "q_timing",
      "type": "single_choice",
      "text": "언제까지 처리가 필요하신가요?",
      "options": ["긴급(1~2일)", "일반(3~5일)", "여유(1주 이상)"],
      "required": true,
      "depth": 3,
      "why": "조직변경은 준비 기간이 길어질 수 있어 목표 일정 확인이 필요합니다.",
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
      "text": "조직변경 배경/현재 구조 등 특이사항을 적어주세요.",
      "required": false,
      "next": null
    }
  ],
  "previewBase": {
    "minPrice": 800000,
    "maxPrice": 1800000,
    "etaDays": 14,
    "requiredDocs": ["정관(현행/변경안)", "주주총회/사원총회 의사록", "주주/사원 명부"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_from_to", "op": "in", "value": ["기타", "모르겠음"] }], "addMinPrice": 200000, "addMaxPrice": 500000, "addEtaDays": 3 },
    { "when": [{ "questionId": "q_governance_complexity", "op": "in", "value": ["복잡", "모르겠음"] }], "addMinPrice": 150000, "addMaxPrice": 350000, "addEtaDays": 2 },
    { "when": [{ "questionId": "q_docs_ready", "op": "in", "value": ["준비 필요", "모르겠음"] }], "addEtaDays": 3 },
    { "when": [{ "questionId": "q_timing", "op": "eq", "value": "긴급(1~2일)" }], "addMinPrice": 60000, "addMaxPrice": 120000 }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_from_to", "op": "in", "value": ["기타", "모르겠음"] }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "조직변경 유형이 불명확하면 변경 전/후 형태를 특이사항에 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["조직행위"],
    "desiredScenarioKeys": ["organization_change"],
    "preferredTags": ["조직변경"]
  }
}
```
