# 등기 시나리오 — 법인 설립
- scenarioKey: corp_establishment
- 등기종류(표준명): 법인 설립
- 카테고리: 설립
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

### 4-2. 케이스 특화(법인 설립)
- case.corpEstablishment.*

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
  "scenarioKey": "corp_establishment",
  "title": "법인 설립",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["법인 설립", "회사 설립", "신설 법인", "법인 만들기", "설립"] },
  "questions": [
    {
      "id": "q_corp_type",
      "type": "single_choice",
      "text": "어떤 형태의 법인인가요?",
      "options": ["주식회사", "유한회사", "기타"],
      "required": true,
      "depth": 1,
      "why": "회사 형태에 따라 필요한 절차/서류와 난이도가 달라집니다.",
      "next": "q_founders_count_band"
    },
    {
      "id": "q_founders_count_band",
      "type": "single_choice",
      "text": "발기인/주주 수는 어느 정도인가요?",
      "options": ["1명", "2~3명", "4명 이상"],
      "required": true,
      "depth": 1,
      "why": "참여자 수가 많을수록 의사결정/서명 회수와 서류가 복잡해집니다.",
      "next": "q_capital_band"
    },
    {
      "id": "q_capital_band",
      "type": "single_choice",
      "text": "자본금 규모는 어느 정도인가요?",
      "options": ["1천만원 이하", "1천만원~1억원", "1억원 이상"],
      "required": true,
      "depth": 1,
      "why": "자본금 규모에 따라 비용/기간과 추가 확인이 달라질 수 있습니다.",
      "next": "q_officer_has_auditor"
    },
    {
      "id": "q_officer_has_auditor",
      "type": "single_choice",
      "text": "감사(또는 감사위원회) 선임이 필요한가요?",
      "options": ["예", "아니오", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "감사 선임 여부에 따라 임원 관련 서류와 절차가 추가됩니다.",
      "next": "q_foreign_participant"
    },
    {
      "id": "q_foreign_participant",
      "type": "single_choice",
      "text": "외국인(또는 외국법인) 주주/임원이 포함되나요?",
      "options": ["아니오", "예", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "외국인/외국법인은 번역·공증·아포스티유 등 추가 요건이 발생할 수 있습니다.",
      "next": "q_seal_ready"
    },
    {
      "id": "q_seal_ready",
      "type": "single_choice",
      "text": "법인 인감/사용인감 준비 상태는 어떤가요?",
      "options": ["준비됨", "미준비(제작 필요)", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "인감 준비 여부가 서명/날인 회수와 일정에 직접 영향을 줍니다.",
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
    "minPrice": 250000,
    "maxPrice": 450000,
    "etaDays": 5,
    "requiredDocs": ["정관(초안)", "주주명부", "임원 취임승낙서"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_corp_type", "op": "eq", "value": "기타" }], "addMinPrice": 50000, "addMaxPrice": 100000, "addEtaDays": 1 },
    { "when": [{ "questionId": "q_founders_count_band", "op": "eq", "value": "4명 이상" }], "addMinPrice": 30000, "addMaxPrice": 80000, "addEtaDays": 1 },
    { "when": [{ "questionId": "q_capital_band", "op": "eq", "value": "1억원 이상" }], "addMinPrice": 50000, "addMaxPrice": 150000, "addEtaDays": 1 },
    { "when": [{ "questionId": "q_officer_has_auditor", "op": "eq", "value": "예" }], "addDocs": ["감사 취임승낙서"] },
    { "when": [{ "questionId": "q_foreign_participant", "op": "in", "value": ["예", "모르겠음"] }], "addMinPrice": 80000, "addMaxPrice": 150000, "addEtaDays": 2, "addDocs": ["외국인/외국법인 관련 추가서류(확인 필요)"] },
    { "when": [{ "questionId": "q_seal_ready", "op": "in", "value": ["미준비(제작 필요)", "모르겠음"] }], "addEtaDays": 1 }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_corp_type", "op": "eq", "value": "기타" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "법인 형태가 '기타'인 경우 요청사항(특이사항)을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_foreign_participant", "op": "eq", "value": "예" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "외국인/외국법인 참여가 있는 경우 특이사항에 대상(주주/임원), 국적/구성 등을 간단히 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["설립"],
    "desiredScenarioKeys": ["corp_establishment"],
    "preferredTags": []
  }
}
```
