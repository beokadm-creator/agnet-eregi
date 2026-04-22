import * as express from "express";
import * as admin from "firebase-admin";
import Stripe from "stripe";

import { logError } from "../../lib/http";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2023-10-16" as any });

export function registerStripeWebhookRoutes(app: express.Application, adminApp: typeof admin) {
  app.post("/v1/webhooks/stripe", async (req: express.Request, res: express.Response) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).send("Webhook Error: Missing signature or secret");
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent((req as any).rawBody, sig, webhookSecret);
    } catch (err: any) {
      logError({ endpoint: "webhooks/stripe", code: "INVALID_ARGUMENT", messageKo: "Stripe 서명 검증 실패", err });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const db = adminApp.firestore();
    
    // Idempotency check: 원자적 생성(create) 시도로 레이스 컨디션 방지
    const eventRef = db.collection("stripe_events").doc(event.id);
    try {
      await eventRef.create({
        type: event.type,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (err: any) {
      if (err.code === 6) { // ALREADY_EXISTS (grpc status 6)
        return res.json({ received: true, message: "already_processed" });
      }
      logError({ endpoint: "webhooks/stripe", code: "INTERNAL", messageKo: "Stripe Webhook Idempotency Check 실패", err });
      return res.status(500).send(`Internal Error: ${err.message}`);
    }

    // Live/Test 환경 혼선 방지 (가드)
    const isLiveMode = event.livemode;
    const envIsProd = process.env.NODE_ENV === "production";
    
    if (isLiveMode !== envIsProd) {
      logError({ 
        endpoint: "webhooks/stripe", 
        code: "FAILED_PRECONDITION", 
        messageKo: `Stripe Webhook 환경 불일치 (Event Livemode: ${isLiveMode}, Server Prod: ${envIsProd})`, 
        err: new Error("Environment mismatch") 
      });
      const auditRef = db.collection("audit_events").doc();
      await auditRef.set({
        action: "stripe_webhook.env_mismatch",
        status: "fail",
        actorId: "stripe_webhook",
        targetId: event.id,
        changes: { event_livemode: isLiveMode, server_prod: envIsProd },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      // no-op 처리하여 스트라이프 측에서 재시도하지 않게 함
      return res.json({ received: true, message: "env_mismatch_ignored" });
    }

    const batch = db.batch();

    // Payment 상태 우선순위 맵 정의
    const STATUS_PRIORITY: Record<string, number> = {
      "initiated": 1,
      "failed": 2,
      "captured": 3,
      "refunded": 4
    };

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = session.client_reference_id;
        
        if (paymentId) {
          const paymentRef = db.collection("payments").doc(paymentId);
          const paymentSnap = await paymentRef.get();
          
          if (paymentSnap.exists) {
            const currentStatus = paymentSnap.data()?.status || "initiated";
            
            if (STATUS_PRIORITY["captured"] > STATUS_PRIORITY[currentStatus]) {
              batch.update(paymentRef, {
                status: "captured",
                providerRef: session.payment_intent as string,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });

              const auditRef = db.collection("audit_events").doc();
              batch.set(auditRef, {
                action: "payment.captured",
                actorId: "stripe_webhook",
                targetId: paymentId,
                changes: { status: "captured", providerRef: session.payment_intent },
                meta: { stripe_event_id: event.id, stripe_session_id: session.id },
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          }
        }
      } else if (event.type === "checkout.session.async_payment_failed" || event.type === "payment_intent.payment_failed") {
        let paymentId: string | undefined;
        
        if (event.type === "checkout.session.async_payment_failed") {
          const session = event.data.object as Stripe.Checkout.Session;
          paymentId = session.client_reference_id || undefined;
        } else if (event.type === "payment_intent.payment_failed") {
          const pi = event.data.object as Stripe.PaymentIntent;
          const snap = await db.collection("payments").where("providerRef", "==", pi.id).limit(1).get();
          if (!snap.empty) {
            paymentId = snap.docs[0].id;
          }
        }

        if (paymentId) {
          const paymentRef = db.collection("payments").doc(paymentId);
          const paymentSnap = await paymentRef.get();
          
          if (paymentSnap.exists) {
            const currentStatus = paymentSnap.data()?.status || "initiated";
            
            if (STATUS_PRIORITY["failed"] > STATUS_PRIORITY[currentStatus]) {
              batch.update(paymentRef, {
                status: "failed",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });

              const auditRef = db.collection("audit_events").doc();
              batch.set(auditRef, {
                action: "payment.failed",
                actorId: "stripe_webhook",
                targetId: paymentId,
                changes: { status: "failed" },
                meta: { stripe_event_id: event.id },
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          }
        }
      }

      await batch.commit();
      res.json({ received: true });
    } catch (err: any) {
      logError({ endpoint: "webhooks/stripe", code: "INTERNAL", messageKo: "Stripe Webhook 처리 실패", err });
      res.status(500).send(`Internal Error: ${err.message}`);
    }
  });
}
