import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";
import { defaultSloConfig, OpsSloConfig } from "../../lib/ops_slo";

export function registerOpsSloRoutes(app: express.Application, adminApp: typeof admin) {

  // 1) GET /v1/ops/slo/:gateKey
  app.get("/v1/ops/slo/:gateKey", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = String(req.params.gateKey);
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", gateKey);
      if (!hasRole) return;

      const docSnap = await adminApp.firestore().collection("ops_slo_configs").doc(gateKey).get();
      let config = defaultSloConfig;
      
      if (docSnap.exists) {
        config = docSnap.data() as OpsSloConfig;
      }

      // config 자체에 gateKey가 들어있을 수 있어 중복 키를 피한다.
      return ok(res, { config: { ...config, gateKey } });
    } catch (err: any) {
      logError({ endpoint: "ops/slo/get", code: "INTERNAL", messageKo: "SLO 설정 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 2) POST /v1/ops/slo/:gateKey
  app.post("/v1/ops/slo/:gateKey", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = String(req.params.gateKey);
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin", gateKey);
      if (!hasRole) return;

      const { targetPercentage, budgetDays } = req.body;
      
      if (typeof targetPercentage !== 'number' || targetPercentage <= 0 || targetPercentage > 100) {
        return fail(res, 400, "INVALID_ARGUMENT", "올바른 targetPercentage를 입력하세요 (0~100)");
      }
      
      if (typeof budgetDays !== 'number' || budgetDays <= 0) {
        return fail(res, 400, "INVALID_ARGUMENT", "올바른 budgetDays를 입력하세요 (예: 7, 30)");
      }

      const newConfig: OpsSloConfig = {
        gateKey,
        targetPercentage,
        budgetDays,
        updatedAt: adminApp.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updatedBy: auth.uid
      };

      await adminApp.firestore().collection("ops_slo_configs").doc(gateKey).set(newConfig, { merge: true });

      await logOpsEvent(adminApp, {
        gateKey,
        action: "ops_slo.update",
        status: "success",
        actorUid: auth.uid,
        requestId: (req as any).requestId,
        summary: `SLO 설정 변경: 목표 ${targetPercentage}%, 기간 ${budgetDays}일`,
        target: { targetPercentage, budgetDays }
      });

      return ok(res, { config: newConfig });
    } catch (err: any) {
      logError({ endpoint: "ops/slo/update", code: "INTERNAL", messageKo: "SLO 설정 변경 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 3) GET /v1/ops/slo/dashboard/status (대시보드 표시용)
  app.get("/v1/ops/slo/dashboard/status", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = req.query.gateKey ? String(req.query.gateKey) : undefined;
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", gateKey);
      if (!hasRole) return;

      // 오늘 날짜 기준으로 최근 생성된 ops_slo_status를 가져온다
      let query: admin.firestore.Query = adminApp.firestore().collection("ops_slo_status");
      
      if (gateKey) {
        query = query.where("gateKey", "==", gateKey);
      }
      
      // 최신 상태 50개만
      query = query.orderBy("calculatedAt", "desc").limit(50);
      
      const snap = await query.get();
      
      // gateKey별로 가장 최신 1개씩만 필터링
      const latestStatus: Record<string, any> = {};
      for (const doc of snap.docs) {
        const data = doc.data();
        if (!latestStatus[data.gateKey]) {
          latestStatus[data.gateKey] = { id: doc.id, ...data };
        }
      }

      return ok(res, { statuses: Object.values(latestStatus) });
    } catch (err: any) {
      logError({ endpoint: "ops/slo/dashboard/status", code: "INTERNAL", messageKo: "SLO Status 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

}
