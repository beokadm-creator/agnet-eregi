import * as admin from "firebase-admin";
import { logOpsEvent } from "./ops_audit";

export async function processOpsPrediction(adminApp: typeof admin) {
  const db = adminApp.firestore();
  
  console.log("[OpsPredictionWorker] Starting data-driven prediction batch...");

  // 1. ETA 예측 모델 업데이트 (파트너별 케이스 완료 시간 분석)
  await updateEtaPredictions(db);

  // 2. 승인 확률 예측 모델 업데이트 (운영자 수동 검토 이력 분석)
  await updateApprovalProbabilities(db);

  console.log("[OpsPredictionWorker] Prediction batch completed.");
}

async function updateEtaPredictions(db: admin.firestore.Firestore) {
  // 최근 90일 완료된 케이스 기준
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const casesSnap = await db.collection("cases")
    .where("status", "==", "completed")
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(ninetyDaysAgo))
    .get();

  const partnerTimes: Record<string, number[]> = {};

  casesSnap.docs.forEach(doc => {
    const data = doc.data();
    if (!data.partnerId || !data.createdAt || !data.completedAt) return;

    const created = data.createdAt.toDate().getTime();
    const completed = data.completedAt.toDate().getTime();
    const hours = (completed - created) / (1000 * 60 * 60);

    if (!partnerTimes[data.partnerId]) partnerTimes[data.partnerId] = [];
    partnerTimes[data.partnerId].push(hours);
  });

  const partnerStats: Record<string, any> = {};
  for (const [partnerId, times] of Object.entries(partnerTimes)) {
    times.sort((a, b) => a - b);
    const avgHours = times.reduce((a, b) => a + b, 0) / times.length;
    const p90Index = Math.floor(times.length * 0.9);
    const p90Hours = times[p90Index] || avgHours;

    partnerStats[partnerId] = {
      avgHours: Math.round(avgHours),
      p90Hours: Math.round(p90Hours),
      caseCount: times.length
    };
  }

  await db.collection("ops_predictions").doc("eta_stats_daily").set({
    type: "eta_stats",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    partnerStats
  });

  await logOpsEvent(db, "ops_prediction.eta_updated", "SUCCESS", "system_worker", "batch_eta", "system", {
    processedPartners: Object.keys(partnerStats).length
  });
}

async function updateApprovalProbabilities(db: admin.firestore.Firestore) {
  // 견적 초과 승인 (quote_approve) 이력 분석
  const approvalsSnap = await db.collection("ops_approvals")
    .where("gate", "==", "quote_approve")
    .where("status", "in", ["approved", "rejected"])
    .get();

  // 금액 구간(Bucket)별 승인율 계산용
  const buckets = [
    { min: 0, max: 500000, approved: 0, total: 0 },
    { min: 500000, max: 1000000, approved: 0, total: 0 },
    { min: 1000000, max: Infinity, approved: 0, total: 0 }
  ];

  approvalsSnap.docs.forEach(doc => {
    const data = doc.data();
    const finalPrice = data.context?.finalPrice || 0;
    const isApproved = data.status === "approved";

    const bucket = buckets.find(b => finalPrice >= b.min && finalPrice < b.max);
    if (bucket) {
      bucket.total++;
      if (isApproved) bucket.approved++;
    }
  });

  const processedBuckets = buckets.map(b => ({
    min: b.min,
    max: b.max === Infinity ? 99999999 : b.max,
    prob: b.total > 0 ? Number((b.approved / b.total).toFixed(2)) : 0,
    total: b.total
  }));

  await db.collection("ops_predictions").doc("approval_prob_daily").set({
    type: "approval_prob",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    gates: {
      quote_approve: { buckets: processedBuckets }
    }
  });

  await logOpsEvent(db, "ops_prediction.approval_prob_updated", "SUCCESS", "system_worker", "batch_prob", "system", {
    processedBuckets: processedBuckets.length
  });
}