import * as express from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";

export function registerOpsPredictionRoutes(app: express.Application, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 파트너 ETA 예측 조회 (유저 퍼널 또는 파트너 제안 시)
  app.get("/v1/predictions/eta/:partnerId", requireAuth, async (req: express.Request, res: express.Response) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = String(req.params.partnerId);

    try {
      const doc = await db.collection("ops_predictions").doc("eta_stats_daily").get();
      if (!doc.exists) {
        return ok(res, { partnerId, avgHours: 24, p90Hours: 72, fallback: true }, requestId);
      }

      const data = doc.data();
      const stats = data?.partnerStats?.[partnerId];

      if (!stats) {
        return ok(res, { partnerId, avgHours: 24, p90Hours: 72, fallback: true }, requestId);
      }

      return ok(res, { partnerId, ...stats, fallback: false }, requestId);
    } catch (err: any) {
      logError({ endpoint: "GET /v1/predictions/eta/:partnerId", code: "INTERNAL", messageKo: "ETA 예측 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message, { requestId });
    }
  });

  // 2. 승인 확률 조회 (파트너가 고액 견적을 확정하려 할 때 경고용)
  app.get("/v1/predictions/approval-probability", requireAuth, async (req: express.Request, res: express.Response) => {
    const requestId = (req as any).requestId || "req-unknown";
    const gate = String(req.query.gate || "quote_approve");
    const amount = Number(req.query.amount || 0);

    try {
      const doc = await db.collection("ops_predictions").doc("approval_prob_daily").get();
      if (!doc.exists) {
        return ok(res, { gate, amount, probability: 0.5, fallback: true }, requestId);
      }

      const data = doc.data();
      const buckets = data?.gates?.[gate]?.buckets || [];

      const targetBucket = buckets.find((b: any) => amount >= b.min && amount < b.max);
      const probability = targetBucket ? targetBucket.prob : 0.5;

      return ok(res, { 
        gate, 
        amount, 
        probability, 
        isHighRisk: probability < 0.3,
        fallback: false 
      }, requestId);
    } catch (err: any) {
      logError({ endpoint: "GET /v1/predictions/approval-probability", code: "INTERNAL", messageKo: "승인 확률 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message, { requestId });
    }
  });
}