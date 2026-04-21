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
    const batch = db.batch();

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = session.client_reference_id;
        
        if (paymentId) {
          const paymentRef = db.collection("payments").doc(paymentId);
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
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
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
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
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
