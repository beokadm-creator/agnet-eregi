import * as admin from "firebase-admin";

const CPC_RATE = 500;
const CPM_RATE = 10000;

export async function executeAdBillingDailyBatch(db: admin.firestore.Firestore, targetDateStr: string, opsId: string): Promise<void> {
  const eventsSnap = await db.collection("ad_events")
    .where("targetDate", "==", targetDateStr)
    .where("isBilled", "==", false)
    .get();

  const partnerUsage: Record<string, {
    impressions: number,
    clicks: number,
    campaignIds: Set<string>
  }> = {};

  const eventDocsToUpdate: string[] = [];

  // Simple aggregation
  for (const doc of eventsSnap.docs) {
    const data = doc.data();
    const pid = data.partnerId;
    if (!pid) continue;

    if (!partnerUsage[pid]) {
      partnerUsage[pid] = { impressions: 0, clicks: 0, campaignIds: new Set() };
    }

    if (data.eventType === "impression") {
      partnerUsage[pid].impressions += 1;
    } else if (data.eventType === "click") {
      partnerUsage[pid].clicks += 1;
    }
    
    if (data.campaignId) {
      partnerUsage[pid].campaignIds.add(data.campaignId);
    }
    
    eventDocsToUpdate.push(doc.id);
  }

  for (const [partnerId, usage] of Object.entries(partnerUsage)) {
    await db.runTransaction(async (transaction) => {
      // In real world, we would check campaign type (CPC/CPM) and multiply
      // Here we assume standard CPC rate for clicks and CPM rate for impressions per 1000
      let billingAmount = 0;
      billingAmount += usage.clicks * CPC_RATE;
      billingAmount += Math.floor(usage.impressions / 1000) * CPM_RATE;

      if (billingAmount > 0) {
        const billingRef = db.collection("ad_billings").doc();
        transaction.set(billingRef, {
          id: billingRef.id,
          partnerId,
          targetDate: targetDateStr,
          validImpressions: usage.impressions,
          validClicks: usage.clicks,
          billingAmount,
          isSettled: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // check budget
        if (usage.campaignIds.size > 0) {
          for (const cid of Array.from(usage.campaignIds)) {
            const campRef = db.collection("ad_campaigns").doc(cid);
            const campDoc = await transaction.get(campRef);
            if (campDoc.exists) {
              const campData = campDoc.data() as any;
              // Very simple budget check
              if (campData.dailyBudget && billingAmount >= campData.dailyBudget) {
                transaction.update(campRef, { status: "budget_exhausted" });
              }
            }
          }
        }
      }
    });
  }

  // Mark events as billed (in chunks of 500 for firestore batch limit in real world, but simple here)
  const batch = db.batch();
  for (const eid of eventDocsToUpdate) {
    batch.update(db.collection("ad_events").doc(eid), { isBilled: true });
  }
  if (eventDocsToUpdate.length > 0) {
    await batch.commit();
  }

  await db.collection("ops_audit_events").add({
    action: "AD_BILLING_BATCH_GENERATED",
    actorId: opsId,
    targetId: targetDateStr,
    changes: { processedPartners: Object.keys(partnerUsage).length, processedEvents: eventDocsToUpdate.length },
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}
