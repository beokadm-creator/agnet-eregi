import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { processOpsMetricsDaily } from "../../lib/ops_metrics_worker";
import { processAlertQualityDaily } from "../../lib/ops_alert_quality_worker";

export function registerOpsObservabilityRoutes(app: express.Application, adminApp: typeof admin) {

  // 1) GET /v1/ops/metrics/daily
  app.get("/v1/ops/metrics/daily", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = req.query.gateKey ? String(req.query.gateKey) : undefined;
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", gateKey);
      if (!hasRole) return;

      const limit = Number(req.query.limit) || 30;

      let query: admin.firestore.Query = adminApp.firestore().collection("ops_metrics_daily");

      if (gateKey) {
        query = query.where("gateKey", "==", gateKey);
      }

      query = query.orderBy("date", "desc").limit(limit);

      const snap = await query.get();
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "ops/metrics/daily", code: "INTERNAL", messageKo: "Metrics 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 2) GET /v1/ops/alerts/quality
  app.get("/v1/ops/alerts/quality", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = req.query.gateKey ? String(req.query.gateKey) : undefined;
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", gateKey);
      if (!hasRole) return;

      const limit = Number(req.query.limit) || 30;

      let query: admin.firestore.Query = adminApp.firestore().collection("ops_alert_quality_daily");

      if (gateKey) {
        query = query.where("gateKey", "==", gateKey);
      }

      query = query.orderBy("date", "desc").limit(limit);

      const snap = await query.get();
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "ops/alerts/quality", code: "INTERNAL", messageKo: "Alert Quality 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 3) POST /v1/ops/metrics/rebuild (강제 재생성, 관리자용)
  app.post("/v1/ops/metrics/rebuild", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      await processOpsMetricsDaily(adminApp);
      await processAlertQualityDaily(adminApp);

      return ok(res, { message: "Metrics & Quality Rebuild triggered successfully." });
    } catch (err: any) {
      logError({ endpoint: "ops/metrics/rebuild", code: "INTERNAL", messageKo: "Metrics Rebuild 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

}