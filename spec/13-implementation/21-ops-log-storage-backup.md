# Ops Log Storage Backup

## 1) 목적
GitHub Repository의 Markdown 파일(PR/Commit) 외에도, 생성된 월별/게이트별 운영 로그(SSOT)를 **Cloud Storage에 2차 백업**하여 보관 안정성을 높이고, Ops Console 등 외부 클라이언트에서 GitHub 권한 없이도 안전하게 다운로드할 수 있는 창구를 제공한다.

## 2) 저장소(Storage) 경로 규칙
모든 백업 파일은 일관된 경로 규칙에 따라 `ops-logs` 최상위 폴더 하위에 덮어쓰기 방식으로 저장된다. 동일한 대상 월에 대해 재실행 시 기존 백업을 최신 버전으로 교체(overwrite)한다.

- **파일 경로**: `ops-logs/{gateKey}/{YYYY-MM}/pilot-ops-log.md`
- **파일명 고정 원칙**: `pilot-ops-log.md`라는 파일명 자체는 기존 문서 체계(스펙)의 일관성을 위해 고정하며, 대신 디렉토리 구조(`{gateKey}`)를 통해 테넌트를 분리한다.
- **메타데이터(Metadata)**: 파일 업로드 시 `gateKey`, `targetMonth`, `generatedAt` 등 추가 컨텍스트를 커스텀 메타데이터로 부여하여 향후 조회/정리에 활용한다.

## 3) 업로드 자동화 (GitHub Actions)
`ops-log-sync` 매트릭스 파이프라인의 **Generate** 스텝 직후에 **Backup to Cloud Storage** 스텝을 삽입한다.
- **스크립트**: `firebase-react/scripts/ops_log_storage_backup.mjs`
- **인증**: Storage 기록 권한이 있는 Service Account Key(`FIREBASE_SERVICE_ACCOUNT_JSON_STORAGE` 권장, 없으면 기존 키 폴백)를 사용하여 `firebase-admin`의 Storage API를 통해 업로드한다.
- **연동**: 앞선 스텝에서 추출한 파일 경로(`SYNC_FILE`), 게이트키(`GATE_KEY`), 대상 월(`TARGET_MONTH`)을 그대로 이어받아 활용한다.

## 4) 다운로드 URL 발급 API
- **엔드포인트**: `GET /v1/ops/reports/:gateKey/ops-log/monthly/download-url?month=YYYY-MM`
- **권한**: 운영자(`isOps`) 전용 API.
- **동작**: 클라이언트가 요청한 `gateKey`와 `month`를 기반으로 Storage Object 경로를 계산하고, 해당 파일이 존재하는지 검증(`exists()`)한다. 파일이 확인되면, 15분 만료의 **Signed URL**을 발급하여 반환한다.
- **에러**: 파일이 존재하지 않거나 month 파라미터가 유효하지 않으면 404/400 에러를 반환한다.

## 5) Ops Console 연동
- "오늘 운영 요약" 탭의 날짜 선택 영역 아래에 **[Cloud Storage 백업본]** 패널을 신설했다.
- 현재 선택된 `gateKey`와 `summaryDate`의 **월(YYYY-MM)**을 기반으로 `[월별 운영 로그 다운로드 링크 생성]` 버튼을 클릭할 수 있다.
- 성공적으로 Signed URL을 받아오면 다운로드용 하이퍼링크가 즉시 노출되어 클릭 한 번으로 백업본을 로컬에 저장할 수 있다.