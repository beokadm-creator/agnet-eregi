import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth } from "../../lib/auth";
import { fail, ok, logError } from "../../lib/http";
import { PartnerSubscription } from "../../lib/subscription_models";
import { executeSubscriptionBillingBatch } from "../../lib/subscription_worker";

export function registerSubscriptionRoutes(app: express.Application, adminApp: typeof admin) {
  
  // 1) GET /v1/subscriptions/plans - 활성화된 전체 구독 플랜 목록 조회
  app.get("/v1/subscriptions/plans", async (req: express.Request, res: express.Response) => {
    try {
      const db = adminApp.firestore();
      const snap = await db.collection("subscription_plans").where("active", "==", true).get();
      const plans = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      return ok(res, { plans });
    } catch (err: any) {
      logError({ endpoint: "GET /v1/subscriptions/plans", code: "INTERNAL", messageKo: "플랜 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 2) GET /v1/partner/subscription - 현재 로그인된 파트너의 구독 상태 조회
  app.get("/v1/partner/subscription", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const partnerId = auth.partnerId;
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const db = adminApp.firestore();
      const snap = await db.collection("partner_subscriptions")
        .where("partnerId", "==", partnerId)
        .limit(1)
        .get();

      if (snap.empty) {
        return ok(res, { subscription: null });
      }

      const subscription = { id: snap.docs[0].id, ...snap.docs[0].data() };
      return ok(res, { subscription });
    } catch (err: any) {
      logError({ endpoint: "GET /v1/partner/subscription", code: "INTERNAL", messageKo: "구독 정보 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 3) POST /v1/partner/subscription/subscribe - 신규 구독 생성 및 기존 구독 플랜 변경
  app.post("/v1/partner/subscription/subscribe", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const partnerId = auth.partnerId;
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const { planId, paymentMethodId } = req.body;
      if (!planId) return fail(res, 400, "INVALID_ARGUMENT", "planId가 필요합니다.");

      const db = adminApp.firestore();
      
      // 플랜 유효성 검증
      const planRef = db.collection("subscription_plans").doc(planId);
      const planSnap = await planRef.get();
      if (!planSnap.exists || !planSnap.data()?.active) {
        return fail(res, 404, "NOT_FOUND", "유효하지 않은 구독 플랜입니다.");
      }

      const subQuery = await db.collection("partner_subscriptions")
        .where("partnerId", "==", partnerId)
        .limit(1)
        .get();

      const now = admin.firestore.FieldValue.serverTimestamp();
      
      // 결제 주기 모의 설정 (Phase 1 기준, 30일 뒤 만료)
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);
      const currentPeriodEnd = admin.firestore.Timestamp.fromDate(periodEnd);

      if (subQuery.empty) {
        // 신규 구독 생성
        const newSubRef = db.collection("partner_subscriptions").doc();
        const newSub: PartnerSubscription = {
          partnerId,
          planId,
          status: "active",
          currentPeriodStart: now as admin.firestore.Timestamp,
          currentPeriodEnd: currentPeriodEnd,
          cancelAtPeriodEnd: false,
          paymentMethodId: paymentMethodId || null,
          createdAt: now as admin.firestore.Timestamp,
          updatedAt: now as admin.firestore.Timestamp
        };
        await newSubRef.set(newSub);
        return ok(res, { subscription: { id: newSubRef.id, ...newSub } });
      } else {
        // 기존 구독 업데이트(플랜 업그레이드/다운그레이드)
        const subDoc = subQuery.docs[0];
        await subDoc.ref.update({
          planId,
          status: "active",
          cancelAtPeriodEnd: false,
          paymentMethodId: paymentMethodId || subDoc.data().paymentMethodId,
          updatedAt: now
        });
        
        const updatedSnap = await subDoc.ref.get();
        return ok(res, { subscription: { id: updatedSnap.id, ...updatedSnap.data() } });
      }
    } catch (err: any) {
      logError({ endpoint: "POST /v1/partner/subscription/subscribe", code: "INTERNAL", messageKo: "구독 처리 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 4) POST /v1/partner/subscription/cancel - 구독 취소 예약
  app.post("/v1/partner/subscription/cancel", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const partnerId = auth.partnerId;
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const db = adminApp.firestore();
      const subQuery = await db.collection("partner_subscriptions")
        .where("partnerId", "==", partnerId)
        .limit(1)
        .get();

      if (subQuery.empty) {
        return fail(res, 404, "NOT_FOUND", "활성화된 구독 정보가 없습니다.");
      }

      const subDoc = subQuery.docs[0];
      // 남은 기간 동안은 유지하고 다음 결제일에 취소되도록 플래그 업데이트
      await subDoc.ref.update({
        cancelAtPeriodEnd: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return ok(res, { message: "구독이 다음 결제일에 취소되도록 예약되었습니다." });
    } catch (err: any) {
      logError({ endpoint: "POST /v1/partner/subscription/cancel", code: "INTERNAL", messageKo: "구독 취소 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 5) GET /v1/partner/subscription/billing-history - 청구 내역 목록
  app.get("/v1/partner/subscription/billing-history", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const partnerId = auth.partnerId;
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const db = adminApp.firestore();
      const snap = await db.collection("billing_histories")
        .where("partnerId", "==", partnerId)
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();

      const histories = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return ok(res, { histories });
    } catch (err: any) {
      logError({ endpoint: "GET /v1/partner/subscription/billing-history", code: "INTERNAL", messageKo: "결제 내역 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 6) POST /v1/ops/subscriptions/batch - [운영자 전용] 구독 결제/연체 배치 강제 실행
  app.post("/v1/ops/subscriptions/batch", async (req: express.Request, res: express.Response) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const isOps = (req as any).user?.isOps;
    
    if (!isOps) {
      return fail(res, 403, "FORBIDDEN", "운영자 권한이 필요합니다.");
    }

    try {
      const db = adminApp.firestore();
      const targetDate = req.body.targetDate ? new Date(req.body.targetDate) : new Date();
      
      await executeSubscriptionBillingBatch(db, targetDate);

      return ok(res, { message: "구독 정기결제 및 연체(Dunning) 배치가 완료되었습니다." });
    } catch (err: any) {
      logError({ endpoint: "POST /v1/ops/subscriptions/batch", code: "INTERNAL", messageKo: "구독 배치 실행 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });
}
