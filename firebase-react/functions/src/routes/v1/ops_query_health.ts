import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerOpsQueryHealthRoutes(app: express.Application, adminApp: typeof admin) {

  // 1) GET /v1/ops/query-health
  app.get("/v1/ops/query-health", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = req.query.gateKey ? String(req.query.gateKey) : undefined;
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", gateKey);
      if (!hasRole) return;

      const limit = Number(req.query.limit) || 50;

      let query: admin.firestore.Query = adminApp.firestore().collection("ops_query_health");

      if (gateKey) {
        query = query.where("gateKey", "==", gateKey);
      }
      
      query = query.orderBy("createdAt", "desc").limit(limit);

      const snap = await query.get();
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "ops/query-health/list", code: "INTERNAL", messageKo: "Query Health 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 2) POST /v1/ops/query-health/:id/resolve
  app.post("/v1/ops/query-health/:id/resolve", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const id = String(req.params.id);
      const docRef = adminApp.firestore().collection("ops_query_health").doc(id);
      
      await docRef.update({
        status: "resolved",
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedBy: auth.uid
      });

      await logOpsEvent(adminApp, {
        gateKey: "system",
        action: "ops_query_health.resolve",
        status: "success",
        actorUid: auth.uid,
        requestId: (req as any).requestId,
        summary: `Query Health 이슈 ${id} 해결 처리됨`,
        target: { id }
      });

      return ok(res, { message: "해결 처리 성공" });
    } catch (err: any) {
      logError({ endpoint: "ops/query-health/resolve", code: "INTERNAL", messageKo: "Query Health 해결 처리 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

}
