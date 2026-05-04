# Phase 6: 초자동화 및 B2G 연동 (Hyper-Automation & B2G Integration)

## 1. 개요 (Overview)
Phase 6의 핵심 목표는 플랫폼 내에서 생성된 서류 패키지(Case Package)를 대법원 인터넷등기소(IROS), 정부24, 국세청 홈택스 등 공공기관 시스템에 **자동으로 제출(E-Filing)**하고 처리 결과를 플랫폼으로 동기화하는 것입니다. 이를 통해 파트너(법무사, 변호사 등)의 수작업을 완전히 제거(Zero-Touch)하고, 사용자에게 실시간 진행 상태를 투명하게 제공합니다.

## 2. 에픽 및 스토리 구성 (EP-13 B2G Integration)

### EP-13-01: 공공기관 인증서 및 계정 중앙 관리 (Credential Management)
- **Story**: 파트너는 플랫폼에 B2G 제출을 위한 인증서(공동인증서 등)와 자격 증명을 한 번만 안전하게 등록할 수 있다.
- **AC (수용기준)**:
  1. 인증서 파일 및 비밀번호는 GCP Secret Manager (또는 HashiCorp Vault)를 통해 암호화되어 보관된다. DB에 평문으로 저장되지 않는다.
  2. `POST /v1/partners/credentials` 호출 시 유효성 검사 후 `b2g_credentials`에 메타데이터만 저장된다.
  3. 플랫폼은 B2G 전송 워커가 실행될 때만 임시로 복호화된 자격 증명에 접근할 수 있다.

### EP-13-02: B2G 전자신청 패키지 자동 전송 (E-Filing Submission)
- **Story**: 케이스 패키지가 `ready` 상태가 되면, 플랫폼 워커가 B2G 시스템 규격에 맞춰 데이터를 매핑하고 자동으로 전자신청을 접수한다.
- **AC (수용기준)**:
  1. 패키지 상태가 `ready`가 되면 `B2G_SUBMISSION_QUEUED` 이벤트가 발행된다.
  2. 전송 워커는 공공기관 API 또는 RPA 엔진을 통해 폼 데이터를 입력하고 증빙 서류를 업로드한다.
  3. 접수가 완료되면 정부 시스템에서 발급한 `receiptNumber`(접수번호)를 `b2g_submissions`에 업데이트한다.

### EP-13-03: 공과금 및 세금 자동 납부 연동 (Tax & Fee Payment)
- **Story**: 제출 시 발생하는 등록면허세, 대법원 수입증지 등의 공과금을 플랫폼이 자동으로 파싱하여 가상계좌 발급 또는 자동 납부를 수행한다.
- **AC (수용기준)**:
  1. B2G 폼 입력 중 과세 표준에 따른 세액이 확정되면 상태가 `TAX_PAYMENT_REQUIRED`로 전환된다.
  2. 파트너 예치금(또는 연동된 결제수단)을 통해 즉시 납부 API가 호출되거나, 사용자에게 가상계좌 납부 알림톡이 발송된다.
  3. 납부 완료 확인 후 최종 제출(Submit)이 트리거된다.

### EP-13-04: 공공기관 처리 상태 폴링 및 동기화 (Status Polling & Sync)
- **Story**: 제출된 신청 건의 상태(조사 대기, 보정 명령, 등기 완료)를 시스템이 주기적으로 확인하여 플랫폼 UI에 동기화한다.
- **AC (수용기준)**:
  1. Polling 워커가 1시간 간격으로 미완료 건(`status: submitted`)의 상태를 공공기관 시스템에서 조회한다.
  2. 보정 명령(RFI) 발생 시 `b2g_action_required` 상태로 변경되고, 파트너 및 운영팀에게 긴급 Webhook/슬랙 알림이 발송된다.
  3. 최종 완료 시 `completed` 상태로 변경되며, 발급된 결과물(예: 등기부등본)이 사용자 워크스페이스에 자동 저장된다.

---

## 3. 데이터 모델 (Firestore 스키마)

### 3.1 `b2g_credentials` (인증서 메타데이터)
파트너의 B2G 연동 자격 증명을 관리합니다.
- `id`: string
- `partnerId`: string
- `agencyType`: "IROS" | "HOMETAX" | "GOV24"
- `certId`: string (Secret Manager 참조용 ID)
- `expiresAt`: Timestamp
- `status`: "active" | "expired" | "revoked"

### 3.2 `b2g_submissions` (제출 트래킹)
공공기관 전송 및 상태 내역을 추적합니다.
- `id`: string (submissionId)
- `caseId`: string
- `packageId`: string
- `agency`: "IROS" | "HOMETAX"
- `status`: "queued" | "submitting" | "submitted" | "action_required" | "completed" | "failed"
- `receiptNumber`: string | null (접수번호)
- `feeDetails`: { totalAmount: number, isPaid: boolean, paymentMethod: string }
- `createdAt`, `updatedAt`: Timestamp

---

## 4. API 명세 (HTTP API Contract)

### 4.1 B2G 제출 트리거
`POST /v1/b2g/submissions`
- **Request**: 
  ```json
  {
    "caseId": "case_123",
    "packageId": "pkg_456"
  }
  ```
- **Response**:
  ```json
  {
    "ok": true,
    "data": {
      "submissionId": "b2g_789",
      "status": "queued"
    }
  }
  ```

### 4.2 B2G 제출 상태 조회
`GET /v1/b2g/submissions/{submissionId}`
- **Response**:
  ```json
  {
    "ok": true,
    "data": {
      "status": "action_required",
      "agencyStatus": "보정명령발령",
      "receiptNumber": "2026-12345",
      "actionDetails": "주주명부 누락으로 인한 보정 요청"
    }
  }
  ```

---

## 5. 아키텍처 및 예외 처리 가이드 (Ops Runbook 연계)

- **공공기관 점검 시간 대응**: IROS(인터넷등기소) 등은 주말 및 심야(23:00~06:00) 점검이 잦습니다. 워커는 해당 시간대 진입 시 작업을 일시 중지(Pause)하고 점검 해제 시점에 재개(Resume)하도록 스케줄링(Dead Letter Queue 활용)되어야 합니다.
- **보정 명령(RFI) 에스컬레이션**: B2G 측에서 보정 명령이 떨어지면, 시스템은 이를 `SLA 브리치`에 준하는 중요도로 취급하여 파트너 및 플랫폼 운영자(Ops)에게 즉시 에스컬레이션(Phase 2의 수동검토 큐 연동)해야 합니다.
- **망분리 및 IP 화이트리스트**: 공공기관 API 또는 스크래핑 연동 시 고정 IP를 요구하는 경우가 많으므로, B2G 전송 워커는 Cloud NAT를 통해 고정 외부 IP(Egress)를 할당받아 통신해야 합니다.
