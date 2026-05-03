# 등기 시나리오 — 지점 설치
- scenarioKey: branch_registration
- 등기종류(표준명): 지점 설치
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

### 4-2. 케이스 특화(지점)
- case.branch.*

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
  "scenarioKey": "branch_registration",
  "title": "지점 설치",
  "enabled": true,
  "version": 1,
  "entry": { "keywords": ["지점 설치", "지점 등록", "지점 개설"] },
  "questions": [
    {
      "id": "q_branch_location_ready",
      "type": "single_choice",
      "text": "지점 주소가 확정되어 있나요?",
      "options": ["예(확정)", "아니오(미정)", "모르겠음"],
      "required": true,
      "depth": 1,
      "why": "지점 주소 확정 여부는 결의와 신청 준비 가능 여부에 직접 연결됩니다.",
      "next": "q_branch_manager_plan"
    },
    {
      "id": "q_branch_manager_plan",
      "type": "single_choice",
      "text": "지점 설치와 함께 지배인 선임도 같이 진행하나요?",
      "options": ["예", "아니오", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "지배인 선임 여부에 따라 추가 서류와 파트너 전문성이 달라집니다.",
      "next": "q_branch_docs_ready"
    },
    {
      "id": "q_branch_docs_ready",
      "type": "single_choice",
      "text": "지점 주소 관련 서류(임대차/사용승낙 등)는 준비되어 있나요?",
      "options": ["준비됨", "준비 필요", "모르겠음"],
      "required": true,
      "depth": 2,
      "why": "주소 관련 증빙이 없으면 접수 전 단계에서 지연이 발생합니다.",
      "next": "q_branch_urgency"
    },
    {
      "id": "q_branch_urgency",
      "type": "single_choice",
      "text": "언제까지 처리가 필요하신가요?",
      "options": ["긴급(1~2일)", "일반(3~5일)", "여유(1주 이상)"],
      "required": true,
      "depth": 3,
      "why": "긴급 사건 여부에 따라 처리 순서와 파트너 선택 기준이 달라집니다.",
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
    "minPrice": 180000,
    "maxPrice": 340000,
    "etaDays": 4,
    "requiredDocs": ["지점 설치 결의서류", "지점 주소 관련 서류"]
  },
  "previewRules": [
    { "when": [{ "questionId": "q_branch_manager_plan", "op": "eq", "value": "예" }], "addMinPrice": 70000, "addMaxPrice": 140000, "addDocs": ["지배인 관련 추가서류"] },
    { "when": [{ "questionId": "q_branch_location_ready", "op": "in", "value": ["아니오(미정)", "모르겠음"] }], "addEtaDays": 2 },
    { "when": [{ "questionId": "q_branch_docs_ready", "op": "in", "value": ["준비 필요", "모르겠음"] }], "addEtaDays": 1 },
    { "when": [{ "questionId": "q_branch_urgency", "op": "eq", "value": "긴급(1~2일)" }], "addMinPrice": 40000, "addMaxPrice": 70000 }
  ],
  "validators": {
    "forbid": [
      {
        "when": [{ "questionId": "q_notes", "op": "regex", "value": "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        "messageKo": "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      },
      {
        "when": [{ "questionId": "q_branch_location_ready", "op": "eq", "value": "아니오(미정)" }, { "questionId": "q_notes", "op": "not_exists" }],
        "messageKo": "지점 주소가 미정인 경우 예상 지역/시점 등을 특이사항에 적어주세요."
      }
    ]
  },
  "partnerMatch": {
    "desiredSpecialties": ["지점·지배인"],
    "desiredScenarioKeys": ["branch_registration"],
    "preferredTags": ["지점등기"]
  }
}
```
