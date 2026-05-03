# 등기 시나리오 — 주식매수선택권 관련 변경
- scenarioKey: stock_option
- 등기종류(표준명): 주식매수선택권 관련 변경
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

### 4-2. 케이스 특화(주식매수선택권)
- case.stockOption.*

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
  "scenarioKey": "stock_option",
  "title": "주식매수선택권 관련 변경",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["스톡옵션", "주식매수선택권", "부여", "취소", "행사"] },
  "questions": [
    {
      "id": "q_action",
      "type": "single_choice",
      "text": "어떤 스톡옵션 관련 업무인가요?",
      "options": ["부여", "변경", "취소", "행사(주식 발행) 관련", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "부여/취소/행사 단계에 따라 결의, 계약서, 등기 범위가 달라집니다.",
      "next": "q_recipients"
    },
    {
      "id": "q_recipients",
      "type": "single_choice",
      "text": "부여/대상자는 누구인가요?",
      "options": ["임직원", "외부 자문/기타", "복수", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "대상자 유형과 수에 따라 계약/첨부서류와 리스크가 달라집니다.",
      "next": "q_terms_ready"
    },
    {
      "id": "q_terms_ready",
      "type": "single_choice",
      "text": "행사가격/수량/베스팅 등 조건이 정리되어 있나요?",
      "options": ["예(정리됨)", "아니오(검토 필요)", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "조건 확정이 되어야 결의/계약서/등기 문구를 확정할 수 있습니다.",
      "next": "q_resolution_kind"
    },
    {
      "id": "q_resolution_kind",
      "type": "single_choice",
      "text": "의사결정 방식은 어떤가요?",
      "options": ["주주총회 결의", "이사회 결의", "서면결의/동의", "모르겠음"],
      "required": true,
      "depth": 3,
      "why": "결의기관/방식에 따라 의사록/주주명부 등 첨부서류가 달라집니다.",
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
      "text": "대상자/조건/일정 등 특이사항을 적어주세요.",
      "required": false,
      "next": null
    }
  ],
  "previewBase": {
    "minPrice": 420000,
    "maxPrice": 950000,
    "etaDays": 7,
    "requiredDocs": ["이사회/주주총회 의사록", "스톡옵션 계약서(초안)", "정관(관련 조항)"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_action", "op": "in", "value": ["행사(주식 발행) 관련", "모르겠음"] }], "addMinPrice": 120000, "addMaxPrice": 220000, "addEtaDays": 2 },
    { "when": [{ "questionId": "q_recipients", "op": "in", "value": ["복수", "모르겠음"] }], "addMinPrice": 80000, "addMaxPrice": 160000, "addEtaDays": 1 },
    { "when": [{ "questionId": "q_terms_ready", "op": "in", "value": ["아니오(검토 필요)", "모르겠음"] }], "addEtaDays": 2 },
    { "when": [{ "questionId": "q_resolution_kind", "op": "eq", "value": "주주총회 결의" }], "addDocs": ["주주명부"] }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_terms_ready", "op": "eq", "value": "모르겠음" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "조건이 불명확하면 예상 수량/행사가/일정을 특이사항에 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["자본·주식"],
    "desiredScenarioKeys": ["stock_option"],
    "preferredTags": []
  }
}
```
