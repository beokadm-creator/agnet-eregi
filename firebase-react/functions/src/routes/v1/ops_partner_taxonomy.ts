import * as express from "express";
import * as admin from "firebase-admin";
import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";
import { getOpsSettingsCollection } from "../../lib/ops_settings";
import { defaultPartnerTaxonomy, normalizePartnerTaxonomy } from "../../lib/partner_taxonomy";

export function registerOpsPartnerTaxonomyRoutes(app: express.Application, adminApp: typeof admin) {
  app.get("/v1/ops/settings/partner-taxonomy", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const snap = await getOpsSettingsCollection().doc("partner_taxonomy").get();
      const settings = snap.exists ? snap.data() : defaultPartnerTaxonomy();
      return ok(res, { settings });
    } catch (err: any) {
      logError({ endpoint: "ops/settings/partner-taxonomy/get", code: "INTERNAL", messageKo: "파트너 분류 설정 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  app.put("/v1/ops/settings/partner-taxonomy", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const normalized = normalizePartnerTaxonomy(req.body || {});
      const update = {
        ...normalized,
        updatedAt: adminApp.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updatedBy: auth.uid
      };

      await getOpsSettingsCollection().doc("partner_taxonomy").set(update, { merge: true });

      await logOpsEvent(adminApp, {
        gateKey: "system",
        action: "ops_settings.update",
        status: "success",
        actorUid: auth.uid,
        requestId: req.requestId!,
        summary: "파트너 분류(지역/전문분야/태그) 설정 변경",
        target: { type: "partner_taxonomy" }
      });

      return ok(res, { settings: update });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "설정 변경 실패";
      logError({ endpoint: "ops/settings/partner-taxonomy/put", code: "INTERNAL", messageKo: "파트너 분류 설정 변경 실패", err });
      return fail(res, 400, "INVALID_ARGUMENT", msg);
    }
  });
}

