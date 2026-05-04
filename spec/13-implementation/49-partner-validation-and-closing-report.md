# Partner Validation and Closing Report

## 1. 개요
파트너가 패키지를 생성한 이후, 해당 패키지가 유효한지 검증(Validation)하고 최종적으로 Closing Report(DOCX)를 생성하여 케이스를 마감(Completed)하는 플로우입니다.

## 2. Package Validation
패키지 빌드가 완료된 후(상태가 `ready`일 때), 시스템 또는 파트너가 수동으로 패키지의 유효성을 검사합니다.

### 2.1 데이터 모델
`packages` 문서에 `validation` 필드가 추가됩니다.
```json
{
  "validation": {
    "status": "not_run" | "pass" | "fail",
    "missing": [
      { "code": "MISSING_PASSPORT", "messageKo": "여권 사본이 누락되었습니다." }
    ],
    "validatedAt": "Timestamp"
  }
}
```

### 2.2 API
- `POST /v1/partner/cases/:caseId/packages/:packageId/validate`
- **조건**: 
  - 패키지 상태가 `ready`여야 합니다.
  - `artifactPath`와 `checksumSha256`이 존재해야 합니다.
  - 케이스 내에 `validated` 상태의 증거물이 1개 이상 있어야 합니다.
- **결과**: 규칙에 따라 `pass` 또는 `fail` 상태를 기록하며, 실패 시 `missing` 목록을 함께 저장합니다.

## 3. Closing Report (DOCX)
패키지 검증이 통과(`pass`)된 경우, 최종 마감 보고서를 생성할 수 있습니다.

### 3.1 데이터 모델
`cases` 문서에 `closingReport` 필드가 추가됩니다.
```json
{
  "closingReport": {
    "status": "not_generated" | "ready" | "failed",
    "artifactPath": "reports/{partnerId}/{caseId}/closing_report.docx",
    "checksumSha256": "...",
    "error": { "message": "..." },
    "updatedAt": "Timestamp"
  }
}
```

### 3.2 API
- `POST /v1/partner/cases/:caseId/reports/closing/generate`
  - **조건**: 연결된 패키지의 `validation.status`가 `pass`여야 합니다.
  - **동작**: `docx` 라이브러리를 사용해 보고서를 생성하고 Storage에 저장합니다. 파일의 SHA256 체크섬을 계산하여 DB에 기록합니다.
- `POST /v1/partner/cases/:caseId/reports/closing/download-url`
  - Storage Signed URL(`read` 권한, 15분 만료)과 `checksumSha256`을 반환합니다.

## 4. Case 마감 (Completed)
Closing Report가 생성되면 케이스를 마감할 수 있습니다.

### 4.1 상태 전이
`cases.status`에 `completed` 상태가 추가되었습니다.

### 4.2 API
- `POST /v1/partner/cases/:caseId/complete`
  - **조건**: `closingReport.status`가 `ready`여야 합니다.
  - **동작**: 케이스 상태를 `completed`로 변경합니다. 이후 케이스 내 리소스(증거물 추가, 패키지 재생성 등)의 상태 변경이 제한될 수 있습니다.

## 5. UI 가이드 (Partner Console)
- **Validation 카드**: 패키지가 `ready` 상태일 때 나타납니다. `Validate` 버튼을 통해 검증을 실행하고, 통과 여부 및 누락 항목을 표시합니다.
- **Closing Report 섹션**: 검증이 완료된 후 활성화됩니다. `Generate Report` 버튼으로 DOCX를 생성하고, 완료 시 `Download DOCX` 버튼과 체크섬 복사 기능을 제공합니다.
- **Mark Case Completed 버튼**: Closing Report가 `ready` 상태일 때 활성화됩니다. 클릭 시 확인(Confirm) 후 케이스를 마감 처리합니다. 마감된 케이스는 상태가 `COMPLETED`로 표시됩니다.
