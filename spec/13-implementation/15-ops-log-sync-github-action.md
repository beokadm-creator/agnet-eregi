# Ops Log Sync (Firestore → spec 마크다운) 운영 가이드

목적: Firestore `ops_daily_logs`(SSOT)에 저장된 일일 운영 로그를 기반으로, 저장소의 `spec/00-index/YYYY-MM-pilot-ops-log.md` 파일을 매일 자동 갱신하고 PR로 올린다.

## 1) 동작 개요

- 트리거
  - 매일 KST 00:10 (GitHub Actions cron은 UTC 기준으로 `10 15 * * *`)
  - 수동 실행(workflow_dispatch) + `target_month` 입력 지원
- 처리
  1. Firestore에서 `ops_daily_logs` 문서를 월 단위로 조회 (문서 ID: `YYYY-MM-DD`)
  2. `spec/00-index/YYYY-MM-pilot-ops-log.md`의 마커 영역만 갱신
     - `<!-- OPS_LOG_AUTO:START -->` ~ `<!-- OPS_LOG_AUTO:END -->`
  3. 변경이 있을 때만 커밋 후 PR 생성

## 2) 필요한 GitHub Secrets

### `FIREBASE_SERVICE_ACCOUNT_JSON` (필수)

Firebase Admin SDK용 서비스 계정 JSON을 **그대로** Secrets에 저장한다.

- GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret
- Name: `FIREBASE_SERVICE_ACCOUNT_JSON`
- Value: 서비스 계정 JSON 전체

권장 권한(최소):
- Firestore 읽기 권한(SSOT 조회)

## 3) 워크플로우 파일

- `.github/workflows/ops-log-sync.yml`

권한:
- `contents: write` (브랜치 push)
- `pull-requests: write` (PR 생성)

## 4) 로컬에서 수동 실행(디버깅)

```bash
# repo root 기준
export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ... }'
export TARGET_MONTH="2026-04"
node firebase-react/scripts/ops_log_sync.mjs
```

실행 후 아래 파일이 갱신된다:
- `spec/00-index/${TARGET_MONTH}-pilot-ops-log.md`

## 5) 파일 포맷/주의사항

- 마크다운 파일은 **마커 영역만 자동 갱신**된다.
- 운영자가 수동으로 편집해야 하는 내용이 있다면 마커 바깥 영역에 작성한다.

## 6) 주요 하드닝 기능 (v2)

- **라벨 자동 생성**: 레포지토리에 `ops`, `automation` 라벨이 없으면 자동으로 생성 후 부착된다.
- **PR 재사용**: 동일한 날짜(`bot/ops-log-sync-YYYY-MM-DD` 브랜치)에 재실행 시, 새 PR을 만들지 않고 기존 PR의 본문을 업데이트하며 갱신 코멘트를 남긴다.
- **에러 메시지 강화**: `FIREBASE_SERVICE_ACCOUNT_JSON`의 파싱 실패, 필수 필드 누락, 또는 Firestore 권한 부족(`PERMISSION_DENIED`) 시 워크플로우 로그에 명확한 원인과 가이드가 출력된다.

