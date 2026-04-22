# Stripe Payment/Webhook GCP Alerting Templates

본 문서는 GCP Cloud Logging 및 Cloud Monitoring을 기반으로 Stripe 결제 및 웹훅 파이프라인의 필수 알림을 설정하기 위한 `gcloud` CLI 템플릿입니다.

## 사전 준비
GCP CLI(`gcloud`)가 설치되어 있고, 대상 프로젝트에 로그인(`gcloud auth login`) 및 프로젝트가 설정(`gcloud config set project [PROJECT_ID]`)되어 있어야 합니다.
Slack 연동 등 Notification Channel이 이미 구성되어 있다면 해당 채널의 리소스 이름(`projects/[PROJECT_ID]/notificationChannels/[CHANNEL_ID]`)을 준비하세요.

---

## 1. Webhook 500 에러 발생 (결제 상태 갱신 누락 위험)
**조건**: 5분 내 3건 이상 발생 시 알림

```bash
gcloud alpha monitoring policies create \
  --display-name="[CRITICAL] Stripe Webhook 500 Error" \
  --condition-filter='resource.type="cloud_function" AND logName="projects/[PROJECT_ID]/logs/cloudfunctions.googleapis.com%2Fcloud-functions" AND textPayload=~"endpoint: \"webhooks/stripe\".*code: \"INTERNAL\""' \
  --condition-display-name="Webhook Internal Error Count" \
  --duration="5m" \
  --aggregation='{"alignmentPeriod": "300s", "crossSeriesReducer": "REDUCE_COUNT", "perSeriesAligner": "ALIGN_COUNT"}' \
  --condition-threshold-value=3 \
  --condition-threshold-trigger="trigger" \
  --combiner="OR" \
  --notification-channels="[NOTIFICATION_CHANNEL_ID]" \
  --documentation="Stripe Webhook 처리 중 500 에러가 연속 발생했습니다. 결제 상태(Captured/Failed)가 누락될 수 있으니 즉시 확인하세요."
```

## 2. Refund Execute 실패 (환불 누락 위험)
**조건**: 5분 내 1건이라도 발생 시 알림

```bash
gcloud alpha monitoring policies create \
  --display-name="[CRITICAL] Stripe Refund Execute Failed" \
  --condition-filter='resource.type="cloud_function" AND logName="projects/[PROJECT_ID]/logs/cloudfunctions.googleapis.com%2Fcloud-functions" AND textPayload=~"action: \"refund.executed\".*status: \"fail\""' \
  --condition-display-name="Refund Execute Failure Count" \
  --duration="5m" \
  --aggregation='{"alignmentPeriod": "300s", "crossSeriesReducer": "REDUCE_COUNT", "perSeriesAligner": "ALIGN_COUNT"}' \
  --condition-threshold-value=1 \
  --condition-threshold-trigger="trigger" \
  --combiner="OR" \
  --notification-channels="[NOTIFICATION_CHANNEL_ID]" \
  --documentation="Stripe 환불(Refund Execute) API 호출이 실패했습니다. 잔고 부족(Insufficient Funds) 또는 API 일시 장애일 수 있습니다."
```

## 3. Env Mismatch 발생 (테스트/라이브 키 혼선 위험)
**조건**: 5분 내 1건이라도 발생 시 알림

```bash
gcloud alpha monitoring policies create \
  --display-name="[WARNING] Stripe Env Mismatch Detected" \
  --condition-filter='resource.type="cloud_function" AND logName="projects/[PROJECT_ID]/logs/cloudfunctions.googleapis.com%2Fcloud-functions" AND textPayload=~"action: \"stripe_webhook.env_mismatch\""' \
  --condition-display-name="Env Mismatch Count" \
  --duration="5m" \
  --aggregation='{"alignmentPeriod": "300s", "crossSeriesReducer": "REDUCE_COUNT", "perSeriesAligner": "ALIGN_COUNT"}' \
  --condition-threshold-value=1 \
  --condition-threshold-trigger="trigger" \
  --combiner="OR" \
  --notification-channels="[NOTIFICATION_CHANNEL_ID]" \
  --documentation="Stripe Webhook의 Livemode와 서버의 환경변수(NODE_ENV, STRIPE_SECRET_KEY)가 불일치합니다. 라이브/테스트 설정 혼선을 즉시 점검하세요."
```

## (선택) 4. Webhook 400 서명 검증 실패
**조건**: 5분 내 10건 이상 발생 시 경고 (단순 스캐닝 봇에 의한 노이즈 방지)

```bash
gcloud alpha monitoring policies create \
  --display-name="[WARNING] Stripe Webhook Signature Verification Failed" \
  --condition-filter='resource.type="cloud_function" AND logName="projects/[PROJECT_ID]/logs/cloudfunctions.googleapis.com%2Fcloud-functions" AND textPayload=~"endpoint: \"webhooks/stripe\".*code: \"INVALID_ARGUMENT\""' \
  --condition-display-name="Webhook Signature Failure Count" \
  --duration="5m" \
  --aggregation='{"alignmentPeriod": "300s", "crossSeriesReducer": "REDUCE_COUNT", "perSeriesAligner": "ALIGN_COUNT"}' \
  --condition-threshold-value=10 \
  --condition-threshold-trigger="trigger" \
  --combiner="OR" \
  --notification-channels="[NOTIFICATION_CHANNEL_ID]" \
  --documentation="Webhook 서명 검증 실패가 다수 발생했습니다. STRIPE_WEBHOOK_SECRET 설정 오류이거나 악의적인 스캐닝일 수 있습니다."
```
