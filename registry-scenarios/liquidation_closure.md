# 등기 시나리오 — 청산종결
- scenarioKey: liquidation_closure
- 등기종류(표준명): 청산종결
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

### 4-2. 케이스 특화(청산종결)
- case.liquidationClosure.*

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
  "scenarioKey": "liquidation_closure",
  "title": "청산종결",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["청산종결", "청산 종결", "청산 마무리", "법인 종료"] },
  "questions": [
    {
      "id": "q_liquidation_started",
      "type": "single_choice",
      "text": "이미 해산 및 청산인 선임 등 청산 절차를 시작했나요?",
      "options": ["예(진행 중)", "아니오(아직)", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "청산종결은 선행 단계(해산/청산인 등) 완료 여부에 따라 진행 가능성이 달라집니다.",
      "next": "q_asset_settlement"
    },
    {
      "id": "q_asset_settlement",
      "type": "single_choice",
      "text": "자산/채무 정산이 완료되었나요?",
      "options": ["완료", "미완료", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "정산 미완료 시 청산종결 전 추가 조치가 필요할 수 있습니다.",
      "next": "q_tax_filing"
    },
    {
      "id": "q_tax_filing",
      "type": "single_choice",
      "text": "세무 신고/정산(부가세/법인세 등) 정리가 되어 있나요?",
      "options": ["예", "아니오", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "세무 이슈는 청산종결 일정과 리스크에 직접 영향을 줍니다.",
      "next": "q_docs_ready"
    },
    {
      "id": "q_docs_ready",
      "type": "single_choice",
      "text": "청산종결 결의/보고서 등 관련 서류 준비 상태는 어떤가요?",
      "options": ["준비됨", "준비 필요", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "서류 누락은 보정과 일정 지연의 주요 원인입니다.",
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
      "text": "정산 현황/세무 이슈 등 특이사항을 적어주세요.",
      "required": false,
      "next": null
    }
  ],
  "previewBase": {
    "minPrice": 380000,
    "maxPrice": 850000,
    "etaDays": 10,
    "requiredDocs": ["청산종결 결의/보고 자료", "정산 관련 자료", "세무 신고 관련 자료(있으면)"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_liquidation_started", "op": "in", "value": ["아니오(아직)", "모르겠음"] }], "addEtaDays": 3, "addMinPrice": 120000, "addMaxPrice": 220000 },
    { "when": [{ "questionId": "q_asset_settlement", "op": "in", "value": ["미완료", "모르겠음"] }], "addEtaDays": 3, "addMinPrice": 100000, "addMaxPrice": 200000 },
    { "when": [{ "questionId": "q_tax_filing", "op": "in", "value": ["아니오", "모르겠음"] }], "addEtaDays": 2, "addMinPrice": 80000, "addMaxPrice": 150000, "addDocs": ["세무/정산 추가 확인(필요)"] },
    { "when": [{ "questionId": "q_docs_ready", "op": "in", "value": ["준비 필요", "모르겠음"] }], "addEtaDays": 2 }
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
    "desiredSpecialties": ["종료·청산"],
    "desiredScenarioKeys": ["liquidation_closure"],
    "preferredTags": ["청산종결"]
  }
}
```
