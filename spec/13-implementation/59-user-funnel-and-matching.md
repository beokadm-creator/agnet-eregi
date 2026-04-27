# User Funnel & Matching (EP-01, EP-02)

## 1. 개요
사용자가 AgentRegi 플랫폼에 처음 진입하여 자신의 상황(자연어 의도)을 입력하고, 미니 진단을 거쳐 최적의 파트너를 추천받기까지의 "탐색 및 매칭" 퍼널(Phase 1)을 설계합니다. 
이 단계는 전환율(Conversion Rate)에 가장 큰 영향을 미치므로 Server-Driven UI(SDUI) 패턴과 이벤트 소싱(Event Sourcing)을 통해 유연한 실험과 데이터 추적이 가능해야 합니다.

## 2. 에픽 및 스토리 구성

### EP-01 사용자 퍼널 (홈 → 진단 → 결과)
- **EP-01-01 의도 입력 (Intent)**: 사용자가 자연어로 원하는 서비스(예: "법인 임원 변경")를 입력하면 서버가 이를 분석하여 적절한 진단 플로우로 안내합니다.
- **EP-01-02 미니 진단 (Diagnosis)**: 3~7개의 객관식/주관식 문항을 통해 사용자의 정확한 상황(임원 사임, 취임, 임기 만료 등)을 파악합니다.
- **EP-01-03 가치 프리뷰 (Value Preview)**: 사용자가 답변을 입력할 때마다 실시간으로 예상 비용, 소요 시간, 필요 서류(준비물)가 갱신되어 보여집니다.
- **EP-01-04 결과 조회 (Result)**: 진단이 완료되면, 추천 1안 파트너와 비교를 위한 Top 3 파트너 리스트가 제시됩니다.

### EP-02 매칭 / 랭킹 / 광고
- **EP-02-01 파트너 필터링**: 지역, 전문 분야, 가용성(Available)을 기준으로 1차 필터링을 수행합니다.
- **EP-02-02 종합 랭킹**: 품질 점수(Rating), SLA 준수율, 가격, 예상 소요 시간(ETA)을 종합하여 랭킹을 매깁니다.
- **EP-02-03 스폰서(광고) 분리**: 일반 추천(Organic)과 스폰서(Sponsored) 영역을 데이터 레벨에서 분리하여, UI에서 명확히 "광고" 라벨이 노출되도록 강제합니다.

---

## 3. 데이터 모델 (Firestore 스키마)

### 3.1 `funnel_sessions` (세션)
사용자의 1회 진단 사이클을 관리합니다.
- `id`: string (sessionId)
- `userId`: string | null (비로그인 사용자 지원)
- `intent`: string (최초 자연어 입력값)
- `status`: "started" | "diagnosing" | "completed" | "dropped"
- `answers`: Map<string, any> (문항별 답변 데이터 누적)
- `preview`: { minPrice: number, maxPrice: number, etaDays: number, requiredDocs: string[] }
- `createdAt`, `updatedAt`: Timestamp

### 3.2 `funnel_events` (퍼널 이벤트 로그 - Append Only)
A/B 테스트 및 이탈률 분석을 위한 타임라인.
- `sessionId`: string
- `type`: "INTENT_SUBMITTED" | "DIAGNOSIS_ANSWERED" | "RESULTS_VIEWED" | "PARTNER_SELECTED"
- `payload`: any (답변 내용, 노출된 파트너 목록 등)
- `createdAt`: Timestamp

---

## 4. API 명세 (HTTP API Contract)

### 4.1 의도 제출 및 세션 시작
`POST /v1/funnel/intent`
- **Request**: `{ "intentText": "임원 변경 등기 하고 싶어요" }`
- **Response**: 
  ```json
  {
    "ok": true,
    "data": {
      "sessionId": "fs_123abc",
      "nextQuestion": {
        "id": "q_corp_type",
        "type": "single_choice",
        "text": "어떤 형태의 법인인가요?",
        "options": ["주식회사", "유한회사", "기타"]
      }
    }
  }
  ```

### 4.2 진단 답변 제출 (SDUI 기반)
`POST /v1/funnel/sessions/:sessionId/answer`
- **Request**: `{ "questionId": "q_corp_type", "answer": "주식회사" }`
- **Response**: 
  ```json
  {
    "ok": true,
    "data": {
      "isCompleted": false,
      "nextQuestion": { /* 다음 질문 객체 */ },
      "preview": {
        "minPrice": 150000,
        "maxPrice": 300000,
        "etaDays": 3,
        "requiredDocs": ["법인인감증명서", "법인등기부등본"]
      }
    }
  }
  ```
- **동작**: 답변을 `funnel_sessions`에 저장하고, `funnel_events`에 `DIAGNOSIS_ANSWERED` 로그를 남깁니다.

### 4.3 매칭 결과 조회
`GET /v1/funnel/sessions/:sessionId/results`
- **Response**:
  ```json
  {
    "ok": true,
    "data": {
      "recommended": {
        "partnerId": "p_001",
        "name": "테스트 법무사",
        "price": 150000,
        "rankingScore": 95.5
      },
      "compareTop3": [ /* 파트너 객체 3개 */ ],
      "sponsored": [
        {
          "partnerId": "p_999",
          "name": "프리미엄 법무사",
          "disclosure": "Sponsored Partner"
        }
      ]
    }
  }
  ```
- **동작**: `funnel_sessions`의 `answers` 데이터를 바탕으로 조건에 맞는 파트너를 필터링 및 랭킹 산정(EP-02)하여 반환합니다. `RESULTS_VIEWED` 이벤트를 기록합니다.

---

## 5. 설계 원칙 및 주의사항
1. **유연한 진단 트리 (SDUI)**: 서버가 `nextQuestion`을 내려주는 구조이므로, 클라이언트 앱 업데이트 없이 진단 문항을 추가/삭제하거나 A/B 테스트를 진행할 수 있습니다.
2. **이탈률 측정**: 각 단계마다 `funnel_events`에 로그가 남으므로, 사용자가 어느 질문에서 가장 많이 이탈하는지 퍼널 분석이 가능해야 합니다.
3. **명확한 광고 분리**: 응답 데이터 구조상 `sponsored` 배열을 별도로 분리하고 `disclosure` 필드를 강제하여, 프론트엔드에서 광고임을 명시적으로 표시하도록 유도합니다.
4. **상태 관리의 분리**: `funnel_sessions`는 퍼널 탐색 전용 임시 데이터이며, 사용자가 파트너를 최종 선택하고 결제/진행을 확정할 때 비로소 정식 `user_submissions` 및 `cases` 데이터로 승격(Promotion)되어야 합니다.
