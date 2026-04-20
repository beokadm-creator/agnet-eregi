import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { processFirestoreBackup } from "../../lib/ops_backup_worker";

export function registerOpsBackupRoutes(app: express.Application, adminApp: typeof admin) {

  // 1) GET /v1/ops/backup/status
  app.get("/v1/ops/backup/status", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer");
      if (!hasRole) return;

      const snap = await adminApp.firestore().collection("ops_backup_runs")
        .orderBy("startedAt", "desc")
        .limit(10)
        .get();

      const runs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      return ok(res, { runs });
    } catch (err: any) {
      logError({ endpoint: "ops/backup/status", code: "INTERNAL", messageKo: "Backup 상태 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 2) POST /v1/ops/backup/trigger
  app.post("/v1/ops/backup/trigger", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      await processFirestoreBackup(adminApp);

      return ok(res, { message: "백업 트리거 성공" });
    } catch (err: any) {
      logError({ endpoint: "ops/backup/trigger", code: "INTERNAL", messageKo: "백업 트리거 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

}