# 등기 시나리오 — 목적 변경
- scenarioKey: business_purpose_change
- 등기종류(표준명): 목적 변경
- 카테고리: 기본 변경
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

### 4-2. 케이스 특화(목적 변경)
- case.businessPurposeChange.*

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
  "scenarioKey": "business_purpose_change",
  "title": "목적 변경",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["목적 변경", "사업목적 변경", "사업 목적 추가", "사업 목적 삭제"] },
  "questions": [
    {
      "id": "q_change_type",
      "type": "single_choice",
      "text": "어떤 목적 변경인가요?",
      "options": ["목적 추가", "목적 삭제", "추가+삭제", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "추가/삭제 조합에 따라 목적 문구 검토와 결의 문서 구성이 달라집니다.",
      "next": "q_new_purpose_ready"
    },
    {
      "id": "q_new_purpose_ready",
      "type": "single_choice",
      "text": "추가/변경할 사업목적 문구가 준비되어 있나요?",
      "options": ["예(준비됨)", "아니오(검토 필요)", "해당 없음(삭제만)", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "목적 문구는 업종/허가요건/등기 리스크에 영향을 줍니다.",
      "next": "q_license_risk"
    },
    {
      "id": "q_license_risk",
      "type": "single_choice",
      "text": "인허가/등록이 필요한 업종(금융/의료/교육 등)이 포함되나요?",
      "options": ["아니오", "예", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "인허가 업종은 목적 문구와 별도의 준비 요건이 추가될 수 있습니다.",
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
      "text": "추가/삭제할 목적(문구) 또는 특이사항을 적어주세요.",
      "required": false,
      "next": null
    }
  ],
  "previewBase": {
    "minPrice": 140000,
    "maxPrice": 280000,
    "etaDays": 3,
    "requiredDocs": ["정관(현행/변경안)", "주주총회 의사록(또는 이사회 의사록)"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_new_purpose_ready", "op": "in", "value": ["아니오(검토 필요)", "모르겠음"] }], "addEtaDays": 1 },
    { "when": [{ "questionId": "q_license_risk", "op": "in", "value": ["예", "모르겠음"] }], "addMinPrice": 40000, "addMaxPrice": 80000, "addEtaDays": 1 },
    { "when": [{ "questionId": "q_resolution_kind", "op": "eq", "value": "주주총회 결의" }], "addDocs": ["주주명부"] },
    { "when": [{ "questionId": "q_resolution_kind", "op": "eq", "value": "서면결의/동의" }], "addDocs": ["서면결의서/동의서"] }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_new_purpose_ready", "op": "in", "value": ["예(준비됨)", "모르겠음"] }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "추가/변경할 목적 문구(또는 업종 키워드)를 특이사항에 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["기본 변경"],
    "desiredScenarioKeys": ["business_purpose_change"],
    "preferredTags": []
  }
}
```
