import * as express from "express";
import * as admin from "firebase-admin";
import Stripe from "stripe";

import { requireAuth } from "../../lib/auth";
import { fail, ok, logError } from "../../lib/http";
import { Refund } from "../../lib/payment_models";
import { requireOpsRole } from "../../lib/ops_rbac";
import { getTossPaymentsSettings, tossCancelPayment, tossGetPaymentByPaymentKey } from "../../lib/tosspayments";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2023-10-16" as any });

export function registerRefundRoutes(app: express.Application, adminApp: typeof admin) {

  // POST /v1/partner/cases/:caseId/refunds
  app.post("/v1/partner/cases/:caseId/refunds", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const partnerId = auth.uid; // assuming partnerId is auth.uid for partner API
      const caseId = String(req.params.caseId);
      const { paymentId, amount, reason } = req.body;

      if (!paymentId || !amount || !reason) {
        return fail(res, 400, "INVALID_ARGUMENT", "paymentId, amount, reason이 필요합니다.");
      }

      const db = adminApp.firestore();
      
      // Verify payment exists
      const paymentSnap = await db.collection("payments").doc(paymentId).get();
      if (!paymentSnap.exists) {
        return fail(res, 404, "NOT_FOUND", "결제 내역을 찾을 수 없습니다.");
      }

      const docRef = db.collection("refunds").doc();

      const refund: Refund = {
        caseId,
        paymentId,
        partnerId,
        amount,
        reason,
        status: "requested",
        requestedBy: partnerId,
        createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      const batch = db.batch();
      batch.set(docRef, refund);

      // Audit log
      const auditRef = db.collection("audit_events").doc();
      batch.set(auditRef, {
        action: "refund.requested",
        actorId: partnerId,
        targetId: docRef.id,
        changes: { amount, reason, status: "requested" },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      return ok(res, { refund: { id: docRef.id, ...refund } });
    } catch (err: any) {
      logError({ endpoint: "partner/refunds/create", code: "INTERNAL", messageKo: "환불 요청 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // POST /v1/ops/cases/:caseId/refunds/:refundId/approve
  app.post("/v1/ops/cases/:caseId/refunds/:refundId/approve", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const isAuthorized = await requireOpsRole(adminApp, req, res, auth, "ops_operator", "global");
      if (!isAuthorized) return;

      const opsId = auth.uid;
      const refundId = String(req.params.refundId);

      const db = adminApp.firestore();
      const docRef = db.collection("refunds").doc(refundId);
      
      const snap = await docRef.get();
      if (!snap.exists) {
        return fail(res, 404, "NOT_FOUND", "환불 요청을 찾을 수 없습니다.");
      }

      if (snap.data()?.status !== "requested") {
        return fail(res, 400, "FAILED_PRECONDITION", "requested 상태의 환불만 승인할 수 있습니다.");
      }

      const batch = db.batch();
      batch.update(docRef, {
        status: "approved",
        approvedBy: opsId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Audit log
      const auditRef = db.collection("audit_events").doc();
      batch.set(auditRef, {
        action: "refund.approved",
        actorId: opsId,
        targetId: refundId,
        changes: { status: "approved" },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      return ok(res, { message: "환불이 승인되었습니다.", status: "approved" });
    } catch (err: any) {
      logError({ endpoint: "ops/refunds/approve", code: "INTERNAL", messageKo: "환불 승인 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // POST /v1/ops/cases/:caseId/refunds/:refundId/execute
  app.post("/v1/ops/cases/:caseId/refunds/:refundId/execute", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const isAuthorized = await requireOpsRole(adminApp, req, res, auth, "ops_admin", "global");
      if (!isAuthorized) return;

      const opsId = auth.uid;
      const refundId = String(req.params.refundId);

      const db = adminApp.firestore();
      const docRef = db.collection("refunds").doc(refundId);
      
      const snap = await docRef.get();
      if (!snap.exists) {
        return fail(res, 404, "NOT_FOUND", "환불 요청을 찾을 수 없습니다.");
      }

      const refundData = snap.data() as Refund;

      if (refundData.status !== "approved") {
        return fail(res, 400, "FAILED_PRECONDITION", "approved 상태의 환불만 실행할 수 있습니다.");
      }

      const paymentSnap = await db.collection("payments").doc(refundData.paymentId).get();
      const paymentData = paymentSnap.data();

      if (paymentData?.provider === "stripe" && paymentData?.providerRef) {
        try {
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
          logError({ endpoint: "ops/refunds/execute", code: "INTERNAL", messageKo: "Stripe 환불 API 호출 실패", err: stripeErr });
          
          // Update refund status to error or something, but we just return error here
          const auditRef = db.collection("audit_events").doc();
          await auditRef.set({
            action: "refund.executed",
            status: "fail",
            actorId: opsId,
            targetId: refundId,
            changes: { error: stripeErr.message },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          return fail(res, 500, "INTERNAL", `Stripe 환불 실패: ${stripeErr.message}`);
        }
      } else if (paymentData?.provider === "tosspayments" && paymentData?.providerRef) {
        const settings = await getTossPaymentsSettings();
        if (!settings || !settings.enabled || !settings.secretKey) {
          return fail(res, 500, "FAILED_PRECONDITION", "토스페이먼츠 설정이 활성화되어 있지 않습니다.");
        }

        // 부분 취소 지원: refundData.amount를 cancelAmount로 사용
        // 사전 검증: 토스 결제 조회로 부분취소 가능 여부/잔액 확인(가능하면)
        try {
          const tossPayment = await tossGetPaymentByPaymentKey({ secretKey: settings.secretKey, paymentKey: paymentData.providerRef });
          const isPartialCancelable = !!tossPayment?.isPartialCancelable;
          const balanceAmount = Number(tossPayment?.balanceAmount ?? NaN);

          if (!Number.isFinite(balanceAmount)) {
            throw new Error("Toss balanceAmount is not available");
          }
          if (refundData.amount > balanceAmount) {
            return fail(res, 400, "INVALID_ARGUMENT", `취소 금액이 잔여 취소 가능 금액을 초과합니다. (balance=${balanceAmount})`);
          }
          if (!isPartialCancelable && refundData.amount !== balanceAmount) {
            return fail(res, 400, "FAILED_PRECONDITION", "부분 취소가 불가능한 결제입니다. 전액 취소만 가능합니다.");
          }
        } catch (precheckErr: any) {
          logError({ endpoint: "ops/refunds/execute", code: "INTERNAL", messageKo: "토스 결제 조회(사전검증) 실패", err: precheckErr });
          return fail(res, 500, "INTERNAL", `토스 결제 조회 실패: ${precheckErr.message}`);
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
          logError({ endpoint: "ops/refunds/execute", code: "INTERNAL", messageKo: "Toss 결제 취소 API 호출 실패", err: tossErr });

          const auditRef = db.collection("audit_events").doc();
          await auditRef.set({
            action: "refund.executed",
            status: "fail",
            actorId: opsId,
            targetId: refundId,
            changes: { error: tossErr.message },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          return fail(res, 500, "INTERNAL", `토스 취소 실패: ${tossErr.message}`);
        }
      }

      const batch = db.batch();
      batch.update(docRef, {
        status: "executed",
        executedBy: opsId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      if (paymentSnap.exists) {
        // 부분 취소 지원: amount가 전체 금액이면 refunded, 아니면 partially_refunded
        const paymentAmount = Number(paymentData?.amount ?? NaN);
        const nextStatus =
          Number.isFinite(paymentAmount) && refundData.amount < paymentAmount ? "partially_refunded" : "refunded";

        batch.update(paymentSnap.ref, {
          status: nextStatus,
          refundedAmount: admin.firestore.FieldValue.increment(refundData.amount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Audit log
      const auditRef = db.collection("audit_events").doc();
      batch.set(auditRef, {
        action: "refund.executed",
        actorId: opsId,
        targetId: refundId,
        changes: { status: "executed" },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      return ok(res, { message: "환불이 실행되었습니다.", status: "executed" });
    } catch (err: any) {
      logError({ endpoint: "ops/refunds/execute", code: "INTERNAL", messageKo: "환불 실행 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // GET /v1/partner/cases/:caseId/refunds
  app.get("/v1/partner/cases/:caseId/refunds", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const partnerId = auth.uid;
      const caseId = String(req.params.caseId);
      const db = adminApp.firestore();

      const snap = await db.collection("refunds")
        .where("partnerId", "==", partnerId)
        .where("caseId", "==", caseId)
        .orderBy("createdAt", "desc")
        .get();

      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "partner/refunds/list", code: "INTERNAL", messageKo: "환불 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // GET /v1/ops/cases/:caseId/refunds
  app.get("/v1/ops/cases/:caseId/refunds", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const isAuthorized = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", "global");
      if (!isAuthorized) return;

      const caseId = String(req.params.caseId);
      const db = adminApp.firestore();

      const snap = await db.collection("refunds")
        .where("caseId", "==", caseId)
        .orderBy("createdAt", "desc")
        .get();

      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "ops/refunds/list", code: "INTERNAL", messageKo: "환불 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

}
