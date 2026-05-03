# 등기 시나리오 — 외국회사 등기
- scenarioKey: foreign_company_registration
- 등기종류(표준명): 외국회사 등기
- 카테고리: 특수
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

### 4-2. 케이스 특화(외국회사)
- case.foreignCompanyRegistration.*

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
  "scenarioKey": "foreign_company_registration",
  "title": "외국회사 등기",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["외국회사 등기", "외국 회사 등록", "외국법인 등기"] },
  "questions": [
    {
      "id": "q_foreign_entity_type",
      "type": "single_choice",
      "text": "외국회사 유형은 어떤가요?",
      "options": ["해외 법인", "해외 개인사업/기타", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "법인격과 본국 자료 형태에 따라 준비 서류가 크게 달라집니다.",
      "next": "q_foreign_country_docs"
    },
    {
      "id": "q_foreign_country_docs",
      "type": "single_choice",
      "text": "본국 발급 서류(등기부, 정관, 증명서 등)는 준비되어 있나요?",
      "options": ["준비됨", "준비 필요", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "외국회사 사건은 본국 서류 확보 여부가 일정의 핵심입니다.",
      "next": "q_apostille_needed"
    },
    {
      "id": "q_apostille_needed",
      "type": "single_choice",
      "text": "아포스티유/영사확인과 번역이 필요한가요?",
      "options": ["예", "아니오", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "공증·인증·번역 여부는 비용과 일정에 직접 영향을 줍니다.",
      "next": "q_domestic_representative_ready"
    },
    {
      "id": "q_domestic_representative_ready",
      "type": "single_choice",
      "text": "국내 대표자/영업소 정보는 확정되어 있나요?",
      "options": ["예", "아니오", "모르겠음"],
      "required": true,
      "depth": 3,
      "why": "국내 대표자 및 영업소 정보가 확정되어야 실제 신청서 구성이 가능합니다.",
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
    "minPrice": 380000,
    "maxPrice": 850000,
    "etaDays": 8,
    "requiredDocs": ["본국 회사 관련 증명서류", "번역본(필요 시)", "국내 대표자/영업소 정보"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_foreign_entity_type", "op": "eq", "value": "해외 개인사업/기타" }], "addMinPrice": 120000, "addMaxPrice": 220000, "addEtaDays": 2 },
    { "when": [{ "questionId": "q_foreign_country_docs", "op": "in", "value": ["준비 필요", "모르겠음"] }], "addEtaDays": 3 },
    { "when": [{ "questionId": "q_apostille_needed", "op": "in", "value": ["예", "모르겠음"] }], "addMinPrice": 100000, "addMaxPrice": 180000, "addEtaDays": 2, "addDocs": ["아포스티유/영사확인 및 번역 관련 자료"] },
    { "when": [{ "questionId": "q_domestic_representative_ready", "op": "in", "value": ["아니오", "모르겠음"] }], "addEtaDays": 1 }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_foreign_entity_type", "op": "eq", "value": "모르겠음" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "외국회사 유형이 불명확하면 국가/법인 형태 등을 특이사항에 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["설립"],
    "desiredScenarioKeys": ["foreign_company_registration"],
    "preferredTags": ["외국인케이스"]
  }
}
```
