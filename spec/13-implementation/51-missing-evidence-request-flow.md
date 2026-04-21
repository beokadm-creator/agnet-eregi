# Missing Evidence Request Flow

## 1. 개요
파트너가 케이스 처리 중 사용자가 제출한 증거물이 부족하거나 검증에 실패한 경우, 추가 서류를 요청(`EvidenceRequest`)할 수 있습니다. 
사용자는 User Web에서 요청받은 서류를 업로드하고, 시스템은 이를 자동으로 검증하여 충족 시 파트너에게 알림을 보냅니다.

## 2. 데이터 모델

### 2.1 `evidence_requests` 컬렉션
추가 서류 요청을 저장하는 컬렉션입니다.
```typescript
{
  id: string;
  partnerId: string;
  caseId: string;
  submissionId?: string;
  status: "open" | "fulfilled" | "cancelled";
  items: Array<{ code: string; titleKo: string; required: boolean }>;
  messageToUserKo: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  fulfilledAt?: Timestamp;
}
```

### 2.2 `evidences` 필드 확장
```typescript
{
  // 기존 필드들...
  source?: "partner" | "user"; // 업로드 주체
  requestId?: string;          // 연결된 EvidenceRequest ID
}
```

## 3. 프로세스 흐름

### Step 1: 파트너의 추가 서류 요청 생성
- 파트너가 Case Detail 화면에서 사용자에게 전달할 메시지와 필요한 서류 항목(`items`)을 입력하여 요청을 생성합니다.
- **API**: `POST /v1/partner/cases/:caseId/evidence-requests`
- **알림**: `evidence.requested` 이벤트가 발생하여 사용자의 Webhook(또는 Notification Job)을 통해 알림이 전송됩니다.

### Step 2: 사용자의 서류 확인 및 업로드
- 사용자는 User Web의 Submission Detail에서 상태가 `open`인 요청을 확인합니다.
- 각 서류 항목별로 파일을 선택하여 업로드합니다.
- **API**: 
  - `POST /v1/user/submissions/:id/evidences/upload-url` (Signed URL 발급, `requestId` 매핑)
  - `PUT <Signed URL>` (실제 파일 업로드)
  - `POST /v1/user/submissions/:id/evidences/:evidenceId/complete` (업로드 확정)

### Step 3: 백그라운드 검증 워커 (Validation Worker)
- `partner_evidence_worker`가 주기적으로 `uploaded` 상태의 증거물을 검증합니다.
- MIME 타입 및 파일 크기를 확인하고, 통과 시 `status`를 `validated`로 변경합니다.
- **Request 충족 로직**: 검증이 완료된 증거물이 특정 `requestId`를 가지고 있다면, 해당 `evidence_request`를 조회하여 상태를 `fulfilled`로 변경합니다. (MVP: 1개 이상의 파일이 검증되면 즉시 충족 처리)

### Step 4: 파트너 알림 전송
- 요청이 `fulfilled` 상태로 변경되면, `evidence.fulfilled` 이벤트가 발생합니다.
- `notify_worker`가 설정된 파트너의 Webhook으로 알림을 전송하여, 파트너가 즉시 확인 후 패키지 재생성 등의 후속 조치를 취할 수 있도록 돕습니다.

## 4. API 엔드포인트 요약

### 파트너 API
- `POST /v1/partner/cases/:caseId/evidence-requests`: 요청 생성
- `GET /v1/partner/cases/:caseId/evidence-requests`: 케이스의 요청 목록 조회
- `POST /v1/partner/cases/:caseId/evidence-requests/:requestId/cancel`: 요청 취소 (상태를 `cancelled`로 변경)

### 사용자 API
- `GET /v1/user/submissions/:id/evidence-requests`: 제출물의 요청 목록 조회
- `GET /v1/user/submissions/:id/evidence-requests/:requestId`: 특정 요청 상세 조회
- `POST /v1/user/submissions/:id/evidences/upload-url`: 서명된 업로드 URL 발급 (User 스코프, `requestId` 지원)
- `POST /v1/user/submissions/:id/evidences/:evidenceId/complete`: 업로드 확정

## 5. Webhook Payload

### 5.1 `evidence.requested` (User 수신)
```json
{
  "event": "evidence.requested",
  "target": { "userId": "user123" },
  "payload": {
    "caseId": "case456",
    "submissionId": "sub789",
    "requestId": "req001",
    "message": "여권 사본이 누락되었습니다."
  },
  "timestamp": "..."
}
```

### 5.2 `evidence.fulfilled` (Partner 수신)
```json
{
  "event": "evidence.fulfilled",
  "target": { "partnerId": "partner123" },
  "payload": {
    "caseId": "case456",
    "requestId": "req001",
    "evidenceId": "ev001"
  },
  "timestamp": "..."
}
```
