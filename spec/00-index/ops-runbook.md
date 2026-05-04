# Ops Runbook (운영 절차 및 통합 가이드)

## 1. 개요
이 문서는 #21부터 #38까지 구축된 AgentRegi의 "Ops 운영/관리/통제" 기능들을 활용하여 시스템의 상태를 진단하고 장애를 복구하기 위한 가이드입니다. 

## 2. 장애 대응 절차 (Incident Response)

장애 의심(에러 다수 발생, 알림 수신 등) 시 아래 순서대로 Ops Console을 활용합니다.

1. **[Observability] Trends 파악**
   - **위치**: 📈 Ops Observability Trends
   - **액션**: 오늘 자 `Fail Rate`나 `Error Budget (SLO)` 소진율이 비정상적으로 높은지 확인합니다. 빨간색(Burn Rate 100% 초과)인 GateKey를 식별합니다.

2. **[Reliability] Incident 상세 확인**
   - **위치**: 🚨 사건 타임라인 (Incidents)
   - **액션**: 식별한 GateKey의 최신 `open` 상태 Incident를 클릭합니다.
   - **분석**: Auto Triage 결과를 확인합니다 (예: `cb_open`, `dead_jobs`, `auth_denied` 등).

3. **[Control] Playbook(권장 조치) 실행**
   - **액션**: Incident 상세 모달 좌측 하단의 "권장 조치"를 확인하고 `[실행]` 버튼을 누릅니다.
     - `cb_open` 시 → `[CB Reset]` 실행
     - `dead_jobs` 시 → `[이슈 수동 생성]` 실행
   - **주의**: 이 작업은 즉각 시스템에 반영되며 `ops_admin` 권한이 필요합니다.

4. **[Observability] Query Health 확인 (API 500 지속 시)**
   - **위치**: 🩺 Query Health
   - **액션**: "Missing Index" 등 인덱스 오류가 계속 뜨는지 확인하고, Firebase Console로 이동해 인덱스를 추가한 뒤 `[해결]` 처리합니다.

## 3. 권한 및 보안 운영 (Governance)

- **권한 부여/회수**: Ops Console의 `Access Management` 섹션(API)을 통해 이메일/UID 기반으로 `ops_operator`, `ops_admin` 권한을 부여합니다.
- **Break-glass (긴급 권한)**: 심야 등 급한 상황에서 `ops_operator`가 임시 `ops_admin` 권한을 얻을 수 있습니다. (`POST /v1/ops/access/breakglass`) 단, 30분 뒤 자동 회수됩니다.
- **Audit Log**: 모든 상태 변경, 권한 변경, Playbook 실행은 `ops_audit_events`에 기록되므로, 🚨 Audit Log 섹션에서 이력을 정기적으로 리뷰해야 합니다.

## 4. 배포 및 데이터 관리 (Release & Data)

- **Release Preflight**: 배포 전/후 `🚀 Release Preflight & Smoke Test` 섹션에서 `[Preflight 실행]`을 통해 필수 설정(Slack Webhook, GitHub Token 등) 누락을 점검합니다.
- **Data Retention**: 데이터 스토리지 최적화를 위해 매일 03:10에 오래된 데이터가 자동 삭제됩니다. 필요시 수동으로 `[Dry-run]`을 돌려 삭제 대상 볼륨을 점검합니다.
- **Backup & Restore**: 매주 일요일 새벽 4시에 Firestore Export가 트리거됩니다. 분기별 1회 이상 Runbook(`42-ops-backup-restore-drill.md`)을 참고하여 복구 리허설을 진행하세요.

---

## 5. Ops Spec 인덱스 (참고 링크)
각 기능의 상세한 기술적 명세는 아래 문서를 참고하세요.

- [24. RBAC & Audit](24-ops-rbac-audit.md)
- [25. Circuit Breaker](25-ops-circuit-breaker.md)
- [27. Alert Policy & Routing](27-ops-alert-policy.md)
- [28. Noise Control](28-ops-noise-control.md)
- [29. Retry & Dead-letter](29-ops-retry-deadletter.md)
- [30. Automated Actions](30-ops-automated-actions.md)
- [35. Incident Timeline](35-ops-incident-timeline.md)
- [36. Auto Triage & Playbook](36-ops-auto-triage-playbook.md)
- [37. Preflight & Smoke Test](37-ops-release-preflight-smoketest.md)
- [38. Data Retention](38-ops-data-retention.md)
- [39. Observability Pack](39-ops-observability-pack.md)
- [40. SLO & Error Budget](40-ops-slo-error-budget.md)
- [41. Access Provisioning](41-ops-access-provisioning.md)
- [42. Backup & Restore Drill](42-ops-backup-restore-drill.md)
- [43. Query Health](43-ops-query-health.md)
