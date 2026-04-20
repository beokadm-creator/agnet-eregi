# Ops Observability Pack (메트릭, 트레이싱, 알림 품질, 운영 리포트)

## 1. 개요
운영 체계의 투명성을 높이기 위해, 각기 흩어진 이벤트(Audit, Alert, Retry, Incident, Playbook)를 연결하고(Tracing), 그 결과를 수치화(Metrics/Quality)하며, 주간 요약(Weekly Review)을 통해 시스템 상태를 평가하는 패키지입니다.

## 2. Correlation/Trace ID 표준화 (Tracing)
- **목적**: 특정 사건이 발생했을 때 꼬리를 물고 일어나는 연쇄 이벤트들을 추적 가능하게 함.
- **적용**:
  - `ops_audit_events`, `ops_alert_jobs`, `ops_retry_jobs`, `ops_incidents`에 `correlationId` 필드를 도입.
  - HTTP 요청의 경우 헤더(`X-Request-Id`) 기반의 `requestId`를 그대로 `correlationId`로 승계.
  - 백그라운드 Worker의 경우 `corr_<timestamp>_<random>` 형태의 난수를 생성해, 하나의 논리적 흐름(예: Retry Worker → Dead Letter → Alert → Incident) 동안 같은 ID를 유지.
  - 모든 API 응답의 성공/실패 JSON에 `requestId` 포함 (디버깅 용이).

## 3. Daily Metrics (Snapshot)
- **Worker**: `opsMetricsWorker` (매일 01:20 KST 실행)
- **컬렉션**: `ops_metrics_daily` (문서명: `gateKey__YYYY-MM-DD`)
- **수집 지표**:
  - `auditFail` / `auditTotal` (→ `failRate`)
  - `deadJobsCount`
  - `alertsSent` / `alertsFailed` / `alertsSuppressed`
  - `authDeniedCount`
  - `incidentsOpened` / `incidentsClosed`
  - `playbookRuns`
- **의의**: 특정 날짜에 어떤 Gate에서 에러나 재시도, 조치(Playbook)가 집중되었는지 시계열로 파악 가능.

## 4. Alert Quality Scoring
- **Worker**: `opsAlertQualityWorker` (매일 01:30 KST 실행)
- **컬렉션**: `ops_alert_quality_daily`
- **로직**:
  - "알림 발송 후 의미 있는 액션(Incident 생성, Playbook 실행)이 있었는가?"를 기반으로 점수화(0~100).
  - 억제(Suppressed)율이나 발송 실패(Dead)율이 높으면 감점.
  - 알림은 안 나갔는데 인시던트가 열렸다면 "탐지 누락"으로 판단하여 강한 페널티.
- **의의**: "단순히 알림만 많이 보내고 버려지는 Gate"를 찾아내어 알림 정책(Alert Policy) 튜닝을 유도함.

## 5. Ops Console "Trends" 대시보드
- **UI 위치**: Ops Console 상단의 `📈 Ops Observability Trends` 섹션.
- **기능**:
  - 최근 14일 치의 Daily Metrics와 Alert Quality Score를 표 형태로 한눈에 보여줌.
  - 날짜 텍스트를 클릭하면 즉시 하단의 `Audit Log` 또는 `Alert Delivery` 필터로 **드릴다운(Drill-down)** 이동하여 상세 내역을 조회할 수 있음.
  - `ops_admin` 권한자는 [Metrics 강제 재생성] 버튼을 통해 어제 날짜 기준 지표를 수동으로 갱신 가능.

## 6. Weekly Ops Review 문서
- **Worker**: `opsWeeklySummaryWorker` 내 `processWeeklyOpsReview` (매주 월요일 09:00 KST 실행)
- **결과물**: Firestore `ops_weekly_reviews` 컬렉션에 Markdown 텍스트로 저장됨.
- **내용**:
  - 지난 7일간의 지표를 종합하여 **Top 3 Risk Gates** (위험 게이트) 도출.
  - Alert Quality 점수가 가장 나쁜 Gate와 좋은 Gate 식별.
  - Rule-based 추천 사항(Action Items) 제공: "Dead Job이 너무 많으니 정책 수정 필요", "Playbook 수동 실행이 잦으니 자동화 검토 요망" 등.

## 7. 운영 가이드 (권한 및 주의사항)
- **조회 권한**: Metrics/Quality 트렌드는 `ops_viewer` 이상이면 조회 가능.
- **실행 권한**: Metrics 재생성 등 데이터 쓰기가 수반되는 작업은 `ops_admin`만 가능하며, UI에서 Confirm 모달을 거치도록 안전장치 적용됨.
- **모니터링 방법**: 매주 월요일 생성되는 Weekly Review 문서를 확인하고, Action Item에 따라 `ops_gate_settings`의 알림 임계치나 Cooldown 등을 조정하여 점진적으로 시스템 안정성을 높일 것.
