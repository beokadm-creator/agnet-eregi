import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { safeQuery } from "../../lib/ops_query_health";
import { logOpsEvent } from "../../lib/ops_audit";
import { resetCircuitBreaker } from "../../lib/ops_circuit_breaker";

export function registerOpsRiskRoutes(app: express.Application, adminApp: typeof admin) {
  const db = adminApp.firestore();
  
  // 1) GET /v1/ops/risk/summary
  // 최근 24시간 동안의 Incident 데이터 등을 기반으로 현재 리스크 지표를 산출합니다.
  app.get("/v1/ops/risk/summary", requireAuth, async (req: express.Request, res: express.Response) => {
    const requestId = req.requestId || "req-unknown";
    try {
      const auth = req.user! as any;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.", { requestId });

      const gateKey = req.query.gateKey ? String(req.query.gateKey) : undefined;
      // 리스크 조회는 최소 ops_viewer 권한 요구
      const hasRole = await requireOpsRole(adminApp, req, res, auth as any, "ops_viewer", gateKey);
      if (!hasRole) return;

      // 최근 24시간의 Incident 수집
      const now = Date.now();
      const oneDayAgo = admin.firestore.Timestamp.fromMillis(now - 24 * 60 * 60 * 1000);

      let incidentsQuery: admin.firestore.Query = db.collection("ops_incidents")
        .where("startAt", ">=", oneDayAgo);

      if (gateKey) {
        incidentsQuery = incidentsQuery.where("gateKey", "==", gateKey);
      }

      // Query Health 보호막을 통해 DB 과부하 차단
      const snap = await safeQuery(
        adminApp, 
        gateKey || "global", 
        "ops_risk_incidents_query", 
        async () => await incidentsQuery.get(), 
        null
      );
      if (!snap) return fail(res, 500, "FAILED_PRECONDITION", "Query Health 제약으로 인해 조회가 차단되었습니다.", { requestId });

      const incidents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 리스크 레벨 평가 (단순화된 룰 적용: critical 존재 시 High, warn 존재 시 Medium, 그 외 Low)
      let riskLevel = "Low";
      const criticalCount = incidents.filter((i: any) => i.severity === "critical").length;
      const warnCount = incidents.filter((i: any) => i.severity === "warn").length;

      if (criticalCount > 0) {
        riskLevel = "High";
      } else if (warnCount > 0) {
        riskLevel = "Medium";
      }

      const summary = {
        gateKey: gateKey || "all",
        riskLevel,
        metrics: {
          criticalIncidents24h: criticalCount,
          warnIncidents24h: warnCount,
          totalIncidents24h: incidents.length
        },
        evaluatedAt: new Date().toISOString()
      };

      // 조회 액션 감사 로그 기록
      await logOpsEvent(db, "ops_risk.evaluated", "SUCCESS", auth.uid, requestId, gateKey || "global", {
        summary
      });

      return ok(res, { summary }, requestId);
    } catch (err: any) {
      logError({ endpoint: "ops/risk/summary", code: "INTERNAL", messageKo: "리스크 요약 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message, { requestId });
    }
  });

  // 2) POST /v1/ops/risk/:gateKey/mitigate
  // 식별된 리스크에 대한 긴급 완화 조치(Playbook 액션 등)를 수동 트리거합니다.
  app.post("/v1/ops/risk/:gateKey/mitigate", requireAuth, async (req: express.Request, res: express.Response) => {
    const requestId = req.requestId || "req-unknown";
    try {
      const auth = req.user! as any;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.", { requestId });

      const gateKey = String(req.params.gateKey);
      // 완화 조치 실행은 최소 ops_operator 권한 요구
      const hasRole = await requireOpsRole(adminApp, req, res, auth as any, "ops_operator", gateKey);
      if (!hasRole) return;

      const { actionKey } = req.body;
      if (!actionKey) return fail(res, 400, "INVALID_ARGUMENT", "actionKey is required", { requestId });

      // 리스크 완화 조치 비즈니스 로직 연동
      if (actionKey === "circuit_breaker_reset") {
        await resetCircuitBreaker(adminApp, gateKey, "Manual Reset via Ops Risk Mitigate");
      }

      await logOpsEvent(db, "ops_risk.mitigate", "SUCCESS", auth.uid, requestId, gateKey, {
        actionKey
      });

      return ok(res, { message: "리스크 완화 조치가 실행되었습니다.", actionKey }, requestId);
    } catch (err: any) {
      logError({ endpoint: "ops/risk/mitigate", code: "INTERNAL", messageKo: "리스크 완화 조치 실행 실패", err });
      return fail(res, 500, "INTERNAL", err.message, { requestId });
    }
  });
}
