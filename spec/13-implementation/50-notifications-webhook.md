# Webhook Notifications (MVP)

## 1. 개요
사용자 제출(User Submission) 및 파트너 패키지/리포트 처리가 완료되었을 때, 등록된 Webhook URL로 자동 알림을 전송하는 기능입니다. MVP 단계에서는 Email 인프라 없이 Webhook만 지원하며, HMAC-SHA256 서명을 통한 무결성 검증과 지수 백오프(Exponential Backoff)를 통한 재시도 로직을 포함합니다.

## 2. 데이터 모델

### 2.1 Partner Notification Settings
`partner_notification_settings` 컬렉션 (문서 ID: `partnerId`)
```typescript
{
  partnerId: string;
  webhooks: Array<{
    url: string;
    enabled: boolean;
    secret?: string; // HMAC 서명용 시크릿
  }>;
  events: {
    packageReady: boolean;
    closingReportReady: boolean;
    caseCompleted: boolean;
  };
  updatedAt: Timestamp;
}
```

### 2.2 User Notification Settings
`user_notification_settings` 컬렉션 (문서 ID: `userId`)
```typescript
{
  userId: string;
  webhooks: Array<{
    url: string;
    enabled: boolean;
    secret?: string;
  }>;
  events: {
    submissionCompleted: boolean;
    submissionFailed: boolean;
  };
  updatedAt: Timestamp;
}
```

### 2.3 Notification Jobs (큐)
`notification_jobs` 컬렉션
```typescript
{
  type: "webhook";
  target: { userId?: string; partnerId?: string };
  event: "submission.completed" | "submission.failed" | "package.ready" | "closing_report.ready" | "case.completed";
  payload: any; // { caseId, packageId, checksumSha256, error 등 } + webhookConfig
  status: "queued" | "sending" | "sent" | "failed";
  attempts: number;
  nextRunAt: Timestamp;
  lastError?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 3. 서버 처리 로직

### 3.1 Job 큐잉 (Trigger)
이벤트가 발생하는 핵심 비즈니스 로직(워커 또는 API)에서 `enqueueNotification` 함수를 호출하여 `notification_jobs`에 문서를 추가합니다.
- **대상 이벤트**:
  1. `package.ready`: 파트너 패키지 빌드 완료 시 (`partner_package_worker.ts`)
  2. `closing_report.ready`: 파트너 Closing Report 생성 시 (`partner_cases.ts`)
  3. `case.completed`: 파트너 케이스 마감 시 (`partner_cases.ts`)
  4. `submission.completed`: 유저 제출물 처리 완료 시 (`user_submission_worker.ts`)
  5. `submission.failed`: 유저 제출물 처리 실패 시 (`user_submission_worker.ts`)

### 3.2 Delivery 워커 (Retry / Backoff)
`notifyWorker` (1분 주기 스케줄러)가 `queued` 상태이고 `nextRunAt`이 현재 시간 이전인 Job을 처리합니다.
- **최대 재시도 횟수(maxAttempts)**: 5회
- **백오프(Backoff) 전략**: 1분, 5분, 15분, 60분 간격으로 재시도합니다.
- **Audit**: 전송 성공 시 `ops_notification.sent`, 최종 실패 시 `ops_notification.failed` 이벤트로 Ops Audit 로그를 남깁니다.

### 3.3 Webhook 전송 스펙
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Body Payload**:
```json
{
  "event": "package.ready",
  "target": { "partnerId": "..." },
  "payload": {
    "caseId": "...",
    "packageId": "...",
    "checksumSha256": "..."
  },
  "timestamp": "2023-10-01T12:00:00.000Z"
}
```
- **서명 (Signature)**:
  - 설정에 `secret`이 포함된 경우, `body` 문자열 전체를 `secret` 키를 사용하여 `HMAC-SHA256` 알고리즘으로 서명합니다.
  - 생성된 서명은 `X-Signature` 헤더에 `sha256=<hex>` 형식으로 포함되어 전송됩니다.
  - 수신 측에서는 동일한 방식으로 서명을 계산하여 요청의 무결성을 검증할 수 있습니다.

## 4. UI 가이드
### 4.1 Partner Console
- **알림 설정 (Webhooks) 섹션**: 케이스 목록 하단에 위치합니다.
- **이벤트 토글**: 수신할 이벤트를 체크박스로 선택합니다 (Package Ready, Closing Report Ready, Case Completed).
- **웹훅 관리**: 새로운 웹훅 URL과 선택적(Secret) 키를 입력하여 추가할 수 있으며, 기존 웹훅을 삭제할 수 있습니다.

### 4.2 User Web
- **알림 설정 (Webhooks) 섹션**: 제출 목록 하단에 위치합니다.
- **이벤트 토글**: 수신할 이벤트를 체크박스로 선택합니다 (Submission Completed, Submission Failed).
- **웹훅 관리**: Partner Console과 동일하게 웹훅 URL과 Secret을 관리합니다.
