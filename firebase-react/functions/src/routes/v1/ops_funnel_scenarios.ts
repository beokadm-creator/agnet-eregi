import { Express } from "express";
import * as admin from "firebase-admin";
import { requireAuth, isOps } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { requireOpsRole } from "../../lib/ops_rbac";
import { defaultFunnelScenario, getOpsFunnelScenariosCollection, normalizeScenario, registryScenarioTemplates } from "../../lib/funnel_scenarios";
import { listGeneratedFunnelScenarios } from "../../lib/registry_funnel_scenarios";

export function registerOpsFunnelScenarioRoutes(app: Express, adminApp: typeof admin) {
  const col = getOpsFunnelScenariosCollection();

  app.get("/v1/ops/funnel-scenarios", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer");
      if (!hasRole) return;

      const snap = await col.orderBy("scenarioKey", "asc").limit(200).get();
      const items = snap.docs.map((d) => d.data());
      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "GET /v1/ops/funnel-scenarios", code: "INTERNAL", messageKo: "시나리오 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", "시나리오 목록 조회 실패");
    }
  });

  app.get("/v1/ops/funnel-scenarios/:scenarioKey", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer");
      if (!hasRole) return;

      const scenarioKey = String(req.params.scenarioKey || "").trim();
      if (!scenarioKey) return fail(res, 400, "INVALID_ARGUMENT", "scenarioKey가 필요합니다.");

      const doc = await col.doc(scenarioKey).get();
      if (!doc.exists) return fail(res, 404, "NOT_FOUND", "시나리오를 찾을 수 없습니다.");
      return ok(res, { scenario: doc.data() });
    } catch (err: any) {
      logError({ endpoint: "GET /v1/ops/funnel-scenarios/:scenarioKey", code: "INTERNAL", messageKo: "시나리오 조회 실패", err });
      return fail(res, 500, "INTERNAL", "시나리오 조회 실패");
    }
  });

  app.post("/v1/ops/funnel-scenarios/:scenarioKey/bootstrap", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const scenarioKey = String(req.params.scenarioKey || "").trim();
      if (!scenarioKey) return fail(res, 400, "INVALID_ARGUMENT", "scenarioKey가 필요합니다.");

      const base = defaultFunnelScenario();
      const draft = normalizeScenario({ ...base, scenarioKey, title: base.title, version: 1, enabled: true });
      const docRef = col.doc(scenarioKey);
      await docRef.set({
        scenarioKey,
        enabled: true,
        draft,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.uid
      }, { merge: true });
      const doc = await docRef.get();
      return ok(res, { scenario: doc.data() });
    } catch (err: any) {
      logError({ endpoint: "POST /v1/ops/funnel-scenarios/:scenarioKey/bootstrap", code: "INTERNAL", messageKo: "시나리오 초기화 실패", err });
      return fail(res, 500, "INTERNAL", "시나리오 초기화 실패");
    }
  });

  app.post("/v1/ops/funnel-scenarios/bootstrap-defaults", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const force = req.body?.force === true;
      const templates = registryScenarioTemplates();
      const results: Array<{ scenarioKey: string; created: boolean }> = [];

      for (const t of templates) {
        const docRef = col.doc(t.scenarioKey);
        const snap = await docRef.get();
        if (snap.exists && !force) {
          results.push({ scenarioKey: t.scenarioKey, created: false });
          continue;
        }
        const normalized = normalizeScenario(t);
        await docRef.set({
          scenarioKey: normalized.scenarioKey,
          enabled: normalized.enabled,
          draft: normalized,
          published: normalized,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: auth.uid
        }, { merge: true });
        results.push({ scenarioKey: t.scenarioKey, created: true });
      }

      return ok(res, { results });
    } catch (err: any) {
      logError({ endpoint: "POST /v1/ops/funnel-scenarios/bootstrap-defaults", code: "INTERNAL", messageKo: "기본 시나리오 생성 실패", err });
      return fail(res, 500, "INTERNAL", "기본 시나리오 생성 실패");
    }
  });

  app.post("/v1/ops/funnel-scenarios/sync-generated", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const confirm = String(req.body?.confirm || "").trim();
      if (confirm !== "APPLY") return fail(res, 400, "FAILED_PRECONDITION", "적용 실행은 confirm='APPLY'가 필요합니다.");
      const force = req.body?.force === true;
      const publish = req.body?.publish === true;
      const maxChanged = Number.isFinite(Number(req.body?.maxChanged)) ? Number(req.body.maxChanged) : 50;

      const scenarios = listGeneratedFunnelScenarios();
      const results: Array<{ scenarioKey: string; updated: boolean; skipped?: boolean }> = [];
      let changedCount = 0;

      for (const s of scenarios) {
        const docRef = col.doc(s.scenarioKey);
        const snap = await docRef.get();
        if (snap.exists && !force) {
          results.push({ scenarioKey: s.scenarioKey, updated: false, skipped: true });
          continue;
        }

        changedCount += 1;
        if (changedCount > maxChanged) {
          return fail(res, 400, "FAILED_PRECONDITION", `변경 건수(${changedCount})가 maxChanged(${maxChanged})를 초과합니다.`);
        }

        const normalized = normalizeScenario(s);
        await docRef.set({
          scenarioKey: normalized.scenarioKey,
          enabled: normalized.enabled,
          draft: normalized,
          ...(publish ? { published: normalized } : {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: auth.uid
        }, { merge: true });
        results.push({ scenarioKey: s.scenarioKey, updated: true });
      }

      return ok(res, { changedCount, results });
    } catch (err: any) {
      logError({ endpoint: "POST /v1/ops/funnel-scenarios/sync-generated", code: "INTERNAL", messageKo: "시나리오 동기화 실패", err });
      return fail(res, 500, "INTERNAL", "시나리오 동기화 실패");
    }
  });

  app.put("/v1/ops/funnel-scenarios/:scenarioKey/draft", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const scenarioKey = String(req.params.scenarioKey || "").trim();
      if (!scenarioKey) return fail(res, 400, "INVALID_ARGUMENT", "scenarioKey가 필요합니다.");

      const draft = normalizeScenario({ ...(req.body || {}), scenarioKey });
      const docRef = col.doc(scenarioKey);
      await docRef.set({
        scenarioKey,
        enabled: draft.enabled,
        draft,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.uid
      }, { merge: true });
      const doc = await docRef.get();
      return ok(res, { scenario: doc.data() });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : "시나리오 저장 실패";
      logError({ endpoint: "PUT /v1/ops/funnel-scenarios/:scenarioKey/draft", code: "INTERNAL", messageKo: "시나리오 저장 실패", err });
      return fail(res, 400, "INVALID_ARGUMENT", message);
    }
  });

  app.post("/v1/ops/funnel-scenarios/:scenarioKey/publish", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const scenarioKey = String(req.params.scenarioKey || "").trim();
      if (!scenarioKey) return fail(res, 400, "INVALID_ARGUMENT", "scenarioKey가 필요합니다.");

      const docRef = col.doc(scenarioKey);
      const snap = await docRef.get();
      const data = snap.exists ? (snap.data() as any) : null;
      const draft = data?.draft;
      if (!draft) return fail(res, 400, "FAILED_PRECONDITION", "draft가 없습니다. 먼저 draft를 저장하세요.");

      const published = normalizeScenario({ ...draft, scenarioKey, version: Number(draft.version || 1) });
      await docRef.set({
        scenarioKey,
        enabled: published.enabled,
        published,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.uid
      }, { merge: true });
      const updated = await docRef.get();
      return ok(res, { scenario: updated.data() });
    } catch (err: any) {
      logError({ endpoint: "POST /v1/ops/funnel-scenarios/:scenarioKey/publish", code: "INTERNAL", messageKo: "시나리오 publish 실패", err });
      return fail(res, 500, "INTERNAL", "시나리오 publish 실패");
    }
  });

  app.put("/v1/ops/funnel-scenarios/:scenarioKey/enabled", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const scenarioKey = String(req.params.scenarioKey || "").trim();
      if (!scenarioKey) return fail(res, 400, "INVALID_ARGUMENT", "scenarioKey가 필요합니다.");
      const enabled = req.body?.enabled === true;

      const docRef = col.doc(scenarioKey);
      await docRef.set({
        scenarioKey,
        enabled,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.uid
      }, { merge: true });
      const doc = await docRef.get();
      return ok(res, { scenario: doc.data() });
    } catch (err: any) {
      logError({ endpoint: "PUT /v1/ops/funnel-scenarios/:scenarioKey/enabled", code: "INTERNAL", messageKo: "시나리오 활성화 변경 실패", err });
      return fail(res, 500, "INTERNAL", "시나리오 활성화 변경 실패");
    }
  });
}
