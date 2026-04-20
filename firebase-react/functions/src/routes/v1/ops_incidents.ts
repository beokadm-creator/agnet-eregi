import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { fail } from "../../lib/http";
import { requireOpsRole } from "../../lib/ops_rbac";
import { logError } from "../../lib/http";
import { processOpsIncidents } from "../../lib/ops_incident_worker";

export function registerOpsIncidentRoutes(app: express.Application, adminApp: typeof admin) {
  
  // 1) GET /v1/ops/incidents
  app.get("/v1/ops/incidents", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = req.query.gateKey ? String(req.query.gateKey) : undefined;
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", gateKey);
      if (!hasRole) return;

      const status = req.query.status ? String(req.query.status) : undefined;
      const limit = Number(req.query.limit) || 50;

      let query: admin.firestore.Query = adminApp.firestore().collection("ops_incidents");

      if (gateKey) {
        query = query.where("gateKey", "==", gateKey);
      }
      if (status) {
        query = query.where("status", "==", status);
      }

      query = query.orderBy("startAt", "desc").limit(limit);

      const snap = await query.get();
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      return res.status(200).json({ ok: true, data: { items } });
    } catch (err: any) {
      logError({ endpoint: "incidents/list", code: "INTERNAL", messageKo: "Incident 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", "Incident 목록 조회 실패");
    }
  });

  // 2) GET /v1/ops/incidents/:id
  app.get("/v1/ops/incidents/:id", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const incidentId = String(req.params.id);
      const docRef = adminApp.firestore().collection("ops_incidents").doc(incidentId);
      const snap = await docRef.get();
      
      if (!snap.exists) {
        return fail(res, 404, "NOT_FOUND", "Incident를 찾을 수 없습니다.");
      }

      const data = snap.data();
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", data?.gateKey);
      if (!hasRole) return;

      return res.status(200).json({ ok: true, data: { incident: { id: snap.id, ...data } } });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 3) POST /v1/ops/incidents/rebuild
  app.post("/v1/ops/incidents/rebuild", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      // 간단한 rebuild 로직: 기존 incidents 지우고 지난 7일치 이벤트 다시 스캔
      // 실제로는 timeout 위험이 있으므로 제한적으로 구현 (예: 최근 1일치만 하거나)
      // 여기서는 7일치 이벤트 조회하여 rebuild
      
      const db = adminApp.firestore();
      
      // 1. 기존 incidents 삭제 (간단히 최대 500개만 삭제)
      const incidentsSnap = await db.collection("ops_incidents").limit(500).get();
      const batch = db.batch();
      for (const doc of incidentsSnap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();

      // 2. 지난 7일치 이벤트 가져오기
      const sevenDaysAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // state 갱신 (worker가 다시 7일 전부터 시작하도록 유도)
      await db.collection("ops_system").doc("incident_worker_state").set({
        lastProcessedTime: sevenDaysAgo
      });

      // 즉시 worker 로직 실행
      await processOpsIncidents(adminApp);

      return res.status(200).json({ ok: true, message: "Rebuild completed." });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });
}
