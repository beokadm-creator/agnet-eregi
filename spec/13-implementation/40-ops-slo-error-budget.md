# Ops SLO & Error Budget

## 1. 개요
운영 시스템의 신뢰성을 정량화하고 목표 수준을 설정하기 위해 SLO(Service Level Objective) 및 Error Budget 개념을 도입합니다.
일정 기간(예: 7일) 동안 발생한 실패(Error)가 허용치(Budget)를 초과하는지 모니터링하여, 빠른 대응이나 정책 재조정을 유도합니다.

## 2. 데이터 모델

### 2.1 OpsSloConfig (`ops_slo_configs` 컬렉션)
- `gateKey`: Gate 식별자
- `targetPercentage`: 목표 성공률 (예: 99.5%)
- `budgetDays`: 측정 기간 (예: 7일)
- `updatedAt`: 수정 일시
- `updatedBy`: 수정한 사용자 UID

### 2.2 OpsSloStatus (`ops_slo_status` 컬렉션)
- 일별 워커에 의해 자동 계산되어 저장되는 현황 데이터
- `targetPercentage`: 설정된 목표율
- `sliPercentage`: 실제 측정된 성공률 (SLI)
- `totalRequests`: 기간 내 총 요청 수
- `totalFails`: 기간 내 총 실패 수
- `allowedFails`: 허용된 실패 수 = `totalRequests * ((100 - targetPercentage) / 100)`
- `burnRate`: 소진율 = `totalFails / allowedFails * 100` (%)

## 3. Burn Rate 모니터링 워커
- **Worker**: `opsSloWorker` (매일 02:00 KST 실행)
- **로직**:
  1. 모든 GateKey의 SLO 설정을 가져옴 (없으면 Default 99.0%, 7일 적용)
  2. `ops_metrics_daily`에서 설정된 기간(`budgetDays`) 동안의 데이터를 합산하여 `totalRequests`, `totalFails` 계산
  3. `burnRate`가 100%를 초과하는 경우:
     - 지난 24시간 내 동일 알림이 발송되지 않았다면,
     - `ops_alert.notify`를 통해 Critical 수준의 알림(`ops_slo.burn_alert`) 발송

## 4. API 명세
- `GET /v1/ops/slo/:gateKey`: 특정 Gate의 SLO 설정 조회 (`ops_viewer` 이상)
- `POST /v1/ops/slo/:gateKey`: 특정 Gate의 SLO 설정 업데이트 (`ops_admin`만 가능)
- `GET /v1/ops/slo/dashboard/status`: 대시보드 표시를 위한 최신 SLO 현황 조회

## 5. UI 가이드
- Ops Console의 **Observability Trends** 섹션 상단에 **Error Budget (SLO) 현황** 테이블 추가.
- 소진율(Burn Rate)에 따라 색상 인디케이터 표시:
  - 초록색: 정상 (여유 있음)
  - 주황색: 80% 이상 소진 (주의)
  - 빨간색: 100% 이상 소진 (목표 미달)
- `[Metrics/SLO 강제 재생성]` 버튼을 통해 어제 날짜 기준으로 즉시 갱신 가능.