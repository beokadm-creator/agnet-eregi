#!/bin/bash
# GCP Monitoring 정책에 새 Webhook 채널을 추가(덮어쓰기가 아닌 병합)하는 스크립트입니다.

PROJECT_ID="agent-eregi"
WEBHOOK_URL="https://YOUR_API_HOST/v1/webhooks/monitoring?token=YOUR_WEBHOOK_TOKEN"

# 1. Webhook 채널 생성
echo "1. Creating Webhook Notification Channel..."
NEW_CHANNEL=$(gcloud beta monitoring channels create \
  --project="$PROJECT_ID" \
  --display-name="Telegram Monitoring Webhook" \
  --type="webhook_tokenauth" \
  --channel-labels="url=${WEBHOOK_URL}" \
  --format="value(name)")

if [ -z "$NEW_CHANNEL" ]; then
  echo "❌ 채널 생성 실패"
  exit 1
fi

echo "✅ Webhook 채널 생성 완료: $NEW_CHANNEL"
echo "------------------------------------------------"

# 2. "Stripe"가 포함된 정책들을 찾아서 채널 병합
echo "2. Updating Stripe Alert Policies..."
# 'Stripe' 단어가 들어간 정책의 name(ID) 목록 조회
POLICIES=$(gcloud alpha monitoring policies list --project="$PROJECT_ID" --format="value(name)" --filter="displayName:\"Stripe\"")

if [ -z "$POLICIES" ]; then
  echo "⚠️ 업데이트할 Stripe 관련 정책을 찾을 수 없습니다."
  exit 0
fi

for POLICY_NAME in $POLICIES; do
  # 기존에 연결된 채널 목록 조회 (JSON 파싱 후 쉼표로 연결)
  EXISTING_CHANNELS=$(gcloud alpha monitoring policies describe "$POLICY_NAME" --project="$PROJECT_ID" --format="json" | grep -o '"projects/.*/notificationChannels/.*"' | tr -d '"' | paste -sd "," -)
  
  if [ -z "$EXISTING_CHANNELS" ]; then
    COMBINED_CHANNELS="$NEW_CHANNEL"
  else
    # 기존 채널 목록에 새 채널을 추가
    COMBINED_CHANNELS="${EXISTING_CHANNELS},${NEW_CHANNEL}"
  fi

  echo "🔄 Updating Policy: $POLICY_NAME"
  echo "   -> Channels: $COMBINED_CHANNELS"

  # 정책 업데이트 (기존 채널 + 새 채널)
  gcloud alpha monitoring policies update "$POLICY_NAME" \
    --project="$PROJECT_ID" \
    --notification-channels="$COMBINED_CHANNELS" > /dev/null

  echo "   ✅ Done."
done

echo "🎉 모든 Stripe 알림 정책에 텔레그램 Webhook 채널 추가 완료!"
