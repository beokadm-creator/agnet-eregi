import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { safeQuery } from "../../lib/ops_query_health";

export function registerOpsAuditLogRoutes(app: express.Application, adminApp: typeof admin) {
  app.get("/v1/ops/audit-logs", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = req.query.gateKey ? String(req.query.gateKey) : undefined;
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", gateKey);
      if (!hasRole) return;

      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const action = req.query.action ? String(req.query.action) : undefined;
      const actorUid = req.query.actorUid ? String(req.query.actorUid) : undefined;
      const from = req.query.from ? String(req.query.from) : undefined;
      const to = req.query.to ? String(req.query.to) : undefined;

      const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : null;
      const toDate = to ? new Date(`${to}T23:59:59.999Z`) : null;

      let query: admin.firestore.Query = adminApp.firestore().collection("ops_audit_events");
      if (gateKey) query = query.where("gateKey", "==", gateKey);
      if (action && action !== "all") query = query.where("action", "==", action);
      if (actorUid) query = query.where("actorUid", "==", actorUid);
      if (fromDate && !Number.isNaN(fromDate.getTime())) query = query.where("createdAt", ">=", admin.firestore.Timestamp.fromDate(fromDate));
      if (toDate && !Number.isNaN(toDate.getTime())) query = query.where("createdAt", "<=", admin.firestore.Timestamp.fromDate(toDate));
      query = query.orderBy("createdAt", "desc").limit(limit);

      const snap = await safeQuery(adminApp, gateKey || "unknown", "ops_audit_events_query", async () => await query.get(), null);
      if (!snap) return fail(res, 500, "FAILED_PRECONDITION", "Query Health에 의해 차단되었습니다.");

      const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "ops/audit-logs", code: "INTERNAL", messageKo: "감사 로그 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });
}
