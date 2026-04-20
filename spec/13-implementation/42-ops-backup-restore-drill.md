# Ops Backup & Restore Drill (백업 자동화 및 복구 리허설)

## 1. 개요
데이터 보존 주기(Retention) 적용으로 오래된 데이터가 자동으로 삭제되는 상황에서,
운영 실수나 장애 발생 시 데이터를 복구할 수 있는 안정적인 체계를 갖추는 것이 목표입니다.

## 2. 백업 스케줄
- **워커명**: `opsBackupWorker`
- **주기**: 매주 일요일 새벽 4시 (KST)
- **로직**:
  - `gcloud firestore export`와 동일한 역할을 하는 Cloud Firestore Admin API (REST)를 호출합니다. (현재 MVP에서는 로깅만 구현됨)
  - `ops_backup_runs` 컬렉션에 백업 시도 상태(`started`)를 기록.
  - 성공/실패 여부를 `ops_audit_events`에 기록 (`ops_backup.run`).
- **저장소**: Google Cloud Storage (`gs://${PROJECT_ID}-firestore-backup`)

## 3. 복구 (Restore) Runbook
실제 장애 발생 시 복구를 진행하기 위한 매뉴얼입니다.

### 3.1. 전제 조건
- 복구 대상이 되는 컬렉션(예: `forms`, `cases`, `ops_gate_settings`)의 정확한 이름을 파악.
- 복구 시점의 타임스탬프(백업 폴더 경로) 확인.

### 3.2. 복구 명령어
Google Cloud Console Cloud Shell을 엽니다.

```bash
# 특정 컬렉션만 복구 (예: forms)
gcloud alpha firestore import gs://[PROJECT_ID]-firestore-backup/2026-04-20T04:00:00Z \
  --collection-ids=forms
```

### 3.3. 주의 사항
- 복구 대상 컬렉션의 기존 데이터는 삭제되지 않고 병합(Merge)됩니다.
- 삭제된 데이터를 살리는 목적이라면 병합이 유용하지만, 잘못된 데이터를 덮어쓰려면 복구 전 대상 컬렉션(또는 특정 문서)을 정리해야 합니다.

## 4. 복구 리허설 (Restore Drill)
- **목표**: 분기별 1회 이상 운영 환경(또는 Staging)에서 복구 프로세스를 검증.
- **절차**:
  1. 임의의 컬렉션(예: `ops_dummy`) 생성 및 데이터 적재.
  2. 수동 백업 트리거 (`POST /v1/ops/backup/trigger`).
  3. `ops_dummy` 데이터 강제 삭제.
  4. Runbook 명령어를 통해 데이터 복원 및 검증.
  5. Ops Console의 체크리스트에 결과를 기록 (향후 UI 반영 예정).