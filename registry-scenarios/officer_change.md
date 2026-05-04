# 등기 시나리오 — 임원 변경
- scenarioKey: officer_change
- 등기종류(표준명): 임원 변경
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

### 4-2. 케이스 특화(임원 변경)
- case.officerChange.*

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
  "scenarioKey": "officer_change",
  "title": "임원 변경",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["임원 변경", "대표 변경", "이사 변경", "감사 변경", "취임", "사임", "중임", "퇴임"] },
  "questions": [
    {
      "id": "q_officer_kind",
      "type": "single_choice",
      "text": "어떤 임원에 대한 변경인가요?",
      "options": ["대표이사", "이사", "감사", "기타"],
      "required": true,
      "depth": 1,
      "why": "변경 대상 직위에 따라 결의/서류/보정 포인트가 달라집니다.",
      "next": "q_officer_change_type"
    },
    {
      "id": "q_officer_change_type",
      "type": "single_choice",
      "text": "어떤 임원 변경인가요?",
      "options": ["취임", "사임", "중임", "퇴임", "대표이사 변경", "기타"],
      "required": true,
      "depth": 1,
      "why": "취임/사임/중임 조합에 따라 서류 구성과 효력일이 달라집니다.",
      "next": "q_resolution_kind"
    },
    {
      "id": "q_resolution_kind",
      "type": "single_choice",
      "text": "의사결정 방식은 어떤가요?",
      "options": ["주주총회 결의", "이사회 결의", "서면결의/동의", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "결의기관/방식에 따라 의사록/주주명부 등 첨부서류가 달라집니다.",
      "next": "q_officer_count_band"
    },
    {
      "id": "q_officer_count_band",
      "type": "single_choice",
      "text": "변경되는 임원 수는 몇 명인가요?",
      "options": ["1명", "2~3명", "4명 이상"],
      "required": true,
      "depth": 2,
      "why": "변경 인원이 많을수록 서명/첨부서류와 일정이 늘어납니다.",
      "next": "q_effective_timing"
    },
    {
      "id": "q_effective_timing",
      "type": "single_choice",
      "text": "변경 효력(취임/사임 등) 발생 시점은 어떤가요?",
      "options": ["이미 확정됨", "예정(변경 가능)", "모르겠음"],
      "required": true,
      "depth": 3,
      "why": "효력일은 신청서/의사록 작성과 기한 판단에 필요합니다.",
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
    "minPrice": 150000,
    "maxPrice": 320000,
    "etaDays": 3,
    "requiredDocs": ["주주총회 의사록(또는 이사회 의사록)", "임원 취임승낙서/사임서"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_officer_count_band", "op": "eq", "value": "2~3명" }], "addMinPrice": 40000, "addMaxPrice": 80000 },
    { "when": [{ "questionId": "q_officer_count_band", "op": "eq", "value": "4명 이상" }], "addMinPrice": 80000, "addMaxPrice": 150000, "addEtaDays": 1 },
    { "when": [{ "questionId": "q_officer_kind", "op": "eq", "value": "대표이사" }], "addMinPrice": 30000, "addMaxPrice": 60000 },
    { "when": [{ "questionId": "q_resolution_kind", "op": "eq", "value": "주주총회 결의" }], "addDocs": ["주주명부"] },
    { "when": [{ "questionId": "q_resolution_kind", "op": "eq", "value": "서면결의/동의" }], "addDocs": ["서면결의서/동의서"] },
    { "when": [{ "questionId": "q_effective_timing", "op": "in", "value": ["예정(변경 가능)", "모르겠음"] }], "addEtaDays": 1 }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_officer_kind", "op": "eq", "value": "기타" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "임원 종류가 '기타'인 경우 요청사항(특이사항)을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_officer_change_type", "op": "eq", "value": "기타" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "임원 변경 유형이 '기타'인 경우 요청사항(특이사항)을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_resolution_kind", "op": "eq", "value": "모르겠음" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "의사결정 방식이 '모르겠음'인 경우 현재 상황(대표/이사 수, 이사회 존재 여부 등)을 특이사항에 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["기본 변경"],
    "desiredScenarioKeys": ["officer_change"],
    "preferredTags": []
  }
}
```
