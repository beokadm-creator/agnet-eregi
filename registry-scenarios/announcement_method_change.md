# 등기 시나리오 — 공고방법 변경
- scenarioKey: announcement_method_change
- 등기종류(표준명): 공고방법 변경
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

### 4-2. 케이스 특화(공고방법 변경)
- case.announcementMethodChange.*

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
  "scenarioKey": "announcement_method_change",
  "title": "공고방법 변경",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["공고방법 변경", "공고방법", "전자공고", "일간신문 공고"] },
  "questions": [
    {
      "id": "q_current_method",
      "type": "single_choice",
      "text": "현재 공고방법은 무엇인가요?",
      "options": ["일간신문 공고", "전자공고", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "현행 공고방법에 따라 변경 절차/정관 반영 여부가 달라집니다.",
      "next": "q_target_method"
    },
    {
      "id": "q_target_method",
      "type": "single_choice",
      "text": "변경하려는 공고방법은 무엇인가요?",
      "options": ["일간신문 공고", "전자공고", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "전자공고 도입 시 공고매체(홈페이지) 등 추가 확인이 필요합니다.",
      "next": "q_homepage_ready"
    },
    {
      "id": "q_homepage_ready",
      "type": "single_choice",
      "text": "전자공고를 한다면 공고 게시용 홈페이지가 준비되어 있나요?",
      "options": ["예(준비됨)", "아니오(준비 필요)", "해당 없음(전자공고 아님)", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "전자공고는 공고 게시 수단이 명확해야 진행이 가능합니다.",
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
    "maxPrice": 240000,
    "etaDays": 3,
    "requiredDocs": ["정관(현행/변경안)", "주주총회 의사록(또는 이사회 의사록)"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_homepage_ready", "op": "in", "value": ["아니오(준비 필요)", "모르겠음"] }], "addEtaDays": 1 },
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
        "when": [{ "questionId": "q_target_method", "op": "eq", "value": "전자공고" }, { "questionId": "q_homepage_ready", "op": "in", "value": ["아니오(준비 필요)", "모르겠음"] }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "전자공고로 변경하려면 공고 게시 수단(홈페이지 주소/준비 계획)을 특이사항에 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["기본 변경"],
    "desiredScenarioKeys": ["announcement_method_change"],
    "preferredTags": []
  }
}
```
