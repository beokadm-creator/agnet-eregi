import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { safeQuery } from "../../lib/ops_query_health";
import { processApprovalAction } from "../../lib/ops_approval_worker";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerOpsReviewRoutes(app: express.Application, adminApp: typeof admin) {
  app.get("/v1/ops/reviews/pending", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = req.query.gateKey ? String(req.query.gateKey) : undefined;
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", gateKey);
      if (!hasRole) return;

      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const db = adminApp.firestore();

      const approvalsQuery = db
        .collection("ops_approvals")
        .where("status", "==", "pending")
        .orderBy("createdAt", "asc")
        .limit(limit);

      const approvalsSnap = await safeQuery(adminApp, gateKey || "unknown", "ops_approvals_pending_query", async () => await approvalsQuery.get(), null);
      if (!approvalsSnap) return fail(res, 500, "FAILED_PRECONDITION", "Query Health에 의해 차단되었습니다.");

      const approvals = approvalsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      let incidents: any[] = [];
      try {
        let incidentsQuery: admin.firestore.Query = db.collection("ops_incidents");
        if (gateKey) incidentsQuery = incidentsQuery.where("gateKey", "==", gateKey);
        incidentsQuery = incidentsQuery.orderBy("startAt", "desc").limit(Math.min(limit, 50));
        const incidentsSnap = await safeQuery(adminApp, gateKey || "unknown", "ops_incidents_review_query", async () => await incidentsQuery.get(), null);
        incidents = incidentsSnap ? incidentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
      } catch (e) {
        incidents = [];
      }

      return ok(res, { approvals, incidents });
    } catch (err: any) {
      logError({ endpoint: "ops/reviews/pending", code: "INTERNAL", messageKo: "Review Queue 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  app.post("/v1/ops/approvals/:approvalId/approve", async (req: express.Request, res: express.Response) => {
    const requestId = req.requestId || "req-unknown";
    const approvalId = String(req.params.approvalId);

    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = req.query.gateKey ? String(req.query.gateKey) : undefined;
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_operator", gateKey);
      if (!hasRole) return;

      const db = adminApp.firestore();
      const approvalRef = db.collection("ops_approvals").doc(approvalId);
      const approvalDoc = await approvalRef.get();
      if (!approvalDoc.exists) return fail(res, 404, "NOT_FOUND", "해당 승인 요청을 찾을 수 없습니다.", { requestId });

      const approvalData = approvalDoc.data() as any;
      if (approvalData.status !== "pending") return fail(res, 400, "FAILED_PRECONDITION", "이미 처리된 승인 요청입니다.", { requestId });

      await approvalRef.update({
        status: "approved",
        reviewedBy: auth.uid,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      try {
        await processApprovalAction(db, approvalData, auth.uid);
      } catch (execError: any) {
        await approvalRef.update({
          status: "failed_execution",
          executionError: execError.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return fail(res, 500, "INTERNAL", "승인은 처리되었으나, 후속 작업 실행에 실패했습니다.", { error: execError.message, requestId });
      }

      await logOpsEvent(adminApp, {
        gateKey: approvalData.gateKey || gateKey || "unknown",
        action: "ops_approvals.approve",
        status: "success",
        actorUid: auth.uid,
        requestId,
        summary: `Approval approved: ${approvalId}`,
        target: { approvalId }
      });

      return ok(res, { id: approvalId, status: "approved" }, requestId);
    } catch (err: any) {
      logError({ endpoint: "POST /v1/ops/approvals/:approvalId/approve", code: "INTERNAL", messageKo: "승인 처리 실패", err });
      return fail(res, 500, "INTERNAL", err.message, { requestId });
    }
  });

  app.post("/v1/ops/approvals/:approvalId/reject", async (req: express.Request, res: express.Response) => {
    const requestId = req.requestId || "req-unknown";
    const approvalId = String(req.params.approvalId);
    const { reason } = req.body || {};

    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = req.query.gateKey ? String(req.query.gateKey) : undefined;
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_operator", gateKey);
      if (!hasRole) return;

      const db = adminApp.firestore();
      const approvalRef = db.collection("ops_approvals").doc(approvalId);
      const approvalDoc = await approvalRef.get();
      if (!approvalDoc.exists) return fail(res, 404, "NOT_FOUND", "해당 승인 요청을 찾을 수 없습니다.", { requestId });

      const approvalData = approvalDoc.data() as any;
      if (approvalData.status !== "pending") return fail(res, 400, "FAILED_PRECONDITION", "이미 처리된 승인 요청입니다.", { requestId });

      await approvalRef.update({
        status: "rejected",
        reason: reason ? String(reason) : null,
        reviewedBy: auth.uid,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await logOpsEvent(adminApp, {
        gateKey: approvalData.gateKey || gateKey || "unknown",
        action: "ops_approvals.reject",
        status: "success",
        actorUid: auth.uid,
        requestId,
        summary: `Approval rejected: ${approvalId}`,
        target: { approvalId, reason: reason ? String(reason) : null }
      });

      return ok(res, { id: approvalId, status: "rejected" }, requestId);
    } catch (err: any) {
      logError({ endpoint: "POST /v1/ops/approvals/:approvalId/reject", code: "INTERNAL", messageKo: "거부 처리 실패", err });
      return fail(res, 500, "INTERNAL", err.message, { requestId });
    }
  });
}
