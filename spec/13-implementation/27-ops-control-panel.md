# 패킷 #21: 운영 제어 패널(알림/브레이커/Dead-letter) + 강제 복구 버튼

## 1. 개요
운영 중 발생할 수 있는 오류 폭주 및 연속 실패(Network/Rate Limit)로 인한 피해를 막고, 제어력을 확보하기 위해 Ops Console 내에 "운영 제어(Operation Control)" 기능을 도입합니다.

## 2. 주요 기능

### 2.1. Circuit Breaker 제어
- 현재 Circuit Breaker의 상태(Closed, Open, Half-open)와 남은 차단 시간을 Ops Console에서 조회할 수 있습니다.
- 필요 시 운영자가 강제로 Breaker를 `Closed` 상태로 리셋할 수 있는 **강제 복구 버튼**을 제공합니다.

### 2.2. 알림 시스템(Alert) 테스트
- `ops_alert.ts`를 통해 발송되는 Webhook 알림의 정상 동작 여부를 테스트할 수 있도록 **알림 발송 테스트** 기능을 추가합니다.

### 2.3. Dead-letter 이슈 생성 재시도
- 작업 실패 후 Dead-letter 큐로 들어간 Job들 중, GitHub 토큰 오류 등의 사유로 자동 이슈화가 실패한 건들에 대해 운영자가 수동으로 **이슈 생성을 트리거** 할 수 있습니다.
- 이 과정에서 GitHub Project Board에 자동으로 아이템을 추가하는 기능(옵션)도 함께 연결됩니다.

## 3. API 엔드포인트 명세
- `GET /v1/ops/reports/:gateKey/circuit-breaker`: 상태 반환
- `POST /v1/ops/reports/:gateKey/circuit-breaker/reset`: 강제 초기화
- `POST /v1/ops/alerts/test`: 테스트 Webhook 발송
- `POST /v1/ops/retry/:jobId/deadletter/issue`: Dead-letter 이슈화 수동 실행

## 4. UI 변경점 (Ops Console)
- **운영 제어 패널**: `App.tsx` 내에 "🛡 운영 제어" 영역 신설
- **재시도 큐 목록**: 상태가 `dead`인 항목에 한해 "이슈 수동 생성" 버튼 노출
