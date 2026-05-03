# 등기 시나리오 — 해산/청산
- scenarioKey: dissolution
- 등기종류(표준명): 해산/청산
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

### 4-2. 케이스 특화(해산/청산)
- case.dissolution.*
- case.liquidation.*

### 4-3. 예외/리스크(있으면 난이도/문서/절차가 바뀜)
- 

### 4-4. 입력값 제약/조합 룰
- 

## 5. 질문 설계(퍼널로 옮길 질문 목록)
### depth 1
- 

### depth 2
- 

### depth 3
- 

## 6. 가격/ETA/서류 산정 규칙(Preview Rules)
- 기본가:
- ETA 기본:
- 가산/감산:
- 필수서류(기본/조건부):

## 7. 파트너 매칭 포인트(PartnerMatch)
- partnerMatch.desiredSpecialties:
- partnerMatch.requireTags:
- 고난도 조건:

## 8. 근거(법령/규정/실무)
- 

## 9. 추가 확인 질문(불확실/추정 포인트)
- 

## 10. Funnel Scenario JSON (ops_funnel_scenarios용)
```json
{
  "schemaVersion": 1,
  "scenarioKey": "dissolution",
  "title": "청산(해산/청산)",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["청산", "해산", "폐업", "정리", "법인 종료"] },
  "questions": [
    {
      "id": "q_dissolution_type",
      "type": "single_choice",
      "text": "어떤 유형의 청산인가요?",
      "options": ["자진 해산", "기타(상담 필요)"],
      "required": true,
      "next": "q_dissolution_scope"
    },
    {
      "id": "q_dissolution_scope",
      "type": "single_choice",
      "text": "어디까지 진행이 필요하신가요?",
      "options": ["해산 등기만", "해산 + 청산종결까지", "모르겠음"],
      "required": true,
      "next": "q_asset_state"
    },
    {
      "id": "q_asset_state",
      "type": "single_choice",
      "text": "미정산 자산/채무/미수금 등이 있나요?",
      "options": ["없음", "있음", "모르겠음"],
      "required": true,
      "next": "q_tax_issue"
    },
    {
      "id": "q_tax_issue",
      "type": "single_choice",
      "text": "세무/정산(신고·체납 등) 이슈 가능성이 있나요?",
      "options": ["없음", "있음", "모르겠음"],
      "required": true,
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
    "minPrice": 300000,
    "maxPrice": 600000,
    "etaDays": 7,
    "requiredDocs": ["주주총회 의사록", "청산인 관련 서류"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_dissolution_type", "op": "eq", "value": "기타(상담 필요)" }], "addEtaDays": 2 },
    { "when": [{ "questionId": "q_dissolution_scope", "op": "in", "value": ["해산 + 청산종결까지", "모르겠음"] }], "addMinPrice": 150000, "addMaxPrice": 250000, "addEtaDays": 3 },
    { "when": [{ "questionId": "q_asset_state", "op": "in", "value": ["있음", "모르겠음"] }], "addMinPrice": 100000, "addMaxPrice": 200000, "addEtaDays": 2 },
    { "when": [{ "questionId": "q_tax_issue", "op": "in", "value": ["있음", "모르겠음"] }], "addMinPrice": 80000, "addMaxPrice": 150000, "addEtaDays": 2, "addDocs": ["세무/정산 관련 추가 확인(필요)"] }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_dissolution_type", "op": "eq", "value": "기타(상담 필요)" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "청산 유형이 '기타'인 경우 현재 상황을 특이사항에 적어주세요."
      },
      {
        "when": [{ "questionId": "q_tax_issue", "op": "eq", "value": "있음" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "세무/정산 이슈가 있는 경우, 특이사항에 간단한 현황을 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["종료·청산"],
    "desiredScenarioKeys": ["dissolution"],
    "preferredTags": []
  }
}
```
