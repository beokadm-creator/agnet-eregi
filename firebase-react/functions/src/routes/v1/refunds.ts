import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth } from "../../lib/auth";
import { fail, ok, logError } from "../../lib/http";
import { Refund } from "../../lib/payment_models";
import { requireOpsRole } from "../../lib/ops_rbac";

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

      if (snap.data()?.status !== "approved") {
        return fail(res, 400, "FAILED_PRECONDITION", "approved 상태의 환불만 실행할 수 있습니다.");
      }

      const batch = db.batch();
      batch.update(docRef, {
        status: "executed",
        executedBy: opsId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

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
