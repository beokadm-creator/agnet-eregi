import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { executeDataRetention, getRetentionPolicies } from "../../lib/ops_retention";

export function registerOpsRetentionRoutes(app: express.Application, adminApp: typeof admin) {

  // 1) GET /v1/ops/retention/preview
  app.get("/v1/ops/retention/preview", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const targetCollection = req.query.collection ? String(req.query.collection) : undefined;
      const limit = Number(req.query.limit) || 50;

      const policies = getRetentionPolicies();
      let matchedPolicies = policies;
      if (targetCollection) {
        matchedPolicies = policies.filter(p => p.collection === targetCollection);
      }

      if (matchedPolicies.length === 0) {
        return fail(res, 400, "INVALID_ARGUMENT", "해당 컬렉션에 대한 보관 정책이 없습니다.");
      }

      const db = adminApp.firestore();
      const previewResults: Record<string, any[]> = {};

      for (const policy of matchedPolicies) {
        const policyKey = `${policy.collection}_${policy.daysToKeep}days`;
        previewResults[policyKey] = [];

        try {
          let query: FirebaseFirestore.Query = db.collection(policy.collection);
          
          for (const filter of policy.filters) {
            query = query.where(filter.field, filter.op, filter.value);
          }

          const cutoffDate = admin.firestore.Timestamp.fromMillis(Date.now() - policy.daysToKeep * 24 * 60 * 60 * 1000);
          query = query.where(policy.dateField, "<", cutoffDate).limit(limit);

          const snap = await query.get();
          
          for (const doc of snap.docs) {
            previewResults[policyKey].push({ id: doc.id, ...doc.data() });
          }
        } catch (e: any) {
          console.error(`Retention preview error on ${policy.collection}:`, e);
          previewResults[policyKey].push({ error: e.message });
        }
      }

      return ok(res, { previewResults });
    } catch (err: any) {
      logError({ endpoint: "ops/retention/preview", code: "INTERNAL", messageKo: "Retention Preview 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 2) POST /v1/ops/retention/run
  app.post("/v1/ops/retention/run", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const dryRun = req.body.dryRun !== false; // 기본값 true

      const results = await executeDataRetention(adminApp, auth.uid, dryRun);

      return ok(res, { results });
    } catch (err: any) {
      logError({ endpoint: "ops/retention/run", code: "INTERNAL", messageKo: "Retention Run 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });
}
