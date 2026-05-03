import * as admin from "firebase-admin";
import * as crypto from "crypto";
import axios from "axios";
import { logOpsEvent } from "./ops_audit";

/**
 * [EP-14] B2B Webhook Dispatcher
 * b2b_webhook_events 컬렉션의 대기(pending) 상태 이벤트를 파트너 서버로 전송합니다.
 * - 서명(Signature) 추가: X-AgentRegi-Signature (HMAC-SHA256)
 * - 재시도 정책: 최대 5회 지수 백오프 (Exponential Backoff)
 * - 실패 시 DLQ (Dead Letter Queue) 처리
 */
export async function processB2bWebhooks(adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 전송 대기 중이거나 재시도 대기 중인 이벤트 조회
  const now = admin.firestore.Timestamp.now();
  const snap = await db.collection("b2b_webhook_events")
    .where("status", "in", ["pending", "retry"])
    .where("nextRetryAt", "<=", now)
    .orderBy("nextRetryAt", "asc")
    .limit(20)
    .get();

  for (const doc of snap.docs) {
    const event = doc.data();
    const eventId = doc.id;

    try {
      // 2. Webhook 엔드포인트 정보 조회
      const webhookDoc = await db.collection("b2b_webhooks").doc(event.webhookId).get();
      if (!webhookDoc.exists || webhookDoc.data()?.status !== "active") {
        await doc.ref.update({
          status: "failed",
          error: "Webhook endpoint not found or inactive",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        continue;
      }

      const webhook = webhookDoc.data()!;
      const payload = {
        eventId,
        eventType: event.eventType,
        timestamp: event.createdAt.toDate().toISOString(),
        data: event.payload
      };

      const payloadString = JSON.stringify(payload);

      // 3. 서명(Signature) 생성 (HMAC-SHA256)
      const signature = crypto
        .createHmac("sha256", webhook.secretKey)
        .update(payloadString)
        .digest("hex");

      // 4. HTTP POST 요청 발송
      await axios.post(webhook.endpointUrl, payloadString, {
        headers: {
          "Content-Type": "application/json",
          "X-AgentRegi-Signature": signature,
          "User-Agent": "AgentRegi-B2B-Webhook/1.0"
        },
        timeout: 10000 // 10초 타임아웃
      });

      // 5. 전송 성공 처리
      await doc.ref.update({
        status: "delivered",
        deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await logOpsEvent(db, "b2b.webhook.delivered", "SUCCESS", "system", eventId, "b2b_webhook_events", {
        webhookId: event.webhookId,
        endpointUrl: webhook.endpointUrl
      });

    } catch (error: any) {
      // 6. 전송 실패 및 재시도 로직 (Exponential Backoff)
      const attempt = (event.attempts || 0) + 1;
      const maxAttempts = 5;
      const errorMessage = error.response ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;

      if (attempt >= maxAttempts) {
        // DLQ 처리 (Dead Letter Queue)
        await doc.ref.update({
          status: "dlq",
          attempts: attempt,
          error: errorMessage,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await logOpsEvent(db, "b2b.webhook.dlq", "FAIL", "system", eventId, "b2b_webhook_events", {
          webhookId: event.webhookId,
          error: errorMessage,
          attempts: attempt
        });
      } else {
        // 재시도 예약 (1m, 5m, 30m, 2h...)
        const backoffMinutes = [1, 5, 30, 120, 360][attempt - 1] || 60;
        const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

        await doc.ref.update({
          status: "retry",
          attempts: attempt,
          error: errorMessage,
          nextRetryAt: admin.firestore.Timestamp.fromDate(nextRetryAt),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  }
}

/**
 * 특정 B2B 클라이언트의 이벤트를 구독 중인 Webhook 큐에 삽입합니다.
 */
export async function enqueueB2bWebhook(
  adminApp: typeof admin,
  clientId: string,
  eventType: string,
  payload: any
) {
  const db = adminApp.firestore();

  // 해당 이벤트를 구독 중인 활성 웹훅 조회
  const webhooksSnap = await db.collection("b2b_webhooks")
    .where("clientId", "==", clientId)
    .where("status", "==", "active")
    .where("subscribedEvents", "array-contains", eventType)
    .get();

  if (webhooksSnap.empty) return;

  const batch = db.batch();
  for (const doc of webhooksSnap.docs) {
    const eventRef = db.collection("b2b_webhook_events").doc();
    batch.set(eventRef, {
      webhookId: doc.id,
      clientId,
      eventType,
      payload,
      status: "pending",
      attempts: 0,
      nextRetryAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  await batch.commit();
}
