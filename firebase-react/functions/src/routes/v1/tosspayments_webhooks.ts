import * as express from "express";
import * as admin from "firebase-admin";

import { logError } from "../../lib/http";
import { Payment } from "../../lib/payment_models";
import { getTossPaymentsSettings, tossGetPaymentByPaymentKey } from "../../lib/tosspayments";

type TossWebhookPayload = {
  eventType: string;
  createdAt?: string;
  eventId?: string;
  data?: any;
};

export function registerTossPaymentsWebhookRoutes(app: express.Application, adminApp: typeof admin) {
  // POST /v1/webhooks/tosspayments
  app.post("/v1/webhooks/tosspayments", async (req: express.Request, res: express.Response) => {
    const payload = req.body as TossWebhookPayload;
    const db = adminApp.firestore();

    try {
      // idempotency: 헤더의 transmission-id(우선) → payload.eventId(보조)
      const transmissionId = String(req.headers["tosspayments-webhook-transmission-id"] || "");
      const eventId = transmissionId || payload?.eventId || "";
      if (eventId) {
        const eventRef = db.collection("toss_events").doc(eventId);
        try {
          await eventRef.create({
            eventType: payload.eventType || "unknown",
            transmissionId: transmissionId || null,
            transmissionTime: req.headers["tosspayments-webhook-transmission-time"] || null,
            retriedCount: req.headers["tosspayments-webhook-transmission-retried-count"] || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (err: any) {
          if (err.code === 6) {
            return res.status(200).json({ received: true, message: "already_processed" });
          }
          logError({ endpoint: "webhooks/tosspayments", code: "INTERNAL", messageKo: "Toss Webhook Idempotency Check 실패", err });
          return res.status(500).send(`Internal Error: ${err.message}`);
        }
      }

      const settings = await getTossPaymentsSettings();
      if (!settings || !settings.enabled || !settings.secretKey) {
        // 설정이 꺼져있으면 no-op (재시도 노이즈 방지)
        return res.status(200).json({ received: true, message: "disabled" });
      }

      // 상태 우선순위 (부분환불 포함)
      const STATUS_PRIORITY: Record<string, number> = {
        initiated: 1,
        failed: 2,
        captured: 3,
        partially_refunded: 4,
        refunded: 5
      };

      // 결제 상태 변경 이벤트를 기준으로 처리
      if (payload.eventType !== "PAYMENT_STATUS_CHANGED") {
        return res.status(200).json({ received: true, message: "ignored_event_type" });
      }

      const data = payload.data || {};
      const paymentKey = String(data.paymentKey || "");
      const orderId = String(data.orderId || "");
      const status = String(data.status || "");

      if (!paymentKey || !orderId) {
        logError({ endpoint: "webhooks/tosspayments", code: "INVALID_ARGUMENT", messageKo: "paymentKey/orderId 누락", err: new Error("missing keys") });
        return res.status(400).send("Missing paymentKey/orderId");
      }

      // orderId === 내부 paymentId 규약
      const paymentId = orderId;
      const paymentRef = db.collection("payments").doc(paymentId);
      const paymentSnap = await paymentRef.get();

      if (!paymentSnap.exists) {
        // 존재하지 않는 결제는 no-op (웹훅 재시도 줄이기)
        return res.status(200).json({ received: true, message: "payment_not_found_ignored" });
      }

      const paymentData = paymentSnap.data() as Payment;
      if (paymentData.provider !== "tosspayments") {
        return res.status(200).json({ received: true, message: "provider_mismatch_ignored" });
      }

      // 정합성 검증: paymentKey로 결제 조회하여 amount/status를 확정
      const tossPayment = await tossGetPaymentByPaymentKey({ secretKey: settings.secretKey, paymentKey });
      const tossTotalAmount = Number(tossPayment?.totalAmount ?? tossPayment?.amount ?? NaN);
      const tossStatus = String(tossPayment?.status || status);

      if (!Number.isFinite(tossTotalAmount) || tossTotalAmount !== paymentData.amount) {
        logError({
          endpoint: "webhooks/tosspayments",
          code: "FAILED_PRECONDITION",
          messageKo: "토스 결제 금액 정합성 불일치",
          err: new Error(`amount mismatch: toss=${tossTotalAmount}, local=${paymentData.amount}`)
        });
        return res.status(200).json({ received: true, message: "amount_mismatch_ignored" });
      }

      // 토스 상태 → 내부 상태 매핑
      // 참고: DONE(승인완료), ABORTED/EXPIRED(실패/만료), CANCELED/PARTIAL_CANCELED(취소/부분취소)
      let nextStatus: Payment["status"] | null = null;
      if (tossStatus === "DONE") nextStatus = "captured";
      else if (tossStatus === "ABORTED" || tossStatus === "EXPIRED") nextStatus = "failed";
      else if (tossStatus === "CANCELED") nextStatus = "refunded";
      else if (tossStatus === "PARTIAL_CANCELED") nextStatus = "partially_refunded";
      else return res.status(200).json({ received: true, message: "unhandled_status_ignored", status: tossStatus });

      const currentStatus = String(paymentSnap.data()?.status || "initiated");
      if (STATUS_PRIORITY[nextStatus] <= (STATUS_PRIORITY[currentStatus] || 0)) {
        return res.status(200).json({ received: true, message: "state_noop" });
      }

      const batch = db.batch();
      const updateData: any = {
        status: nextStatus,
        providerRef: paymentKey,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (nextStatus === "partially_refunded" || nextStatus === "refunded") {
        // 부분취소/취소 누적 금액 계산: cancels 배열의 cancelAmount 합
        const cancels = Array.isArray(tossPayment?.cancels) ? tossPayment.cancels : [];
        const refundedAmount = cancels.reduce((sum: number, c: any) => sum + Number(c?.cancelAmount || 0), 0);
        updateData.refundedAmount = refundedAmount;
      }

      batch.update(paymentRef, updateData);

      const auditRef = db.collection("audit_events").doc();
      batch.set(auditRef, {
        action: "payment.status_updated",
        actorId: "tosspayments_webhook",
        targetId: paymentId,
        changes: { status: nextStatus, providerRef: paymentKey, refundedAmount: updateData.refundedAmount ?? undefined },
        meta: { toss_status: tossStatus, toss_paymentKey: paymentKey, toss_eventId: eventId || null },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      return res.status(200).json({ received: true });
    } catch (err: any) {
      logError({ endpoint: "webhooks/tosspayments", code: "INTERNAL", messageKo: "Toss Webhook 처리 실패", err });
      return res.status(500).send(`Internal Error: ${err.message}`);
    }
  });
}
