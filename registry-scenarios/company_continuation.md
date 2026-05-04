# 등기 시나리오 — 회사계속
- scenarioKey: company_continuation
- 등기종류(표준명): 회사계속
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

### 4-2. 케이스 특화(회사계속)
- case.companyContinuation.*

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
  "scenarioKey": "company_continuation",
  "title": "회사계속",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["회사계속", "해산취소", "계속등기"] },
  "questions": [
    {
      "id": "q_continuation_reason",
      "type": "single_choice",
      "text": "회사계속이 필요한 배경은 어떤가요?",
      "options": ["해산 후 사업 재개", "청산 진행 중 계속", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "해산 상태와 청산 진행 정도에 따라 계속 가능성 및 절차가 달라집니다.",
      "next": "q_liquidation_progress"
    },
    {
      "id": "q_liquidation_progress",
      "type": "single_choice",
      "text": "청산 절차는 어느 정도 진행됐나요?",
      "options": ["거의 진행 안 됨", "일부 진행됨", "많이 진행됨", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "청산 진행 정도는 계속 결의 가능성과 추가 정리 범위를 판단하는 기준입니다.",
      "next": "q_creditor_issue"
    },
    {
      "id": "q_creditor_issue",
      "type": "single_choice",
      "text": "채권자/채무 관계 정리 이슈가 있나요?",
      "options": ["없음", "있음", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "채권자 관계는 회사계속 시 법률 리스크와 실무 난이도를 높입니다.",
      "next": "q_continuation_urgency"
    },
    {
      "id": "q_continuation_urgency",
      "type": "single_choice",
      "text": "언제까지 처리가 필요하신가요?",
      "options": ["긴급(1~2일)", "일반(3~5일)", "여유(1주 이상)"],
      "required": true,
      "depth": 3,
      "why": "긴급 여부는 자료 정리와 파트너 배정 우선순위에 영향을 줍니다.",
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
    "maxPrice": 700000,
    "etaDays": 6,
    "requiredDocs": ["회사계속 결의서류", "기존 해산/청산 관련 자료"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_liquidation_progress", "op": "in", "value": ["많이 진행됨", "모르겠음"] }], "addMinPrice": 120000, "addMaxPrice": 220000, "addEtaDays": 2 },
    { "when": [{ "questionId": "q_creditor_issue", "op": "in", "value": ["있음", "모르겠음"] }], "addMinPrice": 100000, "addMaxPrice": 180000, "addEtaDays": 2, "addDocs": ["채권자/채무 관계 추가 확인자료"] },
    { "when": [{ "questionId": "q_continuation_urgency", "op": "eq", "value": "긴급(1~2일)" }], "addMinPrice": 50000, "addMaxPrice": 90000 }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_continuation_reason", "op": "eq", "value": "모르겠음" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "회사계속 배경이 불명확하면 현재 해산 상태와 재개 이유를 특이사항에 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["종료·청산"],
    "desiredScenarioKeys": ["company_continuation"],
    "preferredTags": ["회사계속"]
  }
}
```
