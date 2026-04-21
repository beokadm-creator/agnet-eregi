# Package Artifact ZIP & Checksum

## 1. 개요
파트너 케이스의 `validated` 증거 파일들을 서버에서 실제로 ZIP으로 묶어 Storage에 업로드하고, 무결성(SHA256)을 계산해 저장/배포합니다.

## 2. Artifact 스토리지 규칙
- 경로: `artifacts/{partnerId}/{caseId}/{packageId}/submission_package.zip`
- 메타데이터
  - `contentType`: `application/zip`
  - `cacheControl`: `private, max-age=0, no-store`

## 3. ZIP 구조
- `/manifest.json`
  - `caseId`, `packageId`, `partnerId`, `createdAt`
  - `evidences[]`: `evidenceId`, `filename`, `contentType`, `sizeBytes`, `sha256`, `storagePath`
- `/README.txt`
- `/evidences/<evidenceId>/<originalFilename>`

## 4. 빌드 입력 및 제약
- 입력: `evidences where caseId == ... and status == "validated"`
- 제약
  - validated evidence가 0개면 `FAILED_PRECONDITION`
  - evidence 개수 및 총 크기 제한(서버 메모리 보호 목적)

## 5. 무결성(Checksum)
- evidence 파일 SHA256: 원본 파일 바이트 기준으로 계산 후 `manifest.json`에 기록
- ZIP SHA256: 생성된 ZIP 바이트 기준으로 계산 후 `packages.checksumSha256`에 저장
- 다운로드 API 응답에도 checksum을 포함하여, 클라이언트가 별도로 검증할 수 있도록 함

## 6. 서버 API
### 6.1 파트너 ZIP 다운로드 URL 발급
- `POST /v1/partner/cases/:caseId/packages/:packageId/download-url`
- 응답: `{ downloadUrl, checksumSha256 }`
- 스코프: `partnerId` + `caseId` + `packageId` 일치 필수

### 6.2 사용자 ZIP 다운로드 URL 발급
- `POST /v1/user/submissions/:id/package/download-url`
- 응답: `{ downloadUrl, checksumSha256 }`
- 스코프: `userId` → `submission` → `caseId/packageId` 연동을 통해 권한 확인

## 7. 상태 전이
- `queued → building → ready/failed`
- `ready` 시 저장 필드
  - `artifactPath`
  - `checksumSha256`
*** End Patch"}}`}
