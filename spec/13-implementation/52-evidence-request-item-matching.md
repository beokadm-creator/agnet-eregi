# Evidence Request Item Matching & Auto Actions

## 1. 개요
추가 서류 요청(Evidence Request) 기능의 정교화를 위해, MVP의 단순 파일 1개 업로드 조건을 발전시켜 **항목(itemCode) 단위 매칭**을 도입합니다. 사용자는 각 항목별로 파일을 업로드해야 하며, 모든 필수(required) 항목이 제출되면 요청이 완료(`fulfilled`)됩니다. 
요청 완료 시 시스템은 즉시 최신 패키지를 자동 재생성(`regenerate`)하고 검증(`validate`)하는 후속 작업을 트리거합니다.

## 2. 데이터 모델 변경

### 2.1 `EvidenceRequestItem` 인터페이스 추가
`evidence_requests.items` 배열의 각 요소가 다음 속성을 가집니다.
```typescript
interface EvidenceRequestItem {
  code: string;
  titleKo: string;
  required: boolean;
  status: "open" | "fulfilled";
  evidenceId?: string; // 제출된 파일의 evidence ID
  fulfilledAt?: Timestamp;
}
```

### 2.2 `CaseEvidence` 확장
사용자가 증거 파일을 업로드할 때, 어떤 요청의 어느 항목인지 매핑하기 위해 `itemCode`가 추가됩니다.
```typescript
interface CaseEvidence {
  // ...기존 속성들
  source?: "partner" | "user";
  requestId?: string;
  itemCode?: string; // 추가된 속성
}
```

## 3. API 및 워커 동작 변경

### 3.1 사용자 업로드 API (`POST /v1/user/submissions/:id/evidences/upload-url`)
- **Validation**: 
  - `requestId`가 제공될 경우 `itemCode`도 필수로 요구됩니다.
  - 해당 `requestId`의 `items` 배열에 `itemCode`가 존재하는지 확인합니다.
  - 해당 `itemCode`의 `status`가 이미 `fulfilled`라면 `409 CONFLICT` 오류를 반환하여 중복 업로드를 방지합니다.

### 3.2 검증 워커 (`partner_evidence_worker.ts`)
- **Item Matching**: 증거물(`evidence`)이 `validated` 상태로 변경될 때, `requestId`와 `itemCode`가 존재하면 `evidence_requests` 문서를 트랜잭션으로 업데이트합니다.
- **상태 업데이트**:
  - 일치하는 `item`의 `status`를 `fulfilled`로 변경하고, `evidenceId`와 `fulfilledAt`을 기록합니다.
  - 배열 내의 모든 `required === true`인 항목들의 상태가 `fulfilled`인지 확인합니다.
- **Request Fulfilled**:
  - 모든 필수 항목이 충족되었다면, 전체 요청의 `status`를 `fulfilled`로 변경합니다.
  - 이후 파트너에게 알림(`evidence.fulfilled`)을 발송합니다.

## 4. 자동 후속 작업 (Auto Actions)
요청이 완전히 충족(`fulfilled`)되는 트랜잭션 내에서 **자동 재생성(Regenerate)** 이 트리거됩니다.

1. **자동 Regenerate**:
   - 해당 `caseId`에 연결된 최신 패키지(가장 최근에 생성된 `package`)를 조회합니다.
   - 패키지의 상태를 `queued`로 변경하고 에러 내역을 초기화하여 `partner_package_worker`가 다시 패키징을 수행하도록 유도합니다.

2. **자동 Validate**:
   - `partner_package_worker.ts`에서 패키지 생성이 완료(`ready`)된 후, 곧바로 검증(`validate`) 로직이 연달아 실행되도록 코드가 개선되었습니다.
   - 증거물 내 여권(passport) 등 필수 서류 포함 여부를 판단해 `validation` 상태(`pass` 또는 `fail`)를 기록합니다.

> **참고**: Closing Report 재생성은 리스크 관리를 위해 수동 생성을 기본(default) 정책으로 유지합니다.

## 5. UI 가이드
- **User Web**:
  - 요청 목록에 각 항목(`items`)이 리스트업되며, 항목 옆에 개별 업로드 버튼이 제공됩니다.
  - 제출이 완료된 항목은 취소선과 함께 `✅ 완료됨` 표시가 나타나며, 업로드 버튼이 비활성화됩니다.
- **Partner Console**:
  - 요청 내역에 각 항목의 상태(`✅`)가 명확히 표시되어, 파트너가 어떤 서류가 제출되었고 누락되었는지 한눈에 파악할 수 있습니다.
