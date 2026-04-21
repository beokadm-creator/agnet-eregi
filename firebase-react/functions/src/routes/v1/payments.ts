import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth } from "../../lib/auth";
import { fail, ok, logError } from "../../lib/http";
import { Payment } from "../../lib/payment_models";

export function registerPaymentRoutes(app: express.Application, adminApp: typeof admin) {

  // POST /v1/user/payments
  app.post("/v1/user/payments", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const { amount, currency, caseId, submissionId } = req.body;

      if (!amount || !currency) {
        return fail(res, 400, "INVALID_ARGUMENT", "amount와 currency가 필요합니다.");
      }

      const db = adminApp.firestore();
      const docRef = db.collection("payments").doc();

      const payment: Payment = {
        userId,
        caseId: caseId || null,
        submissionId: submissionId || null,
        amount,
        currency,
        status: "initiated",
        createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      const batch = db.batch();
      batch.set(docRef, payment);

      // Audit log
      const auditRef = db.collection("audit_events").doc();
      batch.set(auditRef, {
        action: "payment.created",
        actorId: userId,
        targetId: docRef.id,
        changes: { amount, currency, status: "initiated" },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      return ok(res, { payment: { id: docRef.id, ...payment } });
    } catch (err: any) {
      logError({ endpoint: "user/payments/create", code: "INTERNAL", messageKo: "결제 생성 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // POST /v1/user/payments/:paymentId/confirm
  app.post("/v1/user/payments/:paymentId/confirm", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const paymentId = String(req.params.paymentId);

      const db = adminApp.firestore();
      const docRef = db.collection("payments").doc(paymentId);
      
      const snap = await docRef.get();
      if (!snap.exists || snap.data()?.userId !== userId) {
        return fail(res, 404, "NOT_FOUND", "결제 내역을 찾을 수 없습니다.");
      }

      if (snap.data()?.status !== "initiated") {
        return fail(res, 400, "FAILED_PRECONDITION", "initiated 상태의 결제만 confirm 할 수 있습니다.");
      }

      const batch = db.batch();
      batch.update(docRef, {
        status: "captured",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Audit log
      const auditRef = db.collection("audit_events").doc();
      batch.set(auditRef, {
        action: "payment.captured",
        actorId: userId,
        targetId: paymentId,
        changes: { status: "captured" },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      return ok(res, { message: "결제가 확인 및 승인되었습니다.", status: "captured" });
    } catch (err: any) {
      logError({ endpoint: "user/payments/confirm", code: "INTERNAL", messageKo: "결제 확인 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // GET /v1/user/payments
  app.get("/v1/user/payments", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const caseId = req.query.caseId as string;
      const submissionId = req.query.submissionId as string;
      const db = adminApp.firestore();

      let query = db.collection("payments").where("userId", "==", userId);
      if (caseId) {
        query = query.where("caseId", "==", caseId);
      }
      if (submissionId) {
        query = query.where("submissionId", "==", submissionId);
      }

      const snap = await query.orderBy("createdAt", "desc").get();
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "user/payments/list", code: "INTERNAL", messageKo: "결제 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

}
