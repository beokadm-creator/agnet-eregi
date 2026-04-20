# Ops Health Dashboard

## 1. 개요
운영(Ops) 환경에서 각 게이트(Gate)의 상태와 이슈를 한눈에 파악하고, 이상징후(Anomaly)를 빠르게 인지하여 대응할 수 있도록 돕는 대시보드와 이를 뒷받침하는 API 명세입니다.

## 2. Risk 레벨 산정 규칙
게이트별로 집계된 데이터(Circuit Breaker 상태, 재시도 큐, 실패/에러 이벤트, 권한 거부 이벤트 등)를 기반으로 아래와 같이 고정된 Risk 레벨을 산정합니다.
- **Critical (위험)**
  - Circuit Breaker 상태가 \`open\`인 경우
  - 재시도 큐(Job)에 \`dead\` 상태인 건이 1건 이상 존재하는 경우
- **Warn (경고)**
  - Job 실패율(Fail Rate)이 5% 이상인 경우 (\`fail / total >= 0.05\`)
  - 알림(Alerts) 발송에 실패한 건이 존재하는 경우
  - 권한 부족 등 인증/인가 거부(\`ops_auth.denied\`) 이벤트가 10건 이상 발생한 경우
- **OK (정상)**
  - 위 Critical, Warn 조건에 해당하지 않는 모든 경우

## 3. API 스펙
### 3.1. Health Summary API
- **Endpoint**: \`GET /v1/ops/health/summary\`
- **Query Params**:
  - \`gateKey\` (선택): 특정 게이트만 조회할 때 사용
  - \`from\` (선택): 조회 시작 시간 (ISO 8601), 미지정 시 최근 24시간
  - \`to\` (선택): 조회 종료 시간 (ISO 8601), 미지정 시 현재 시간
  - \`limit\` (선택): 게이트 키 조회 최대 개수 (기본 50, 최대 200)
- **Response**:
  \`\`\`json
  {
    "ok": true,
    "data": {
      "window": { "from": "2026-04-19T...", "to": "2026-04-20T..." },
      "items": [
        {
          "gateKey": "pilot-gate",
          "circuitBreaker": { "state": "closed", "failCount": 0, "openUntil": null },
          "jobs": { "total": 120, "ok": 110, "fail": 8, "dead": 2 },
          "alerts": { "sent": 5, "failed": 1 },
          "audit": { "denied": 3, "opsActions": 0 },
          "risk": { "level": "critical", "reasons": ["dead_jobs>0"] }
        }
      ]
    }
  }
  \`\`\`

### 3.2. Gate Detail Drilldown API
- **Endpoint**: \`GET /v1/ops/health/:gateKey\`
- **Query Params**:
  - \`from\` (선택): 조회 시작 시간
  - \`to\` (선택): 조회 종료 시간
- **Response**:
  \`\`\`json
  {
    "ok": true,
    "data": {
      "summary": {
        // Summary API의 단건 item과 동일한 구조
      },
      "recentEvents": [
        {
          "id": "docId",
          "action": "ops_alert.notify",
          "status": "fail",
          "summary": "Slack 알림 발송 실패",
          "error": { "message": "...", "category": "NETWORK" },
          "createdAt": "2026-04-20T..."
        }
      ]
    }
  }
  \`\`\`

## 4. 운영 롤아웃 및 대시보드 체크리스트
- [ ] 대시보드 접속 후 기본 조회 기간(최근 24시간) 동안 **Critical** 레벨 게이트가 존재하는지 확인합니다.
- [ ] Circuit Breaker가 \`open\`인 경우 상세 내역(Drilldown)을 확인하여 오류 원인을 파악한 뒤, 조치 후 수동으로 \`Reset\`을 진행합니다.
- [ ] \`dead\` 상태인 Job이 존재하는 경우 상세 화면에서 원인을 점검하고, 필요한 경우 Dead-letter 이슈 생성(Issue 수동 등록) 액션을 취합니다.
- [ ] **Warn** 레벨 게이트의 경우, 실패율이나 Alert 발송 실패 사유를 확인하여 네트워크나 설정 오류 여부를 미리 모니터링합니다.
- [ ] \`ops_auth.denied\` 카운트가 비정상적으로 높다면 악의적 접근이나 권한 오설정이 없는지 Audit 로그를 추가 분석합니다.
