# 64. B2G Tax and Fee Payment (B2G 세금 및 수수료 납부)

## 1. 개요 (Overview)
본 문서는 AgentRegi 시스템에서 정부 및 공공기관(B2G)으로의 세금 및 공과금(수수료) 납부를 자동화하고 추적하기 위한 구현 세부 사항을 정의합니다. 주로 법인 설립 및 각종 등기 과정에서 발생하는 등록면허세, 지방교육세, 대법원 증지대 등의 납부 및 영수증 처리 프로세스를 다룹니다.

## 2. 시스템 아키텍처 (System Architecture)
- **Payment Gateway (PG) / 펌뱅킹 연동:** B2G 결제를 지원하는 금융망 또는 펌뱅킹 API를 통한 자동 이체 처리.
- **납부 정보 파싱:** 위택스(Wetax), 이택스(Etax), 인터넷등기소 등에서 발급된 납부서(전자납부번호, 가상계좌) 정보를 파싱 및 시스템 등록.
- **증빙 서류(납부확인서) 자동 수집:** 결제 완료 후, 전자납부번호를 이용해 해당 기관의 납부확인서(영수증)를 스크래핑하여 PDF 형태로 자동 보관.

## 3. 핵심 워크플로우 (Core Workflow)
1. **과세표준 및 세액 산출:** 자본금, 본점 소재지(과밀억제권역 여부 등) 데이터를 바탕으로 예상 세액을 사전 계산.
2. **납부 정보 수신 및 등록:** 신고 완료 후 발급된 관세청/지자체 납부서의 핵심 정보(전자납부번호, 청구 금액)를 시스템에 등록.
3. **결제 실행 (Payment Execution):** 시스템에 등록된 기업/대리인의 출금 계좌를 통해 B2G 결제 API를 호출하여 세금 납부.
4. **결과 검증 및 영수증 저장:** 결제 성공 응답을 수신하면 영수증을 스크래핑하여 Firebase Storage 등에 업로드하고 DB 상태를 업데이트.

## 4. 데이터 모델 (Firestore)

### Collection: `b2g_fee_payments`
B2G 제출(`b2g_submissions`) 건에 종속되는 공과금/세금 납부 정보를 저장합니다.

```typescript
interface B2gFeePayment {
  id: string;
  submissionId: string;   // 참조: b2g_submissions 문서 ID
  caseId: string;
  partnerId: string;
  
  feeType: "tax" | "court_fee" | "other"; // 세금, 법원 수수료 등
  agency: "WETAX" | "IROS" | "HOMETAX";
  paymentNumber: string;  // 전자납부번호
  amount: number;         // 납부 금액
  
  status: "pending" | "processing" | "paid" | "failed";
  paymentMethodId?: string; // 사용된 파트너 빌링키 ID
  receiptUrl?: string;      // 납부 완료 후 발급된 영수증(PDF/이미지) Storage 경로
  
  errorMessage?: string;  // 결제 실패 시 사유
  createdAt: Timestamp;
  updatedAt: Timestamp;
  paidAt?: Timestamp;
}
```

## 5. API 명세 (HTTP API Contract)

파트너 콘솔 및 내부 운영 시스템에서 사용할 REST API 명세입니다. (`/v1/b2g` 라우터 하위)
모든 변경 API는 멱등성 보장을 위해 `Idempotency-Key` 헤더를 필요로 합니다.

### 5.1 납부 대상 요금 목록 조회
- **GET** `/v1/b2g/submissions/{submissionId}/fees`
- **역할**: 특정 B2G 제출 건에 부과된 공과금/수수료 납부 내역을 반환합니다.

### 5.2 수동/강제 납부 트리거
- **POST** `/v1/b2g/fees/{feeId}/pay`
- **역할**: 자동 납부 워커가 실패(잔액 부족 등)했거나 파트너가 즉시 결제를 원할 때, 수동으로 결제 프로세스를 큐잉(`processing`)합니다.

### 5.3 납부 영수증 조회 (다운로드)
- **GET** `/v1/b2g/fees/{feeId}/receipt`
- **역할**: 납부가 완료된 건에 대해 증빙 영수증(Signed URL)을 반환합니다.

## 6. 예외 처리 및 재시도 정책 (Error Handling & Retry)
- **결제 실패 (잔액 부족, 한도 초과 등):** 실패 즉시 상태를 `FAILED`로 변경하고, 고객에게 알림(카카오톡/이메일)을 발송하여 수동 입금을 유도합니다.
- **정부 포털 타임아웃 및 점검 시간:** 관공서 금융망 점검 시간(통상 23:30 ~ 00:30)을 고려하여 해당 시간대에는 결제 요청을 메시지 큐(Message Queue)에 대기시키고 점검 종료 후 자동 재시도합니다.
- **멱등성(Idempotency) 보장:** 중복 출금 및 이중 결제를 방지하기 위해 `electronicPayNum`(전자납부번호) 및 `id`를 멱등성 키(Idempotency Key)로 활용합니다.