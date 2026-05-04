# Ops Data Retention (데이터 보관 및 자동 정리 정책)

## 1. 개요
운영 과정에서 발생하는 각종 로그, 큐(Job), 사건(Incident) 데이터가 Firestore에 무한정 쌓이는 것을 방지하기 위해 보관 기간을 정의하고, 자동 스케줄러(Worker)를 통해 주기적으로 정리(Purge)하는 기능입니다. 이를 통해 DB 스토리지 비용을 절감하고 쿼리 성능을 유지할 수 있습니다.

## 2. 보관 정책 (Retention Policy)

| 대상 컬렉션 | 상태/조건 | 보관 기간 (일) |
| --- | --- | --- |
| `ops_audit_events` | 일반 이벤트 | **90일** |
| `ops_audit_events` | `ops_playbook.run`, `ops_gate_settings.update`, `ops_circuit_breaker.reset` | **180일** |
| `ops_alert_jobs` | `done` | **14일** |
| `ops_alert_jobs` | `dead` | **30일** |
| `ops_alert_jobs` | `pending`, `running` | **삭제 금지** |
| `ops_retry_jobs` | `success`, `failed`, `done` | **14일** |
| `ops_retry_jobs` | `dead` | **30일** |
| `ops_retry_jobs` | `queued`, `running` | **삭제 금지** |
| `ops_incidents` | `closed` && `severity != critical` | **180일** |
| `ops_incidents` | `closed` && `severity == critical` | **365일** |
| `ops_incidents` | `open` | **삭제 금지** |
| `ops_incident_summaries` | 전체 | **365일** |

## 3. 서버 스케줄 워커 (opsRetentionWorker)
- **실행 시간**: 매일 03:10 (Asia/Seoul)
- **로직**:
  - `getRetentionPolicies`에 정의된 정책 배열을 순회하며 Firestore 쿼리를 생성합니다.
  - Timeout 방지를 위해 1회 실행당 **최대 2000건**만 삭제합니다. (초과 시 다음 날 이어서 삭제됨)
  - `OPS_RETENTION_DRY_RUN=1` 환경변수가 설정되어 있으면 실제 삭제(`batch.delete`) 대신 "삭제 예정 카운트"만 집계하여 Audit에 기록합니다.

## 4. API 및 UI 운영 가이드
- Ops Console 하단 **"🧹 Data Retention"** 섹션에서 수동으로 정리 작업을 수행하거나 결과를 미리보기(Preview)할 수 있습니다.
- 이 기능은 **`ops_admin`** 권한만 사용 가능합니다.

### 4.1 Preview (미리보기)
- 대상 컬렉션을 선택하고 `[Preview]` 버튼을 누르면 각 정책별로 삭제 대상 데이터의 샘플을 최대 10건씩 반환하여 보여줍니다. (삭제 안됨)

### 4.2 Dry-run 실행
- `[Dry-run 실행]` 버튼을 클릭하면 실제 데이터는 지우지 않고 각 컬렉션별로 "스캔 수"와 "삭제 예정 수"를 집계하여 표로 보여줍니다. (안전한 테스트)

### 4.3 실제 삭제 실행
- `[실제 삭제 실행]` 버튼을 클릭하면 확인 모달이 뜨고, 승인 시 데이터를 실제로 영구 삭제합니다.
- **⚠️ 경고**: 삭제된 데이터는 Firestore 상에서 **복구할 수 없습니다**. 주기적인 백업(Export)이 설정되어 있지 않다면 영원히 소실되므로 수동 실행 시 주의해야 합니다.

## 5. 기대 효과
- **비용**: 불필요한 오래된 로그와 완료된 큐 문서가 삭제되어 Firestore Storage 비용 증가를 억제합니다.
- **성능**: 인덱스 사이즈 감소 및 Range 쿼리 속도 개선을 기대할 수 있습니다.