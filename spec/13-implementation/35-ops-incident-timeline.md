# Ops Incident Timeline

## 1. 개요
운영자가 `gateKey`별로 언제 문제가 시작/악화/해결됐는지를 한 눈에 보는 "사건 타임라인"을 자동으로 생성하고, 주간 단위로 요약을 남기는 시스템입니다.

## 2. 생성 규칙
1. `ops_audit_events`, `ops_alert_jobs`, Circuit Breaker 등의 이벤트를 스캔하여 30분 이내의 연관 이벤트들을 단일 Incident로 묶습니다.
2. 30분 동안 추가 이벤트가 없으면 Incident는 자동 종료(`closed`)됩니다.
3. 이벤트 종류에 따라 `severity` 및 `reasons`가 결정됩니다. (예: `cb_open` 시 `critical`)

## 3. 주간 요약 스케줄
- **워커**: `opsWeeklySummaryWorker` (매주 월요일 09:00 실행)
- **로직**: 지난 7일 동안 발생한 `closed` 상태의 Incident를 게이트별로 그룹화하여 Markdown 형식의 주간 요약 리포트를 생성합니다.
- **저장소**: Firestore `ops_incident_summaries` 컬렉션
- **구조**:
  - `id`: `gateKey_YYYY-Www` (예: `pilot-gate_2026-W16`)
  - `gateKey`: string
  - `week`: string (ISO 8601 week date format)
  - `markdown`: 생성된 주간 요약 텍스트
  - `incidentCount`: 해당 주간의 Incident 수
  - `createdAt`: Timestamp
