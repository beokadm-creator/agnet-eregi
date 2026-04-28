import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { safeQuery } from "../../lib/ops_query_health";

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
}

