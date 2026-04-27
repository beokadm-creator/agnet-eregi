import * as express from "express";
import * as admin from "firebase-admin";
import Stripe from "stripe";

import { requireAuth } from "../../lib/auth";
import { fail, ok, logError } from "../../lib/http";
import { Payment } from "../../lib/payment_models";
import { tossConfirmPayment, getTossPaymentsSettings } from "../../lib/tosspayments";
import { getExchangeRate, convertCurrency } from "../../lib/exchange_rate";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2023-10-16" as any });

export function registerPaymentRoutes(app: express.Application, adminApp: typeof admin) {

  // POST /v1/user/payments
  app.post("/v1/user/payments", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const { amount, currency, caseId, submissionId, provider = "stripe", successUrl, cancelUrl } = req.body;

      const providerNormalized: "stripe" | "tosspayments" | "mock" =
        provider === "stripe" || provider === "tosspayments" || provider === "mock" ? provider : "stripe";

      if (!amount || !currency) {
        return fail(res, 400, "INVALID_ARGUMENT", "amount와 currency가 필요합니다.");
      }

      let finalAmount = amount;
      let finalCurrency = currency.toUpperCase();

      // EP-15-02: 토스페이먼츠 요청 시 타 통화라면 KRW로 강제 환산
      if (providerNormalized === "tosspayments" && finalCurrency !== "KRW") {
        finalAmount = await convertCurrency(amount, finalCurrency, "KRW");
        finalCurrency = "KRW";
      }

      const db = adminApp.firestore();
      const docRef = db.collection("payments").doc();

      const payment: any = {
        userId,
        caseId: caseId || null,
        submissionId: submissionId || null,
        amount: finalAmount,                   // 프로바이더 전달용 최종 금액
        currency: finalCurrency,               // 프로바이더 전달용 최종 통화
        originalAmount: amount,                // 고객이 요청한 원본 금액
        originalCurrency: currency.toUpperCase(), 
        exchangeRate: finalCurrency !== currency.toUpperCase() 
          ? await getExchangeRate(currency.toUpperCase(), finalCurrency) 
          : 1,
        status: "initiated",
        provider: providerNormalized,
        refundedAmount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      const batch = db.batch();
      let tossClientKeyForResponse: string | undefined;

      if (providerNormalized === "stripe") {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: finalCurrency.toLowerCase(),
              product_data: {
                name: `Payment for Case ${caseId || submissionId || 'Unknown'}`,
              },
              unit_amount: Math.round(finalAmount * 100), // Stripe uses smallest currency unit (cents for USD)
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: successUrl || 'http://localhost:5173',
          cancel_url: cancelUrl || 'http://localhost:5173',
          client_reference_id: docRef.id,
          metadata: {
            paymentId: docRef.id,
            userId,
            caseId: caseId || "",
            submissionId: submissionId || ""
          }
        }, {
          idempotencyKey: docRef.id 
        });

        payment.checkoutUrl = session.url || undefined;
        payment.providerRef = session.id;
      } else if (providerNormalized === "tosspayments") {
        // 토스 결제위젯은 클라이언트에서 결제 요청을 수행하므로,
        // 서버는 clientKey를 내려주고 orderId(=paymentId), amount를 내려줍니다.
        const settings = await getTossPaymentsSettings();
        if (!settings || !settings.enabled || !settings.clientKey || !settings.secretKey) {
          return fail(res, 500, "FAILED_PRECONDITION", "토스페이먼츠 설정이 활성화되어 있지 않습니다.");
        }
        // 보안: clientKey만 응답( secretKey는 절대 내려주지 않음 )
        tossClientKeyForResponse = settings.clientKey;
      }

      batch.set(docRef, payment);

      // Audit log
      const auditRef = db.collection("audit_events").doc();
      batch.set(auditRef, {
        action: "payment.created",
        actorId: userId,
        targetId: docRef.id,
        changes: { amount, currency, status: "initiated" },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      // provider별로 클라이언트에 필요한 추가 필드를 포함
      const responsePayment: any = { id: docRef.id, ...payment };
      if (providerNormalized === "tosspayments") {
        responsePayment.orderId = docRef.id;
        responsePayment.clientKey = tossClientKeyForResponse;
      }

      return ok(res, { payment: responsePayment });
    } catch (err: any) {
      logError({ endpoint: "user/payments/create", code: "INTERNAL", messageKo: "결제 생성 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // POST /v1/user/payments/:paymentId/confirm
  app.post("/v1/user/payments/:paymentId/confirm", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const paymentId = String(req.params.paymentId);
      const { paymentKey, orderId, amount } = req.body;

      const db = adminApp.firestore();
      const docRef = db.collection("payments").doc(paymentId);
      
      const snap = await docRef.get();
      if (!snap.exists || snap.data()?.userId !== userId) {
        return fail(res, 404, "NOT_FOUND", "결제 내역을 찾을 수 없습니다.");
      }

      if (snap.data()?.status !== "initiated") {
        return fail(res, 400, "FAILED_PRECONDITION", "initiated 상태의 결제만 confirm 할 수 있습니다.");
      }

      const paymentData = snap.data() as Payment;

      if (paymentData.provider === "stripe") {
        // 기존 방식 유지: (Stripe는 webhook이 최종 캡처를 반영)
        const batch = db.batch();
        batch.update(docRef, {
          status: "captured",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const auditRef = db.collection("audit_events").doc();
        batch.set(auditRef, {
          action: "payment.captured",
          actorId: userId,
          targetId: paymentId,
          changes: { status: "captured" },
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        return ok(res, { message: "결제가 확인 및 승인되었습니다.", status: "captured" });
      }

      if (paymentData.provider !== "tosspayments") {
        return fail(res, 400, "FAILED_PRECONDITION", "지원하지 않는 결제 프로바이더입니다.");
      }

      if (!paymentKey || !orderId || typeof amount !== "number") {
        return fail(res, 400, "INVALID_ARGUMENT", "paymentKey, orderId, amount가 필요합니다.");
      }
      if (orderId !== paymentId) {
        return fail(res, 400, "INVALID_ARGUMENT", "orderId가 올바르지 않습니다.");
      }
      if (amount !== paymentData.amount) {
        return fail(res, 400, "INVALID_ARGUMENT", "결제 금액이 일치하지 않습니다.");
      }

      const settings = await getTossPaymentsSettings();
      if (!settings || !settings.enabled || !settings.secretKey) {
        return fail(res, 500, "FAILED_PRECONDITION", "토스페이먼츠 설정이 활성화되어 있지 않습니다.");
      }

      // 멱등키: paymentId (재시도 시 중복 승인 방지)
      const tossPayment = await tossConfirmPayment({
        secretKey: settings.secretKey,
        paymentKey,
        orderId,
        amount,
        idempotencyKey: paymentId
      });

      const batch = db.batch();
      batch.update(docRef, {
        status: "captured",
        providerRef: paymentKey,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const auditRef = db.collection("audit_events").doc();
      batch.set(auditRef, {
        action: "payment.captured",
        actorId: userId,
        targetId: paymentId,
        changes: { status: "captured", providerRef: paymentKey },
        meta: { toss_paymentKey: paymentKey, toss_orderId: orderId, toss_status: tossPayment?.status || null },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      return ok(res, { message: "결제가 승인되었습니다.", status: "captured" });
    } catch (err: any) {
      logError({ endpoint: "user/payments/confirm", code: "INTERNAL", messageKo: "결제 확인 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // GET /v1/user/payments
  app.get("/v1/user/payments", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const caseId = req.query.caseId as string;
      const submissionId = req.query.submissionId as string;
      const db = adminApp.firestore();

      let query = db.collection("payments").where("userId", "==", userId);
      if (caseId) {
        query = query.where("caseId", "==", caseId);
      }
      if (submissionId) {
        query = query.where("submissionId", "==", submissionId);
      }

      const snap = await query.orderBy("createdAt", "desc").get();
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "user/payments/list", code: "INTERNAL", messageKo: "결제 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

}
