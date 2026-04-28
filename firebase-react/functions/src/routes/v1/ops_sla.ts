import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { safeQuery } from "../../lib/ops_query_health";

export function registerOpsSlaRoutes(app: express.Application, adminApp: typeof admin) {
  app.get("/v1/ops/sla/breaches", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = req.query.gateKey ? String(req.query.gateKey) : undefined;
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", gateKey);
      if (!hasRole) return;

      const limit = Math.min(Number(req.query.limit) || 50, 200);

      let query: admin.firestore.Query = adminApp.firestore().collection("ops_slo_status");
      if (gateKey) query = query.where("gateKey", "==", gateKey);
      query = query.orderBy("calculatedAt", "desc").limit(limit);

      const snap = await safeQuery(adminApp, gateKey || "unknown", "ops_slo_status_query", async () => await query.get(), null);
      if (!snap) return fail(res, 500, "FAILED_PRECONDITION", "Query Health에 의해 차단되었습니다.");

      const all = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[];
      const breaches = all.filter((s) => {
        const sli = typeof s.sliPercentage === "number" ? s.sliPercentage : undefined;
        const target = typeof s.targetPercentage === "number" ? s.targetPercentage : undefined;
        const burn = typeof s.burnRate === "number" ? s.burnRate : undefined;
        if (typeof burn === "number" && burn >= 100) return true;
        if (typeof sli === "number" && typeof target === "number" && sli < target) return true;
        return false;
      });

      return ok(res, { items: breaches });
    } catch (err: any) {
      logError({ endpoint: "ops/sla/breaches", code: "INTERNAL", messageKo: "SLA Breach 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });
}

