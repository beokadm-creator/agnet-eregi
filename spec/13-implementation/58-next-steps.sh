#!/bin/bash
# 다음 개발/운영 단계 자동화 스크립트
# - Telegram Monitoring Webhook 채널 "재사용/생성" (URL 동일하면 재사용)
# - "Stripe" 관련 Alert Policy들에 Webhook 채널을 "덮어쓰기 없이 병합" 적용
# - Webhook 엔드포인트(E2E) 테스트(curl) 수행 (특수문자 포함 → HTML escape 검증)
#
# 사용법:
#   1) 아래 PROJECT_ID / WEBHOOK_URL / POLICY_FILTER 만 수정
#   2) chmod +x spec/13-implementation/58-next-steps.sh
#   3) ./spec/13-implementation/58-next-steps.sh
#
# 주의:
# - WEBHOOK_URL은 반드시 공개 HTTPS 여야 합니다.
# - URL(토큰)을 회전시키는 경우, 기존 채널을 재사용하면 URL이 갱신되지 않습니다.
#   이 스크립트는 "URL이 같은 채널이 있으면 재사용"하고, 없으면 새 채널을 만듭니다.
#   (기존 채널 삭제는 안전을 위해 자동으로 하지 않습니다. 하단 안내 참고)

set -euo pipefail

PROJECT_ID="agent-eregi"
CHANNEL_DISPLAY_NAME="Telegram Monitoring Webhook"
WEBHOOK_URL="https://YOUR_API_HOST/v1/webhooks/monitoring?token=YOUR_WEBHOOK_TOKEN"

# displayName 필터(원하시면 변경): 예) displayName:"Stripe" AND displayName:"Webhook"
POLICY_FILTER='displayName:"Stripe"'

# 1이면 실제 update/create 없이 출력만 합니다.
DRY_RUN="${DRY_RUN:-0}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "❌ 필요한 커맨드가 없습니다: $1"; exit 1; }
}

require_cmd gcloud
require_cmd curl

gcloud config set project "$PROJECT_ID" >/dev/null
echo "✅ Project: $(gcloud config get-value project)"

echo "------------------------------------------------"
echo "1) Resolving Notification Channel (type=webhook_tokenauth, displayName=${CHANNEL_DISPLAY_NAME})"

# (name, labels.url) 목록을 뽑아 URL이 동일한 채널이 있으면 그 채널 재사용
EXISTING_MATCH=$(
  gcloud beta monitoring channels list \
    --project="$PROJECT_ID" \
    --filter="type=webhook_tokenauth AND displayName=\"${CHANNEL_DISPLAY_NAME}\"" \
    --format="value(name,labels.url)" | awk -v target="${WEBHOOK_URL}" '$2==target {print $1}' | head -n 1
)

if [ -n "${EXISTING_MATCH}" ]; then
  NEW_CHANNEL="${EXISTING_MATCH}"
  echo "✅ Reusing existing channel with same URL: ${NEW_CHANNEL}"
else
  echo "ℹ️ No matching channel with same URL found. Creating a new channel..."
  if [ "$DRY_RUN" = "1" ]; then
    NEW_CHANNEL="(dry-run) projects/${PROJECT_ID}/notificationChannels/NEW_CHANNEL_ID"
    echo "🟡 DRY_RUN=1 → would create channel for URL: ${WEBHOOK_URL}"
  else
    NEW_CHANNEL=$(
      gcloud beta monitoring channels create \
        --project="$PROJECT_ID" \
        --display-name="${CHANNEL_DISPLAY_NAME}" \
        --type="webhook_tokenauth" \
        --channel-labels="url=${WEBHOOK_URL}" \
        --format="value(name)"
    )
    echo "✅ Created channel: ${NEW_CHANNEL}"
  fi
fi

echo "------------------------------------------------"
echo "2) Updating Alert Policies (filter: ${POLICY_FILTER})"

POLICIES=$(
  gcloud alpha monitoring policies list \
    --project="$PROJECT_ID" \
    --filter="${POLICY_FILTER}" \
    --format="value(name)"
)

if [ -z "${POLICIES}" ]; then
  echo "⚠️ 대상 정책을 찾지 못했습니다. (filter: ${POLICY_FILTER})"
  echo "   gcloud alpha monitoring policies list --project=\"${PROJECT_ID}\" --format=\"table(name,displayName)\""
  exit 0
fi

for POLICY_NAME in ${POLICIES}; do
  EXISTING=$(
    gcloud alpha monitoring policies describe "${POLICY_NAME}" \
      --project="$PROJECT_ID" \
      --format="value(notificationChannels)" | tr ';' ',' | sed 's/,$//'
  )

  # 기존 채널 + 신규 채널을 유니크하게 병합
  COMBINED=$(
    (echo "${EXISTING}" | tr ',' '\n'; echo "${NEW_CHANNEL}") \
      | sed '/^\s*$/d' \
      | sort -u \
      | paste -sd "," -
  )

  echo "🔄 Policy: ${POLICY_NAME}"
  echo "   -> Channels: ${COMBINED}"

  if [ "$DRY_RUN" = "1" ]; then
    echo "   🟡 DRY_RUN=1 → skip update"
  else
    gcloud alpha monitoring policies update "${POLICY_NAME}" \
      --project="$PROJECT_ID" \
      --notification-channels="${COMBINED}" >/dev/null
    echo "   ✅ Updated"
  fi
done

echo "------------------------------------------------"
echo "3) E2E Test (curl → /v1/webhooks/monitoring)  [HTML escape 검증 포함]"
echo "   - Telegram 설정 enabled=true + botToken/chatId/webhookToken 저장 후 실행하세요."
echo "   - 아래 요청이 200 OK를 반환하고, 텔레그램 메시지가 오면 성공입니다."

cat <<EOF

curl -sS -X POST "${WEBHOOK_URL}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "incident": {
      "state": "open",
      "policy_name": "TEST <Policy> & \\"Quotes\\"",
      "summary": "Hello <b>world</b> & test",
      "url": "https://console.cloud.google.com/monitoring/alerting"
    }
  }'

EOF

echo "------------------------------------------------"
echo "✅ Done."
echo "Webhook Channel used: ${NEW_CHANNEL}"
echo ""
echo "ℹ️ (선택) 예전 채널이 누적됐다면 아래로 정리할 수 있습니다:"
echo "  gcloud beta monitoring channels list --project=\"${PROJECT_ID}\" --filter='type=webhook_tokenauth AND displayName=\"${CHANNEL_DISPLAY_NAME}\"' --format='table(name,labels.url)'"
echo "  gcloud beta monitoring channels delete <CHANNEL_NAME>"

