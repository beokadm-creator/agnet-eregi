import * as admin from "firebase-admin";
import { PartnerSubscription, SubscriptionPlan, BillingHistory } from "./subscription_models";

// PG사 정기결제(빌링키) 승인 모의 함수
// 실제 환경에서는 Stripe SDK 또는 TossPayments 빌링키 승인 API를 호출합니다.
export async function chargePaymentMethod(paymentMethodId: string, amount: number): Promise<boolean> {
  // 테스트 및 MVP를 위해 90% 확률로 결제 성공 모의
  return Math.random() < 0.9;
}

export async function executeSubscriptionBillingBatch(db: admin.firestore.Firestore, now: Date): Promise<void> {
  const nowTimestamp = admin.firestore.Timestamp.fromDate(now);

  // ------------------------------------------------------------------
  // 1. 만료일이 도래한 'active' 구독 처리 (갱신 또는 해지 예약 실행)
  // ------------------------------------------------------------------
  const activeSnap = await db.collection("partner_subscriptions")
    .where("status", "==", "active")
    .where("currentPeriodEnd", "<=", nowTimestamp)
    .get();

  for (const doc of activeSnap.docs) {
    const sub = doc.data() as PartnerSubscription;
    
    // 1-1. 해지 예약(cancelAtPeriodEnd)이 걸려있는 경우 -> 해지 처리
    if (sub.cancelAtPeriodEnd) {
      await doc.ref.update({
        status: "canceled",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      await db.collection("ops_audit_events").add({
        action: "SUBSCRIPTION_CANCELED",
        partnerId: sub.partnerId,
        subscriptionId: doc.id,
        reason: "cancelAtPeriodEnd reached",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      continue;
    }

    // 1-2. 갱신 (Renewal) 처리
    const planSnap = await db.collection("subscription_plans").doc(sub.planId).get();
    if (!planSnap.exists) continue;
    const plan = planSnap.data() as SubscriptionPlan;

    const success = await chargePaymentMethod(sub.paymentMethodId || "", plan.price);

    if (success) {
      // 결제 성공 -> 다음 주기로 연장
      const newStart = sub.currentPeriodEnd.toDate();
      const newEnd = new Date(newStart);
      if (plan.interval === "month") newEnd.setMonth(newEnd.getMonth() + 1);
      else newEnd.setFullYear(newEnd.getFullYear() + 1);

      await doc.ref.update({
        currentPeriodStart: admin.firestore.Timestamp.fromDate(newStart),
        currentPeriodEnd: admin.firestore.Timestamp.fromDate(newEnd),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await db.collection("billing_histories").add({
        partnerId: sub.partnerId,
        subscriptionId: doc.id,
        amount: plan.price,
        currency: plan.currency || "KRW",
        status: "paid",
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      } as BillingHistory);
    } else {
      // 결제 실패 -> past_due (연체/유예 상태)로 전환
      await doc.ref.update({
        status: "past_due",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await db.collection("billing_histories").add({
        partnerId: sub.partnerId,
        subscriptionId: doc.id,
        amount: plan.price,
        currency: plan.currency || "KRW",
        status: "failed",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      } as BillingHistory);

      await db.collection("ops_audit_events").add({
        action: "SUBSCRIPTION_PAST_DUE",
        partnerId: sub.partnerId,
        subscriptionId: doc.id,
        reason: "Payment failed during renewal",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  // ------------------------------------------------------------------
  // 2. 연체/유예 중인 'past_due' 구독 처리 (Dunning 프로세스)
  // ------------------------------------------------------------------
  const pastDueSnap = await db.collection("partner_subscriptions")
    .where("status", "==", "past_due")
    .get();

  for (const doc of pastDueSnap.docs) {
    const sub = doc.data() as PartnerSubscription;
    const daysPastDue = (now.getTime() - sub.currentPeriodEnd.toDate().getTime()) / (1000 * 3600 * 24);

    // 2-1. 유예 기간(Grace Period, 예: 7일) 초과 시 강제 해지
    if (daysPastDue > 7) {
      await doc.ref.update({
        status: "canceled",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      await db.collection("ops_audit_events").add({
        action: "SUBSCRIPTION_CANCELED_DUNNING_FAILED",
        partnerId: sub.partnerId,
        subscriptionId: doc.id,
        reason: `Grace period exceeded (${daysPastDue.toFixed(1)} days)`,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      continue;
    }

    // 2-2. 유예 기간 내 재결제 시도
    const planSnap = await db.collection("subscription_plans").doc(sub.planId).get();
    if (!planSnap.exists) continue;
    const plan = planSnap.data() as SubscriptionPlan;

    const success = await chargePaymentMethod(sub.paymentMethodId || "", plan.price);

    if (success) {
      // 재결제 성공 -> active 복귀 및 주기 연장
      const newStart = sub.currentPeriodEnd.toDate();
      const newEnd = new Date(newStart);
      if (plan.interval === "month") newEnd.setMonth(newEnd.getMonth() + 1);
      else newEnd.setFullYear(newEnd.getFullYear() + 1);

      // 만약 이미 한 달 이상 연체되어 newEnd도 과거라면 현재 기준으로 보정 (MVP 방어 로직)
      if (newEnd < now) {
        newEnd.setTime(now.getTime() + 30 * 24 * 3600 * 1000);
      }

      await doc.ref.update({
        status: "active",
        currentPeriodStart: admin.firestore.Timestamp.fromDate(newStart),
        currentPeriodEnd: admin.firestore.Timestamp.fromDate(newEnd),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await db.collection("billing_histories").add({
        partnerId: sub.partnerId,
        subscriptionId: doc.id,
        amount: plan.price,
        currency: plan.currency || "KRW",
        status: "paid",
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      } as BillingHistory);

      await db.collection("ops_audit_events").add({
        action: "SUBSCRIPTION_RECOVERED",
        partnerId: sub.partnerId,
        subscriptionId: doc.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // 재결제 실패 시 계속 past_due 상태 유지 (실패 이력만 추가)
      await db.collection("billing_histories").add({
        partnerId: sub.partnerId,
        subscriptionId: doc.id,
        amount: plan.price,
        currency: plan.currency || "KRW",
        status: "failed",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      } as BillingHistory);
    }
  }
}
