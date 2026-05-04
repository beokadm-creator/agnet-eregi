import * as admin from "firebase-admin";
import Stripe from "stripe";
import { Refund } from "./payment_models";
import { logError } from "./http";
import { getTossPaymentsSettings, tossCancelPayment, tossGetPaymentByPaymentKey } from "./tosspayments";

let stripeInstance: typeof Stripe.prototype | null = null;
function getStripe(): typeof Stripe.prototype {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("Stripe secret key is not configured.");
    }
    stripeInstance = new Stripe(key, { apiVersion: "2023-10-16" as any });
  }
  return stripeInstance;
}

export async function executeRefund(
  db: admin.firestore.Firestore,
  refundId: string,
  opsId: string
): Promise<void> {
  const docRef = db.collection("refunds").doc(refundId);
  
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new Error("NOT_FOUND: 환불 요청을 찾을 수 없습니다.");
  }

  const refundData = snap.data() as Refund;

  if (refundData.status !== "approved") {
    throw new Error("FAILED_PRECONDITION: approved 상태의 환불만 실행할 수 있습니다.");
  }

  const paymentSnap = await db.collection("payments").doc(refundData.paymentId).get();
  const paymentData = paymentSnap.data();

  if (paymentData?.provider === "stripe" && paymentData?.providerRef) {
    try {
      const stripe = getStripe();
      await stripe.refunds.create({
        payment_intent: paymentData.providerRef,
        amount: refundData.amount,
        reason: "requested_by_customer",
        metadata: {
          refundId: refundData.id || refundId,
          caseId: refundData.caseId,
          paymentId: refundData.paymentId
        }
      }, {
        idempotencyKey: refundId // Prevent duplicate refunds
      });
    } catch (stripeErr: any) {
      logError({ endpoint: "executeRefund", code: "INTERNAL", messageKo: "Stripe 환불 API 호출 실패", err: stripeErr });
      
      const auditRef = db.collection("audit_events").doc();
      await auditRef.set({
        action: "refund.executed",
        status: "fail",
        actorId: opsId,
        targetId: refundId,
        changes: { error: stripeErr.message },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      throw new Error(`Stripe 환불 실패: ${stripeErr.message}`);
    }
  } else if (paymentData?.provider === "tosspayments" && paymentData?.providerRef) {
    const settings = await getTossPaymentsSettings();
    if (!settings || !settings.enabled || !settings.secretKey) {
      throw new Error("FAILED_PRECONDITION: 토스페이먼츠 설정이 활성화되어 있지 않습니다.");
    }

    try {
      const tossPayment = await tossGetPaymentByPaymentKey({ secretKey: settings.secretKey, paymentKey: paymentData.providerRef });
      const isPartialCancelable = !!tossPayment?.isPartialCancelable;
      const balanceAmount = Number(tossPayment?.balanceAmount ?? NaN);

      if (!Number.isFinite(balanceAmount)) {
        throw new Error("Toss balanceAmount is not available");
      }
      if (refundData.amount > balanceAmount) {
        throw new Error(`INVALID_ARGUMENT: 취소 금액이 잔여 취소 가능 금액을 초과합니다. (balance=${balanceAmount})`);
      }
      if (!isPartialCancelable && refundData.amount !== balanceAmount) {
        throw new Error("FAILED_PRECONDITION: 부분 취소가 불가능한 결제입니다. 전액 취소만 가능합니다.");
      }
    } catch (precheckErr: any) {
      logError({ endpoint: "executeRefund", code: "INTERNAL", messageKo: "토스 결제 조회(사전검증) 실패", err: precheckErr });
      throw new Error(`토스 결제 조회 실패: ${precheckErr.message}`);
    }

    try {
      await tossCancelPayment({
        secretKey: settings.secretKey,
        paymentKey: paymentData.providerRef,
        cancelReason: refundData.reason || "운영자 요청",
        cancelAmount: refundData.amount,
        idempotencyKey: refundId
      });
    } catch (tossErr: any) {
      logError({ endpoint: "executeRefund", code: "INTERNAL", messageKo: "Toss 결제 취소 API 호출 실패", err: tossErr });

      const auditRef = db.collection("audit_events").doc();
      await auditRef.set({
        action: "refund.executed",
        status: "fail",
        actorId: opsId,
        targetId: refundId,
        changes: { error: tossErr.message },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      throw new Error(`토스 취소 실패: ${tossErr.message}`);
    }
  }

  const batch = db.batch();
  batch.update(docRef, {
    status: "executed",
    executedBy: opsId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (paymentSnap.exists) {
    const paymentAmount = Number(paymentData?.amount ?? NaN);
    const nextStatus =
      Number.isFinite(paymentAmount) && refundData.amount < paymentAmount ? "partially_refunded" : "refunded";

    batch.update(paymentSnap.ref, {
      status: nextStatus,
      refundedAmount: admin.firestore.FieldValue.increment(refundData.amount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  const auditRef = db.collection("audit_events").doc();
  batch.set(auditRef, {
    action: "refund.executed",
    actorId: opsId,
    targetId: refundId,
    changes: { status: "executed" },
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();
}
