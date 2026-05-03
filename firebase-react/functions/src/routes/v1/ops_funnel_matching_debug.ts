import { Express } from "express";
import * as admin from "firebase-admin";
import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { defaultFunnelScenario, FunnelScenarioDefinition, registryScenarioTemplates } from "../../lib/funnel_scenarios";
import { loadPartnerTaxonomy, normalizeByAllowWithAliases, sanitizeListWithAliases } from "../../lib/partner_taxonomy";
import { loadMatchingWeights } from "../../lib/matching_weights";
import { getDesiredSpecialtiesForScenarioKey, getPreferredTagsForScenarioKey, normalizeScenarioKeys } from "../../lib/scenario_partner_match";

function num(v: any, fallback: number = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function tierScore(tier: any): number {
  const t = String(tier || "").toLowerCase();
  if (t === "platinum") return 4;
  if (t === "gold") return 3;
  if (t === "silver") return 2;
  return 1;
}

function isUrgentAnswer(answers: Record<string, any>): boolean {
  const vals = Object.values(answers || {}).map((v) => String(v || ""));
  return vals.some((v) => v.includes("긴급") || v.includes("1~2일"));
}

function needsHighQuality(scenarioKey: string, answers: Record<string, any>): boolean {
  if (scenarioKey === "dissolution") return true;
  if (scenarioKey === "corp_establishment") {
    const v = String(answers?.q_foreign_participant || "");
    if (v === "예" || v === "모르겠음") return true;
  }
  return false;
}

function computeMatch(
  partner: any,
  ctx: {
    scenarioKey: string;
    answers: Record<string, any>;
    desiredRegion: string;
    desiredSpecialties: string[];
    desiredScenarioKeys: string[];
    preferredTags: string[];
    urgent: boolean;
    highQuality: boolean;
  },
  w: Awaited<ReturnType<typeof loadMatchingWeights>>
): { score: number; reasons: string[] } {
  const base = num(partner.rankingScore, 0);
  const rating = num(partner.rating, 0);
  const sla = num(partner.slaComplianceRate, 0);
  const price = num(partner.price, 0);
  const eta = num(partner.etaHours, 24);
  const reviews = num(partner.reviewCount, 0);
  const tier = tierScore(partner.qualityTier);
  const available = partner.isAvailable !== false;

  const regions = Array.isArray(partner.regions) ? partner.regions : [];
  const specialties = Array.isArray(partner.specialties) ? partner.specialties : [];
  const scenarioKeysHandled = normalizeScenarioKeys(partner.scenarioKeysHandled);
  const tags = Array.isArray(partner.tags) ? partner.tags : [];
  const regionMatch = ctx.desiredRegion ? regions.includes(ctx.desiredRegion) : false;
  const specialtyMatch =
    (ctx.desiredSpecialties || []).length > 0
      ? (ctx.desiredSpecialties || []).some((s) => specialties.includes(s))
      : false;
  const scenarioKeyMatch =
    (ctx.desiredScenarioKeys || []).length > 0 && scenarioKeysHandled.length > 0
      ? (ctx.desiredScenarioKeys || []).some((s) => scenarioKeysHandled.includes(s))
      : false;
  const preferredTagsMatched = Array.from(
    new Set((ctx.preferredTags || []).filter((tag) => tags.includes(tag)))
  );

  let score = base;
  const reasons: string[] = [];
  score += rating * w.ratingWeight;
  score += (sla / 100) * w.slaWeight;
  score += tier * w.tierWeight;
  score += reviews >= 200 ? w.reviewBonus200 : reviews >= 50 ? w.reviewBonus50 : 0;
  score += available ? w.availableBonus : w.notAvailablePenalty;
  if (rating > 0) reasons.push(`평점 ${rating.toFixed(1)}`);
  if (sla > 0) reasons.push(`SLA ${Math.round(sla)}%`);
  reasons.push(`티어 ${String(partner.qualityTier || "Bronze")}`);

  if (ctx.desiredRegion) {
    if (regions.length === 0) score -= 1;
    else score += regionMatch ? w.regionMatchWeight : w.regionMismatchWeight;
    reasons.push(regionMatch ? `지역 일치(${ctx.desiredRegion})` : "지역 불일치");
  }
  if ((ctx.desiredSpecialties || []).length > 0) {
    if (specialties.length === 0) score -= 1;
    else score += specialtyMatch ? w.specialtyMatchWeight : w.specialtyMismatchWeight;
    reasons.push(specialtyMatch ? "전문분야 일치" : "전문분야 불일치");
  }
  if ((ctx.desiredScenarioKeys || []).length > 0 && scenarioKeysHandled.length > 0) {
    score += scenarioKeyMatch ? w.scenarioKeyMatchWeight : w.scenarioKeyMismatchWeight;
    reasons.push(scenarioKeyMatch ? "세부 시나리오 처리 가능" : "세부 시나리오 불일치");
  }
  if (preferredTagsMatched.length > 0) {
    score += preferredTagsMatched.length * w.preferredTagMatchWeight;
    reasons.push(`전문태그 일치(${preferredTagsMatched.slice(0, 2).join(", ")})`);
  }

  if (ctx.urgent) {
    score += Math.max(0, 20 - eta) * w.urgentEtaWeight;
    reasons.push(`긴급·ETA ${Math.round(eta)}h`);
  } else {
    score += Math.max(0, 10 - eta / 4) * w.normalEtaWeight;
    reasons.push(`ETA ${Math.round(eta)}h`);
  }

  if (price > 0) {
    score += Math.max(-5, 20 - price / 20000) * w.priceWeight;
    reasons.push(`가격 ${Math.round(price).toLocaleString()}원`);
  }

  if (ctx.highQuality && tier < 3) {
    score += w.highQualityLowTierPenalty;
    reasons.push("복잡 케이스(고티어 우대)");
  }

  return { score, reasons: reasons.slice(0, 6) };
}

let cachedPublished: { loadedAtMs: number; scenarios: FunnelScenarioDefinition[] } | null = null;

async function loadPublishedScenarios(db: admin.firestore.Firestore): Promise<FunnelScenarioDefinition[]> {
  const now = Date.now();
  if (cachedPublished && now - cachedPublished.loadedAtMs < 10_000) return cachedPublished.scenarios;
  const snap: any = await db.collection("ops_funnel_scenarios").limit(500).get();
  const docs = Array.isArray(snap?.docs) ? snap.docs : [];
  const scenarios = docs
    .map((d: any) => (typeof d?.data === "function" ? d.data() : d?.data) as any)
    .map((s: any) => s?.published as FunnelScenarioDefinition | undefined)
    .filter(Boolean) as FunnelScenarioDefinition[];
  const map = new Map<string, FunnelScenarioDefinition>();
  for (const s of registryScenarioTemplates()) map.set(s.scenarioKey, s);
  map.set(defaultFunnelScenario().scenarioKey, defaultFunnelScenario());
  for (const s of scenarios) map.set(s.scenarioKey, s);
  const resolved = Array.from(map.values());
  cachedPublished = { loadedAtMs: now, scenarios: resolved };
  return resolved;
}

export function registerOpsFunnelMatchingDebugRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  app.get("/v1/ops/funnel-sessions/:sessionId/matching-debug", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer");
      if (!hasRole) return;

      const sessionId = String(req.params.sessionId || "").trim();
      if (!sessionId) return fail(res, 400, "INVALID_ARGUMENT", "sessionId가 필요합니다.");

      const sessionSnap = await db.collection("funnel_sessions").doc(sessionId).get();
      if (!sessionSnap.exists) return fail(res, 404, "NOT_FOUND", "세션을 찾을 수 없습니다.");
      const session = sessionSnap.data() as any;

      const published = await loadPublishedScenarios(db);
      const scenario =
        published.find((s) => s.scenarioKey === session.scenarioKey && s.version === session.scenarioVersion) ||
        published.find((s) => s.scenarioKey === session.scenarioKey) ||
        defaultFunnelScenario();

      const answers = (session.answers || {}) as Record<string, any>;
      const taxonomy = await loadPartnerTaxonomy(db);
      const weights = await loadMatchingWeights(db);
      const desiredRegionRaw = String(answers.q_region || "");
      const desiredRegion = taxonomy.regions.includes(desiredRegionRaw) ? desiredRegionRaw : "";
      const desiredSpecialtiesRaw = Array.isArray((scenario as any).partnerMatch?.desiredSpecialties)
        ? (scenario as any).partnerMatch.desiredSpecialties
        : getDesiredSpecialtiesForScenarioKey(String(scenario.scenarioKey));
      const desiredSpecialties = (desiredSpecialtiesRaw || [])
        .map((v: any) => String(v))
        .filter((v: string) => taxonomy.specialties.includes(v));
      const desiredScenarioKeys = normalizeScenarioKeys(
        Array.isArray((scenario as any).partnerMatch?.desiredScenarioKeys)
          ? (scenario as any).partnerMatch.desiredScenarioKeys
          : [String(scenario.scenarioKey)]
      );
      const preferredTags = ((Array.isArray((scenario as any).partnerMatch?.preferredTags)
        ? (scenario as any).partnerMatch.preferredTags
        : getPreferredTagsForScenarioKey(String(scenario.scenarioKey))) || [])
        .map((v: any) => String(v))
        .filter((v: string) => (taxonomy.tags || []).includes(v));
      const urgent = isUrgentAnswer(answers);
      const highQuality = needsHighQuality(String(scenario.scenarioKey), answers);

      const snap = await db.collection("partners")
        .where("status", "==", "active")
        .where("isOverloaded", "!=", true)
        .orderBy("isOverloaded")
        .orderBy("rankingScore", "desc")
        .limit(100)
        .get();

      let partners = snap.docs.map((doc) => ({ partnerId: doc.id, ...(doc.data() as any) }));

      const requireTags = scenario.partnerMatch?.requireTags || [];
      if (requireTags.length > 0) {
        partners = partners.filter((p: any) => requireTags.every((t) => Array.isArray(p.tags) && p.tags.includes(t)));
      }

      const list = partners.map((p: any) => {
        const normalized = {
          partnerId: p.partnerId,
          name: p.name,
          rating: p.rating || 0,
          reviewCount: p.reviewCount || 0,
          price: p.price || 0,
          etaHours: p.etaHours || 24,
          slaComplianceRate: p.slaComplianceRate || 0,
          isSponsored: p.isSponsored === true,
          isAvailable: p.isAvailable !== false,
          rankingScore: p.rankingScore || 0,
          qualityTier: p.qualityTier || "Bronze",
          tags: sanitizeListWithAliases(p.tags, taxonomy.tags || [], taxonomy.aliases?.tags),
          regions: normalizeByAllowWithAliases(p.regions, taxonomy.regions, taxonomy.aliases?.regions),
          specialties: normalizeByAllowWithAliases(p.specialties, taxonomy.specialties, taxonomy.aliases?.specialties),
          scenarioKeysHandled: normalizeScenarioKeys(p.scenarioKeysHandled),
        };
        const m = computeMatch(normalized, { scenarioKey: scenario.scenarioKey, answers, desiredRegion, desiredSpecialties, desiredScenarioKeys, preferredTags, urgent, highQuality }, weights);
        return { ...normalized, matchScore: m.score, matchReasons: m.reasons };
      }).sort((a: any, b: any) => (b.matchScore - a.matchScore) || (b.rankingScore - a.rankingScore));

      return ok(res, {
        sessionId,
        scenario: { scenarioKey: scenario.scenarioKey, version: scenario.version, title: scenario.title },
        context: { desiredRegion, desiredSpecialties, desiredScenarioKeys, preferredTags, urgent, highQuality, requireTags },
        settings: { taxonomy, weights },
        top: list.slice(0, 20),
      });
    } catch (err: any) {
      logError({ endpoint: "ops/funnel-sessions/matching-debug/get", code: "INTERNAL", messageKo: "매칭 디버그 조회 실패", err });
      return fail(res, 500, "INTERNAL", "매칭 디버그 조회 실패");
    }
  });
}
