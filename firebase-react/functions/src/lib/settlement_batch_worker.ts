import * as admin from "firebase-admin";
import { Settlement, SettlementItem } from "./settlement_models";

const PLATFORM_FEE_RATE = 0.1; // 10% fee

export async function executeSettlementBatch(db: admin.firestore.Firestore, periodEnd: Date, opsId: string): Promise<void> {
  // 1. Gather all payments that are captured and not settled
  const paymentsSnap = await db.collection("payments")
    .where("status", "==", "captured")
    .where("isSettled", "==", false)
    .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(periodEnd))
    .get();

  // 2. Gather all refunds that are executed and not settled
  const refundsSnap = await db.collection("refunds")
    .where("status", "==", "executed")
    .where("isSettled", "==", false)
    .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(periodEnd))
    .get();

  // 3. Gather all ad billings that are not settled
  const adBillingsSnap = await db.collection("ad_billings")
    .where("isSettled", "==", false)
    // usually targetDate <= periodEnd but let's just take all unsettled up to now
    .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(periodEnd))
    .get();

  // Group by partner
  const partnerData: Record<string, {
    payments: any[],
    refunds: any[],
    adBillings: any[],
    periodStart: Date
  }> = {};

  for (const doc of paymentsSnap.docs) {
    const data = doc.data();
    const pid = data.partnerId;
    if (!pid) continue;
    if (!partnerData[pid]) partnerData[pid] = { payments: [], refunds: [], adBillings: [], periodStart: data.createdAt.toDate() };
    partnerData[pid].payments.push({ id: doc.id, ...data });
    if (data.createdAt.toDate() < partnerData[pid].periodStart) partnerData[pid].periodStart = data.createdAt.toDate();
  }

  for (const doc of refundsSnap.docs) {
    const data = doc.data();
    const pid = data.partnerId;
    if (!pid) continue;
    if (!partnerData[pid]) partnerData[pid] = { payments: [], refunds: [], adBillings: [], periodStart: data.createdAt.toDate() };
    partnerData[pid].refunds.push({ id: doc.id, ...data });
    if (data.createdAt.toDate() < partnerData[pid].periodStart) partnerData[pid].periodStart = data.createdAt.toDate();
  }

  for (const doc of adBillingsSnap.docs) {
    const data = doc.data();
    const pid = data.partnerId;
    if (!pid) continue;
    if (!partnerData[pid]) partnerData[pid] = { payments: [], refunds: [], adBillings: [], periodStart: data.createdAt.toDate() };
    partnerData[pid].adBillings.push({ id: doc.id, ...data });
  }

  // Create settlements per partner
  for (const [partnerId, data] of Object.entries(partnerData)) {
    await db.runTransaction(async (transaction) => {
      let totalPayment = 0;
      let totalRefund = 0;
      let adDeduction = 0;

      const items: SettlementItem[] = [];
      const stRef = db.collection("settlements").doc();

      // Payments
      for (const p of data.payments) {
        totalPayment += p.amount;
        items.push({ id: `${stRef.id}_p_${p.id}`, settlementId: stRef.id, type: "payment", referenceId: p.id, amount: p.amount });
        transaction.update(db.collection("payments").doc(p.id), { isSettled: true, settlementId: stRef.id });
      }

      // Refunds
      for (const r of data.refunds) {
        totalRefund += r.amount;
        items.push({ id: `${stRef.id}_r_${r.id}`, settlementId: stRef.id, type: "refund", referenceId: r.id, amount: -r.amount });
        transaction.update(db.collection("refunds").doc(r.id), { isSettled: true, settlementId: stRef.id });
      }

      // Ad Billings
      for (const a of data.adBillings) {
        adDeduction += a.billingAmount;
        items.push({ id: `${stRef.id}_a_${a.id}`, settlementId: stRef.id, type: "ad_fee", referenceId: a.id, amount: -a.billingAmount });
        transaction.update(db.collection("ad_billings").doc(a.id), { isSettled: true, settlementId: stRef.id });
      }

      const grossAmount = totalPayment - totalRefund;
      const platformFee = Math.round(grossAmount * PLATFORM_FEE_RATE);
      let netAmount = grossAmount - platformFee - adDeduction;
      
      // If netAmount < 0, partner owes us. In MVP, we might just carry it over or leave it as negative
      
      const settlement: Settlement = {
        id: stRef.id,
        partnerId,
        periodStart: admin.firestore.Timestamp.fromDate(data.periodStart),
        periodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
        totalPaymentAmount: totalPayment,
        totalRefundAmount: totalRefund,
        platformFee,
        adDeductionAmount: adDeduction,
        netSettlementAmount: netAmount,
        status: "calculated",
        createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      transaction.set(stRef, settlement);

      for (const item of items) {
        transaction.set(db.collection("settlement_items").doc(item.id), item);
      }

      // Audit
      transaction.set(db.collection("ops_audit_events").doc(), {
        action: "SETTLEMENT_BATCH_GENERATED",
        actorId: opsId,
        targetId: stRef.id,
        changes: { netAmount },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
  }
}
