# 65. B2B API (Open API & Partnerships)

## 1. 개요 (Overview)
본 문서는 AgentRegi 플랫폼을 외부 기업(은행, 회계 SaaS, 부동산 플랫폼 등)의 시스템과 연동하기 위한 **EP-14 B2B Open API**의 구현 세부 사항을 정의합니다. 
기업 파트너가 자체 시스템 내에서 AgentRegi의 케이스(법인 설립, 등기, 서류 발급 등)를 프로그래밍 방식으로 생성 및 조회하고, 상태 변화를 실시간으로 수신(Webhook)할 수 있도록 지원하여 완전한 자동화 파트너십(Zero-Touch)을 구축하는 것이 핵심 목표입니다.

## 2. 주요 Use Case (Target Scenarios)
- **금융권(은행/대출) 연동**: 대출 심사 완료 후, 담보권 설정 등기 등 필요한 법무 케이스를 AgentRegi API를 통해 자동으로 생성하고 진행 상태를 추적합니다.
- **세무/회계 플랫폼 연동**: 세무 기장 고객의 법인 설립 및 변경 등기 절차를 SaaS 플랫폼 내에서 직접 시작하고, 완료된 등기부등본 등의 결과물을 API로 즉시 수신합니다.
- **사내 HR/총무 시스템 연동**: 임원 변경, 본점 이전 등 정기적인 법인 등기 업무를 사내 그룹웨어(ERP)와 연동하여 자동으로 트리거합니다.

## 3. 인증 및 보안 (Authentication & Security)
B2B API는 외부 시스템과의 통신을 담당하므로 강력한 보안 및 접근 제어 정책이 적용됩니다.

- **API Key 및 Client 관리**: 파트너(기업) 단위로 고유한 `clientId`와 `clientSecret`을 발급하여 인증을 수행합니다.
- **인증 방식**: Bearer Token (JWT) 방식을 사용합니다. `clientSecret`을 통해 단기 유효(Short-lived) Access Token을 발급받아 실제 API 호출에 사용합니다.
- **Rate Limiting**: 서버 과부하를 방지하기 위해 API 엔드포인트 및 파트너 티어별로 호출 제한(예: 100 requests / minute)을 적용합니다. (Redis 또는 API Gateway 활용)
- **IP 화이트리스트 (White-listing)**: 보안 강화를 위해 기업 고객이 지정한 허용된 IP 대역에서만 API 호출이 가능하도록 설정할 수 있습니다.

## 4. 데이터 모델 (Firestore)

### Collection: `b2b_api_clients`
B2B API를 사용하는 기업 고객 및 인증 메타데이터를 관리합니다.

```typescript
interface B2bApiClient {
  id: string;              // Client ID
  companyName: string;     // 파트너 기업명
  hashedSecret: string;    // Bcrypt 등으로 해시된 Secret Key (평문 저장 금지)
  status: "active" | "suspended" | "revoked";
  allowedIps?: string[];   // IP 화이트리스트 (옵션)
  rateLimitTier: "basic" | "premium" | "enterprise"; // Rate Limiting 및 과금 기준
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: `b2b_webhooks`
기업 파트너가 등록한 Webhook 엔드포인트 및 구독 이벤트를 관리합니다.

```typescript
interface B2bWebhook {
  id: string;
  clientId: string;        // 참조: b2b_api_clients 문서 ID
  endpointUrl: string;     // Webhook 수신 URL
  secretKey: string;       // Webhook Payload Signature 검증용 Secret
  subscribedEvents: string[]; // 예: ["case.created", "case.status_changed", "document.uploaded"]
  status: "active" | "failing" | "disabled";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 5. 핵심 API 명세 (HTTP API Contract)

모든 API는 `https://api.agentregi.com/v1/b2b` 하위 라우터를 사용합니다.

### 5.1 인증 (Authentication)
- **POST** `/auth/token`
  - **역할**: `clientId`와 `clientSecret`을 제공하여 Access Token을 발급합니다.
  - **Response**: `{ "accessToken": "jwt_string", "expiresIn": 3600 }`

### 5.2 케이스 관리 (Case Management)
- **POST** `/cases`
  - **역할**: 새로운 등기/법무 케이스를 생성합니다.
  - **Payload**: 케이스 유형(법인설립, 근저당설정 등), 고객 정보, 필수 메타데이터.
  - **Response**: 생성된 `caseId` 및 현재 상태(`pending`).
- **GET** `/cases/{caseId}`
  - **역할**: 특정 케이스의 현재 진행 상태, 예상 소요 시간(ETA), 배정된 파트너(법무사) 정보를 조회합니다.

### 5.3 문서 및 증빙 (Documents & Evidence)
- **POST** `/cases/{caseId}/documents`
  - **역할**: 케이스 진행에 필요한 서류(신분증 사본, 정관 등)를 업로드합니다. (Signed URL 방식을 통해 클라이언트가 직접 스토리지에 업로드하는 방식 병행)
- **GET** `/cases/{caseId}/documents`
  - **역할**: 완료된 케이스의 최종 결과물(등기부등본, 완료보고서 등) 다운로드 링크를 제공합니다.

### 5.4 Webhook 관리 (Webhook Management)
- **POST** `/webhooks`
  - **역할**: 특정 이벤트 발생 시 알림을 받을 대상 Webhook URL을 등록합니다.
- **GET** `/webhooks`
  - **역할**: 등록된 Webhook 목록 및 현재 활성화 상태를 조회합니다.

## 6. Webhook 전송 및 재시도 정책 (Webhook Delivery)
- **서명 검증 (Signature Verification)**: 플랫폼이 발송하는 모든 Webhook 요청의 헤더에는 `X-AgentRegi-Signature`가 포함됩니다. 파트너는 발급받은 Webhook Secret을 이용해 Payload의 무결성을 반드시 검증해야 합니다.
- **재시도 (Retry Policy)**: 파트너 서버가 `2xx` 응답을 반환하지 않거나 타임아웃이 발생할 경우, 지수 백오프(Exponential Backoff) 전략에 따라 최대 5회(예: 1분, 5분, 30분, 2시간, 6시간 후) 재시도합니다.
- **Dead Letter Queue (DLQ)**: 최대 재시도 횟수를 초과한 실패 이벤트는 DLQ에 보관되며, 파트너 콘솔에서 수동으로 재전송(Replay)할 수 있습니다.

## 7. 운영 및 모니터링 (Ops & Monitoring)
- **API 사용량 대시보드**: 운영 콘솔(Ops Control Panel) 및 파트너 콘솔에 월별 API 호출량, 응답 상태 코드(4xx, 5xx) 비율을 확인할 수 있는 모니터링 대시보드를 제공합니다.
- **과금 연동 (Billing)**: `rateLimitTier` 및 실제 API 호출량, API로 생성된 케이스 건수를 기반으로 월 단위 B2B 후불 청구(Invoicing) 프로세스를 연동합니다 (Phase 3 결제/정산 시스템 확장).