# Evidence 업로드, 검증 및 다운로드

## 1. 개요
파트너와 사용자가 문서를 제출하고 확인할 때, 보안성과 안정성을 확보하기 위해 Cloud Storage의 **서명된 URL(Signed URL)** 방식을 사용합니다. 
업로드된 파일은 백그라운드 워커를 통해 크기, 형식, 바이러스 여부 등을 검증(Validation)한 뒤, 승인된 증거물만 패키지 생성에 활용될 수 있도록 강제합니다.

## 2. 파일 저장 경로 규칙
모든 증거물 파일은 다음 경로 규칙을 따릅니다.
- **경로**: `evidence/{partnerId}/{caseId}/{evidenceId}/{filename}`
- 이 규칙을 통해 파트너 간 데이터가 물리적으로 격리되며, 권한 없는 사용자의 직접 접근을 차단합니다.

## 3. 업로드 및 다운로드 플로우

### 3.1 업로드 (파트너)
1. **URL 발급**: `POST /v1/partner/cases/:caseId/evidences/upload-url`
   - 클라이언트가 파일명, 크기, 타입을 서버로 전송.
   - 서버는 15분짜리 `write` 권한의 Signed URL을 발급하고, `evidences` 문서(status: `pending`)를 생성.
2. **파일 전송**: 클라이언트가 브라우저에서 직접 Storage Signed URL로 `PUT` 요청을 보내어 파일을 업로드.
3. **완료 확정**: `POST /v1/partner/cases/:caseId/evidences/:evidenceId/complete`
   - 업로드가 끝난 후 서버에 완료를 알림.
   - 서버는 Storage에 파일이 실제로 존재하는지 확인한 뒤, 상태를 `uploaded`로 변경.

### 3.2 다운로드 (파트너 / 사용자)
- **파트너**: `POST /v1/partner/cases/:caseId/evidences/:evidenceId/download-url`
- **사용자**: `POST /v1/user/submissions/:id/evidences/:evidenceId/download-url`
- 서버는 요청자의 권한(Scope)과 파일 존재 여부를 확인한 후, 15분짜리 `read` 권한의 Signed URL을 발급합니다.
- 클라이언트는 이 URL을 새 창에서 열거나 `<a>` 태그로 연결하여 파일을 다운로드합니다.

## 4. 백그라운드 검증 워커 (Validation Worker)
- **Worker**: `partnerEvidenceWorker` (매 1분마다 실행)
- **대상**: 상태가 `uploaded`인 `evidences` 문서.
- **수행 작업**:
  1. Storage에 파일이 있는지 다시 한 번 확인.
  2. 메타데이터를 읽어 `contentType`이 허용된 형식(pdf, png, jpg)인지 검증.
  3. `sizeBytes`가 25MB 이하인지 검증.
  4. (옵션) 외부 백신 엔진 API를 연동하여 `scanStatus` 갱신 (MVP에서는 5% 확률로 악성코드 시뮬레이션).
- **결과**:
  - 통과 시: `status`를 `validated`로 변경.
  - 실패 시: `status`를 `failed`로 변경.

## 5. 패키지 생성 시 제약 조건
패키지 빌드 워커(또는 패키지 생성 API)는 **최소 1개 이상의 `validated` 상태 증거물이 존재할 때만** 동작합니다. 검증되지 않았거나 실패한 증거물만 있는 경우에는 패키지 생성이 거부(`FAILED_PRECONDITION`)됩니다.