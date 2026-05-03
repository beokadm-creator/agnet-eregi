# 등기 시나리오 — 분할합병
- scenarioKey: split_merger
- 등기종류(표준명): 분할합병
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

### 4-2. 케이스 특화(분할합병)
- case.splitMerger.*

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
  "scenarioKey": "split_merger",
  "title": "분할합병",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["분할합병", "분할 합병", "조직재편"] },
  "questions": [
    {
      "id": "q_structure",
      "type": "single_choice",
      "text": "분할합병 구조가 정해져 있나요?",
      "options": ["예(구조 확정)", "아니오(검토 필요)", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "구조(분할+합병) 설계가 확정되어야 계약/계획서와 일정 산정이 가능합니다.",
      "next": "q_entities_count"
    },
    {
      "id": "q_entities_count",
      "type": "single_choice",
      "text": "관여 회사 수는 어느 정도인가요?",
      "options": ["2개", "3개 이상", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "관여 회사가 많을수록 문서/결의/공고 절차가 길어집니다.",
      "next": "q_creditor_procedure_ready"
    },
    {
      "id": "q_creditor_procedure_ready",
      "type": "single_choice",
      "text": "채권자보호절차(공고/최고) 준비가 되어 있나요?",
      "options": ["준비됨", "준비 필요", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "분할합병은 채권자보호절차가 필수인 경우가 많아 일정에 큰 영향을 줍니다.",
      "next": "q_asset_transfer_complexity"
    },
    {
      "id": "q_asset_transfer_complexity",
      "type": "single_choice",
      "text": "이관되는 사업/자산/계약이 복잡한 편인가요?",
      "options": ["단순", "복잡", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "이관이 복잡하면 계획서·부속서류 검토와 이해관계 조정이 늘어납니다.",
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
      "text": "구조/일정/대상 회사 등 특이사항을 적어주세요.",
      "required": false,
      "next": null
    }
  ],
  "previewBase": {
    "minPrice": 1800000,
    "maxPrice": 3800000,
    "etaDays": 28,
    "requiredDocs": ["분할계획서/합병계약서(초안)", "주주총회 의사록", "채권자보호절차 관련 자료"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_structure", "op": "in", "value": ["아니오(검토 필요)", "모르겠음"] }], "addEtaDays": 4, "addMinPrice": 200000, "addMaxPrice": 500000 },
    { "when": [{ "questionId": "q_entities_count", "op": "in", "value": ["3개 이상", "모르겠음"] }], "addEtaDays": 3, "addMinPrice": 250000, "addMaxPrice": 700000 },
    { "when": [{ "questionId": "q_creditor_procedure_ready", "op": "in", "value": ["준비 필요", "모르겠음"] }], "addEtaDays": 5 },
    { "when": [{ "questionId": "q_asset_transfer_complexity", "op": "in", "value": ["복잡", "모르겠음"] }], "addEtaDays": 3, "addMinPrice": 200000, "addMaxPrice": 500000 }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_structure", "op": "eq", "value": "모르겠음" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "구조가 불명확하면 분할/합병 대상과 목적을 특이사항에 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["조직행위"],
    "desiredScenarioKeys": ["split_merger"],
    "preferredTags": ["분할합병"]
  }
}
```
