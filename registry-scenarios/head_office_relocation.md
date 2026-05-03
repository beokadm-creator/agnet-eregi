# 등기 시나리오 — 본점 이전
- scenarioKey: head_office_relocation
- 등기종류(표준명): 본점 이전
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

### 4-2. 케이스 특화(본점 이전)
- case.headOfficeRelocation.*

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
  "scenarioKey": "head_office_relocation",
  "title": "본점 이전",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["본점 이전", "주소 이전", "이전 등기", "사무실 이전"] },
  "questions": [
    {
      "id": "q_move_scope",
      "type": "single_choice",
      "text": "이전 범위는 어떤가요?",
      "options": ["관내 이전", "관외 이전(관할 변경)"],
      "required": true,
      "depth": 1,
      "why": "관할 변경 여부에 따라 접수/서류/기간이 달라집니다.",
      "next": "q_move_timing"
    },
    {
      "id": "q_move_timing",
      "type": "single_choice",
      "text": "언제까지 처리가 필요하신가요?",
      "options": ["긴급(1~2일)", "일반(3~5일)", "여유(1주 이상)"],
      "required": true,
      "depth": 1,
      "why": "기한이 촉박할수록 우선 처리/일정 조정이 필요할 수 있습니다.",
      "next": "q_address_ready"
    },
    {
      "id": "q_address_ready",
      "type": "single_choice",
      "text": "이전할 주소(임대차 등)가 확정되어 있나요?",
      "options": ["예(확정)", "아니오(미정)", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "주소 확정 여부는 결의/신청서 작성 가능 여부에 직접 영향을 줍니다.",
      "next": "q_documents_ready"
    },
    {
      "id": "q_documents_ready",
      "type": "single_choice",
      "text": "임대차계약서/사용승낙서 등 주소 관련 서류 준비가 되어 있나요?",
      "options": ["예(준비됨)", "아니오(준비 필요)", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "주소 관련 서류가 없으면 접수 전 단계에서 지연/보정이 발생할 수 있습니다.",
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
    "minPrice": 120000,
    "maxPrice": 260000,
    "etaDays": 3,
    "requiredDocs": ["법인등기부등본", "임대차계약서(또는 사용승낙서)"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_move_scope", "op": "eq", "value": "관외 이전(관할 변경)" }], "addMinPrice": 60000, "addMaxPrice": 120000, "addEtaDays": 1 },
    { "when": [{ "questionId": "q_move_timing", "op": "eq", "value": "긴급(1~2일)" }], "addMinPrice": 50000, "addMaxPrice": 80000 },
    { "when": [{ "questionId": "q_address_ready", "op": "in", "value": ["아니오(미정)", "모르겠음"] }], "addEtaDays": 2 },
    { "when": [{ "questionId": "q_documents_ready", "op": "in", "value": ["아니오(준비 필요)", "모르겠음"] }], "addEtaDays": 1 }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_address_ready", "op": "eq", "value": "아니오(미정)" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "주소가 미정인 경우, 현재 예상 지역/시점 등을 특이사항에 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["기본 변경"],
    "desiredScenarioKeys": ["head_office_relocation"],
    "preferredTags": ["관외이전"]
  }
}
```
