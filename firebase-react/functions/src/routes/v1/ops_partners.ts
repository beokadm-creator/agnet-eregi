import * as express from "express";
import * as admin from "firebase-admin";
import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";
import { loadPartnerTaxonomy, normalizeByAllowWithAliases, sanitizeListWithAliases } from "../../lib/partner_taxonomy";
import { getKnownScenarioKeys, getPartnerProfileTemplates, normalizeScenarioKeys } from "../../lib/scenario_partner_match";

export function registerOpsPartnersRoutes(app: express.Application, adminApp: typeof admin) {
  const db = adminApp.firestore();

  app.get("/v1/ops/partners/templates", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer");
      if (!hasRole) return;

      const taxonomy = await loadPartnerTaxonomy(db);
      return ok(res, {
        templates: getPartnerProfileTemplates(),
        scenarioKeys: getKnownScenarioKeys(),
        taxonomy,
      });
    } catch (err: any) {
      logError({ endpoint: "ops/partners/templates/get", code: "INTERNAL", messageKo: "파트너 템플릿 조회 실패", err });
      return fail(res, 500, "INTERNAL", "파트너 템플릿 조회 실패");
    }
  });

  app.get("/v1/ops/partners", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer");
      if (!hasRole) return;

      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "100"), 10) || 100));
      const status = String(req.query.status || "").trim();
      const taxonomy = await loadPartnerTaxonomy(db);

      let q: admin.firestore.Query = db.collection("partners");
      if (status) q = q.where("status", "==", status);
      const snap = await q.limit(limit).get();
      const items = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          partnerId: d.id,
          name: data.name || "",
          status: data.status || "",
          regions: normalizeByAllowWithAliases(data.regions, taxonomy.regions, taxonomy.aliases?.regions),
          specialties: normalizeByAllowWithAliases(data.specialties, taxonomy.specialties, taxonomy.aliases?.specialties),
          scenarioKeysHandled: normalizeScenarioKeys(data.scenarioKeysHandled),
          tags: sanitizeListWithAliases(data.tags, taxonomy.tags || [], taxonomy.aliases?.tags),
          qualityTier: data.qualityTier || "Bronze",
          isSponsored: data.isSponsored === true,
          isAvailable: data.isAvailable !== false,
          rating: data.rating || 0,
          reviewCount: data.reviewCount || 0,
          price: data.price || 0,
          etaHours: data.etaHours || 24,
          slaComplianceRate: data.slaComplianceRate || 0,
          maxCapacity: data.maxCapacity || 50,
          activeCaseCount: data.activeCaseCount || 0,
        };
      });
      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "ops/partners/get", code: "INTERNAL", messageKo: "파트너 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", "파트너 목록 조회 실패");
    }
  });

  app.get("/v1/ops/partners/:partnerId", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer");
      if (!hasRole) return;

      const partnerId = String(req.params.partnerId || "").trim();
      if (!partnerId) return fail(res, 400, "INVALID_ARGUMENT", "partnerId가 필요합니다.");
      const taxonomy = await loadPartnerTaxonomy(db);

      const snap = await db.collection("partners").doc(partnerId).get();
      if (!snap.exists) return fail(res, 404, "NOT_FOUND", "파트너를 찾을 수 없습니다.");
      const data = snap.data() as any;
      return ok(res, {
        partner: {
          partnerId,
          name: data.name || "",
          status: data.status || "",
          regions: normalizeByAllowWithAliases(data.regions, taxonomy.regions, taxonomy.aliases?.regions),
          specialties: normalizeByAllowWithAliases(data.specialties, taxonomy.specialties, taxonomy.aliases?.specialties),
          scenarioKeysHandled: normalizeScenarioKeys(data.scenarioKeysHandled),
          tags: sanitizeListWithAliases(data.tags, taxonomy.tags || [], taxonomy.aliases?.tags),
          qualityTier: data.qualityTier || "Bronze",
          isSponsored: data.isSponsored === true,
          isAvailable: data.isAvailable !== false,
          rating: data.rating || 0,
          reviewCount: data.reviewCount || 0,
          price: data.price || 0,
          etaHours: data.etaHours || 24,
          slaComplianceRate: data.slaComplianceRate || 0,
          maxCapacity: data.maxCapacity || 50,
          activeCaseCount: data.activeCaseCount || 0,
        }
      });
    } catch (err: any) {
      logError({ endpoint: "ops/partners/:partnerId/get", code: "INTERNAL", messageKo: "파트너 조회 실패", err });
      return fail(res, 500, "INTERNAL", "파트너 조회 실패");
    }
  });

  app.put("/v1/ops/partners/:partnerId", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const partnerId = String(req.params.partnerId || "").trim();
      if (!partnerId) return fail(res, 400, "INVALID_ARGUMENT", "partnerId가 필요합니다.");

      const taxonomy = await loadPartnerTaxonomy(db);
      const body = req.body || {};
      const update: any = {
        updatedAt: adminApp.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.uid,
      };
      if (body.regions !== undefined) update.regions = normalizeByAllowWithAliases(body.regions, taxonomy.regions, taxonomy.aliases?.regions);
      if (body.specialties !== undefined) update.specialties = normalizeByAllowWithAliases(body.specialties, taxonomy.specialties, taxonomy.aliases?.specialties);
      if (body.scenarioKeysHandled !== undefined) update.scenarioKeysHandled = normalizeScenarioKeys(body.scenarioKeysHandled);
      if (body.tags !== undefined) update.tags = sanitizeListWithAliases(body.tags, taxonomy.tags || [], taxonomy.aliases?.tags);
      if (body.isSponsored !== undefined) update.isSponsored = body.isSponsored === true;
      if (body.isAvailable !== undefined) update.isAvailable = body.isAvailable === true;
      if (body.qualityTier !== undefined) update.qualityTier = String(body.qualityTier || "Bronze");
      if (body.price !== undefined) update.price = Number(body.price) || 0;
      if (body.etaHours !== undefined) update.etaHours = Number(body.etaHours) || 24;
      if (body.maxCapacity !== undefined) update.maxCapacity = Number(body.maxCapacity) || 50;

      await db.collection("partners").doc(partnerId).set(update, { merge: true });

      await logOpsEvent(adminApp, {
        gateKey: "partners",
        action: "partners.update",
        status: "success",
        actorUid: auth.uid,
        requestId: req.requestId!,
        summary: `파트너 업데이트 (${partnerId})`,
        target: { type: "partner", partnerId }
      });

      const snap = await db.collection("partners").doc(partnerId).get();
      return ok(res, { partner: { partnerId, ...(snap.data() as any) } });
    } catch (err: any) {
      logError({ endpoint: "ops/partners/:partnerId/put", code: "INTERNAL", messageKo: "파트너 업데이트 실패", err });
      return fail(res, 500, "INTERNAL", "파트너 업데이트 실패");
    }
  });

  app.post("/v1/ops/partners/normalize-taxonomy", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const dryRun = req.body?.dryRun !== false;
      const limit = Math.min(500, Math.max(1, parseInt(String(req.body?.limit || "200"), 10) || 200));
      const confirm = String(req.body?.confirm || "").trim();
      const maxChanged = Number.isFinite(Number(req.body?.maxChanged)) ? Number(req.body.maxChanged) : 200;
      if (!dryRun && confirm !== "APPLY") {
        return fail(res, 400, "FAILED_PRECONDITION", "적용 실행은 confirm='APPLY'가 필요합니다.");
      }
      const taxonomy = await loadPartnerTaxonomy(db);

      const snap = await db.collection("partners").limit(limit).get();
      const results: any[] = [];

      for (const d of snap.docs) {
        const data = d.data() as any;
        const beforeRegions = Array.isArray(data.regions) ? data.regions : [];
        const beforeSpecialties = Array.isArray(data.specialties) ? data.specialties : [];
        const beforeScenarioKeysHandled = normalizeScenarioKeys(data.scenarioKeysHandled);
        const beforeTags = Array.isArray(data.tags) ? data.tags : [];

        const afterRegions = normalizeByAllowWithAliases(beforeRegions, taxonomy.regions, taxonomy.aliases?.regions);
        const afterSpecialties = normalizeByAllowWithAliases(beforeSpecialties, taxonomy.specialties, taxonomy.aliases?.specialties);
        const afterScenarioKeysHandled = normalizeScenarioKeys(beforeScenarioKeysHandled);
        const afterTags = sanitizeListWithAliases(beforeTags, taxonomy.tags || [], taxonomy.aliases?.tags);

        const changed =
          JSON.stringify(beforeRegions) !== JSON.stringify(afterRegions) ||
          JSON.stringify(beforeSpecialties) !== JSON.stringify(afterSpecialties) ||
          JSON.stringify(beforeScenarioKeysHandled) !== JSON.stringify(afterScenarioKeysHandled) ||
          JSON.stringify(beforeTags) !== JSON.stringify(afterTags);

        if (!changed) continue;

        results.push({
          partnerId: d.id,
          before: { regions: beforeRegions, specialties: beforeSpecialties, scenarioKeysHandled: beforeScenarioKeysHandled, tags: beforeTags },
          after: { regions: afterRegions, specialties: afterSpecialties, scenarioKeysHandled: afterScenarioKeysHandled, tags: afterTags }
        });
      }

      if (!dryRun && results.length > maxChanged) {
        return fail(res, 400, "FAILED_PRECONDITION", `변경 건수(${results.length})가 maxChanged(${maxChanged})를 초과합니다.`, {
          dryRun: true,
          changedCount: results.length,
        });
      }

      if (!dryRun) {
        for (const r of results) {
          await db.collection("partners").doc(r.partnerId).set(
            {
              regions: r.after.regions,
              specialties: r.after.specialties,
              scenarioKeysHandled: r.after.scenarioKeysHandled,
              tags: r.after.tags,
              updatedAt: adminApp.firestore.FieldValue.serverTimestamp(),
              updatedBy: auth.uid
            },
            { merge: true }
          );
        }
      }

      await logOpsEvent(adminApp, {
        gateKey: "partners",
        action: "partners.normalize_taxonomy",
        status: "success",
        actorUid: auth.uid,
        requestId: req.requestId!,
        summary: `파트너 분류 정규화 (${dryRun ? "dry-run" : "apply"})`,
        target: { type: "partners", dryRun, changedCount: results.length }
      });

      return ok(res, { dryRun, changedCount: results.length, results: results.slice(0, 50), maxChanged });
    } catch (err: any) {
      logError({ endpoint: "ops/partners/normalize-taxonomy/post", code: "INTERNAL", messageKo: "파트너 분류 정규화 실패", err });
      return fail(res, 500, "INTERNAL", "파트너 분류 정규화 실패");
    }
  });
}
