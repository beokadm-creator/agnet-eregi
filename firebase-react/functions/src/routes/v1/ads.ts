import { Express } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { executeAdBillingDailyBatch } from "../../lib/ad_billing_worker";

export function registerAdRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. [유저] 스폰서 광고 노출/클릭 트래킹 이벤트 (POST /v1/ads/events)
  app.post("/v1/ads/events", async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const { partnerId, campaignId, eventType, source } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";

    if (!partnerId || !eventType || !["impression", "click"].includes(eventType)) {
      return fail(res, 400, "INVALID_ARGUMENT", "유효한 이벤트 정보가 필요합니다.", { requestId });
    }

    try {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const eventRef = db.collection("ad_events").doc();
      
      await eventRef.set({
        id: eventRef.id,
        partnerId,
        campaignId: campaignId || null,
        eventType,
        source: source || "unknown",
        ipHash: Buffer.from(ipAddress).toString("base64"), // simple hash
        targetDate: today,
        isBilled: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // No content response for tracking
      return res.status(204).send();
    } catch (error: any) {
      logError("POST /v1/ads/events", "N/A", "INTERNAL", "광고 트래킹 중 오류가 발생했습니다.", error, requestId);
      return res.status(500).send();
    }
  });

  // 2. [운영자 전용] 광고 일일 과금 배치 실행 (POST /v1/ops/ads/batch)
  app.post("/v1/ops/ads/batch", requireAuth, async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const uid = req.user!.uid;
    const isOps = req.user!.isOps;
    const { targetDate } = req.body; // YYYY-MM-DD

    if (!isOps) {
      return fail(res, 403, "PERMISSION_DENIED", "운영자만 접근 가능한 기능입니다.", { requestId });
    }
    if (!targetDate) {
      return fail(res, 400, "INVALID_ARGUMENT", "targetDate (YYYY-MM-DD) 가 필요합니다.", { requestId });
    }

    try {
      await executeAdBillingDailyBatch(db, targetDate, uid);
      return ok(res, { message: "광고 과금 배치가 완료되었습니다." }, requestId);
    } catch (error: any) {
      logError("POST /v1/ops/ads/batch", "N/A", "INTERNAL", "광고 과금 배치 실행 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "광고 과금 배치 실행에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 3. [파트너] 광고 캠페인 조회 및 생성 (GET/POST /v1/partner/ads/campaigns)
  app.get("/v1/partner/ads/campaigns", requireAuth, async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const isPartner = req.user!.partnerId != null;
    const reqPartnerId = req.user!.partnerId;

    if (!isPartner) {
      return fail(res, 403, "PERMISSION_DENIED", "파트너만 접근 가능합니다.", { requestId });
    }

    try {
      const snap = await db.collection("ad_campaigns")
        .where("partnerId", "==", reqPartnerId)
        .get();
      
      const campaigns = snap.docs.map(doc => doc.data());
      return ok(res, { campaigns }, requestId);
    } catch (error: any) {
      return fail(res, 500, "INTERNAL", "캠페인 조회 실패", { error: error.message, requestId });
    }
  });

  app.post("/v1/partner/ads/campaigns", requireAuth, async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const isPartner = req.user!.partnerId != null;
    const reqPartnerId = req.user!.partnerId;
    const { type, bidAmount, dailyBudget } = req.body;

    if (!isPartner) {
      return fail(res, 403, "PERMISSION_DENIED", "파트너만 접근 가능합니다.", { requestId });
    }

    try {
      const ref = db.collection("ad_campaigns").doc();
      const campaign = {
        id: ref.id,
        partnerId: reqPartnerId,
        status: "active",
        type: type || "CPC",
        bidAmount: bidAmount || 500,
        dailyBudget: dailyBudget || 10000,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await ref.set(campaign);
      return ok(res, campaign, requestId);
    } catch (error: any) {
      return fail(res, 500, "INTERNAL", "캠페인 생성 실패", { error: error.message, requestId });
    }
  });
}