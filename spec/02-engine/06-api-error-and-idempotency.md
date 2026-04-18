# API 공통 규약: 에러/멱등성/재시도/레이트리밋 — v1

목표: 모바일/PC/AI(운영) 클라이언트가 “안전하게” API를 호출할 수 있도록, 실패/중복/재시도/제한 규칙을 고정한다.  
OpenAPI: `02-engine/openapi_v1.yaml`

---

## 1) 공통 헤더 규약

### 1.1 `X-Request-Id`
- 요청 추적용 ID
- 서버는 이벤트 trace(`requestId`)와 `domain_events.trace`에 기록
- 클라이언트가 없으면 서버가 생성해 응답에 echo

### 1.2 `X-Correlation-Id`
- 여러 요청을 하나의 사용자 여정/업무 트랜잭션으로 묶는 상위 ID(선택)

### 1.3 `Idempotency-Key` (강권)
POST/결제/업로드/케이스 생성/승인 액션은 필수에 가깝게 사용.

---

## 2) 표준 에러 응답 포맷

```json
{
  "code": "INVALID_ARGUMENT",
  "messageKo": "필수 파라미터가 누락되었습니다.",
  "requestId": "01H...",
  "details": { "field": "intentText" }
}
```

필드:
- `code`: 기계 판독 가능한 에러 코드
- `messageKo`: 사용자/로그용 메시지(기본 한국어)
- `requestId`: 추적 ID
- `details`: 선택(필드 오류, 제한값, 승인 대기 ID 등)

---

## 3) 에러 코드 표준(권장 최소 세트)

| code | HTTP | 의미 | 재시도 |
|---|---:|---|---|
| `INVALID_ARGUMENT` | 400 | 입력 오류/형식 오류 | X |
| `VALIDATION_FAILED` | 400 | 스키마 검증 실패(JSON Schema 등) | X |
| `UNAUTHENTICATED` | 401 | 로그인/토큰 필요 | X |
| `FORBIDDEN` | 403 | 권한 없음(RBAC/RLS) | X |
| `NOT_FOUND` | 404 | 리소스 없음 | X |
| `CONFLICT` | 409 | 상태 충돌/중복 처리 | 조건부 |
| `APPROVAL_REQUIRED` | 412 | 승인 게이트 필요/대기/반려 | X |
| `PAYLOAD_TOO_LARGE` | 413 | 업로드 용량 초과 | X |
| `RATE_LIMITED` | 429 | 호출 제한 초과 | O(지수백오프) |
| `DEPENDENCY_FAILED` | 502/503 | PG/OCR 등 외부 의존 실패 | O(지수백오프) |
| `INTERNAL` | 500 | 서버 내부 오류 | O(지수백오프) |

`CONFLICT` 재시도 기준:
- “멱등성 키 중복”이면 **동일 응답 반환**(서버가 처리)
- 상태 충돌(예: 이미 decision 확정)이라면 재시도 X, 클라이언트는 최신 상태 조회 후 처리

---

## 4) 멱등성(Idempotency) 규칙(반드시)

### 4.1 멱등 적용 대상
- `POST /v1/intent`
- `POST /v1/diagnosis/answer`
- `POST /v1/cases`
- `POST /v1/cases/{caseId}/documents`
- 승인/확정 계열:
  - `POST /review/request`, `POST /review/decision`
  - `POST /quote/finalize`, `POST /quote/accept`
- 결제/환불/정산 트리거(추후 확장)

### 4.2 키 스코프(권장)
`(actor_type, actor_id/session_id, endpoint, idempotency_key)` 조합을 유니크로 저장.
- actor_id가 없는 게스트는 `session_id`를 사용

### 4.3 저장해야 할 것
서버는 키를 받으면 다음을 저장:
- request hash(민감정보 제외)
- response body(또는 response hash + 재구성 가능한 ref)
- 상태: `in_progress/succeeded/failed`
- TTL: 최소 24시간(결제/환불은 더 길게)

### 4.4 처리 규칙
- 동일 키로 재요청이 오면:
  - 성공 완료(`succeeded`): **동일 응답** 반환
  - 처리중(`in_progress`): 409 `CONFLICT` + `details.retryAfterMs`(또는 202) 중 하나(정책 고정 필요)
  - 실패(`failed`): 409 또는 500 계열(서버 정책), 클라이언트는 새 키로 재시도 가능

---

## 5) 재시도(Retry) 정책

### 5.1 재시도 가능한 에러
- `RATE_LIMITED`(429)
- `DEPENDENCY_FAILED`(502/503)
- `INTERNAL`(500)

### 5.2 재시도 금지
- 4xx 대부분(입력/권한/승인)
- `APPROVAL_REQUIRED`

### 5.3 백오프(권장)
- 지수 백오프 + Jitter
- 최대 재시도 횟수: 3~5회(클라이언트 타입별 상이)
- `Retry-After` 헤더가 있으면 우선 적용

### 5.4 재시도 시 반드시 지켜야 할 것
- POST는 **Idempotency-Key 없이 재시도 금지**
- 재시도는 requestId는 새로, correlationId는 유지(권장)

---

## 6) 레이트리밋(Rate Limiting) 정책(권장)

목표: 악성 호출/과금 사고/AI 오작동을 막는다.

### 6.1 기본 단위
- 사용자 앱: `sessionId` + IP
- 파트너/운영: `actorId` + IP + 조직(`partnerId`)

### 6.2 구간별 예시(초안)
- 퍼널 `/intent`, `/diagnosis/answer`: 세션당 분당 N회 (예: 30)
- `/results`: 세션당 분당 N회 (예: 60)
- 문서 업로드: 세션/케이스당 분당 N회 + 일일 용량 제한
- 승인/확정: 계정당 분당 N회(예: 10) + 이상 패턴 탐지

### 6.3 응답
- HTTP 429 + `Retry-After`
- `code=RATE_LIMITED` + details에 현재 제한 정보(선택)

---

## 7) 페이지네이션/정렬(확장 대비)

권장:
- cursor 기반 페이지네이션: `cursor`, `limit`
- 타임라인/리스트는 `occurredAt desc` 기본

---

## 8) 승인 게이트(Approval Required) 응답 규약

`APPROVAL_REQUIRED`(412) 발생 시 details 예시:
```json
{
  "code": "APPROVAL_REQUIRED",
  "messageKo": "승인 대기 중입니다.",
  "requestId": "01H...",
  "details": {
    "approvalGate": "quote_finalize",
    "approvalRequestId": "appr_123",
    "requiredRole": "ops_approver"
  }
}
```

`approvalGate` 값(예시):
- `message_send` (외부 메시지 발송)
- `quote_finalize` (견적 확정)
- `refund_approve` (환불 승인)
- `case_reassign` (파트너 재배정)
- `pii_view` (PII/OCR 열람)
- `partner_onboarding_approve` (파트너 온보딩 승인/반려/보완)
- `partner_grade_change` (파트너 등급 변경)
- `partner_suspend` (파트너 정지/해제)

클라이언트 행동:
- 사용자 앱: “확정 대기/처리중” UI
- 파트너/운영: 승인 큐로 이동(Ops Console)
