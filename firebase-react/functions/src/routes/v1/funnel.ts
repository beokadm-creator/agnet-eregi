import { Express } from "express";
import * as admin from "firebase-admin";
import { ok, fail, logError } from "../../lib/http";
import { checkAndRecordUsage } from "../../lib/quota";
import { llmChatComplete } from "../../lib/llm_engine";
import { buildDataBlock, SYSTEM_HARDENING_SUFFIX } from "../../lib/prompt_sanitize";
import { getRegistryScenarioCard } from "../../lib/registry_scenario_cards";
import {
  computePreview,
  defaultFunnelScenario,
  evaluateConditions,
  FunnelScenarioDefinition,
  getPendingQuestion,
  getNextQuestion,
  matchScenario,
  registryScenarioTemplates,
} from "../../lib/funnel_scenarios";
import { listGeneratedFunnelScenarios } from "../../lib/registry_funnel_scenarios";
import { loadPartnerTaxonomy, normalizeByAllowWithAliases, sanitizeListWithAliases } from "../../lib/partner_taxonomy";
import { loadMatchingWeights } from "../../lib/matching_weights";
import { getDesiredSpecialtiesForScenarioKey, getPreferredTagsForScenarioKey, normalizeScenarioKeys } from "../../lib/scenario_partner_match";

function parseJsonText(text: string): any {
  const t = String(text || "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const cleaned = t.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
    return JSON.parse(cleaned);
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0);
}

function buildFallbackAiSuggestions(input: {
  scenarioCard: any;
  scenarioKey: string;
  answers: Record<string, any>;
}): {
  summaryKo: string;
  recommendedNextStepsKo: string[];
  recommendedPartnerCriteriaKo: string[];
  suggestedQuestionsKo: string[];
  followUpQuestions: Array<{
    type: "single_choice" | "text";
    text: string;
    options?: string[];
    required: boolean;
    depth: number;
    why: string;
  }>;
} {
  const scenarioTitle =
    String(input.scenarioCard?.displayName || input.scenarioCard?.title || input.scenarioKey || "등기 절차").trim();
  const region = String(input.answers?.q_region || "").trim();
  const sealReady = String(input.answers?.q_seal_ready || "").trim();
  const deadlineKnown = String(input.answers?.q_deadline || "").trim();

  const summaryParts = [
    `${scenarioTitle} 절차로 분류되었고, 현재 입력된 응답 기준으로 제출 전 핵심 정보와 준비 서류를 한 번 더 정리할 단계입니다.`,
    region ? `${region} 기준 진행 여부와 제출 순서를 함께 점검하는 것이 좋습니다.` : "관할과 제출 순서를 함께 점검하는 것이 좋습니다.",
  ];

  const nextSteps = [
    "등기 목적, 당사자 정보, 제출 서류를 한 번에 확인할 수 있도록 정리하세요.",
    sealReady ? `인감 준비 상태(${sealReady})에 맞춰 제작 또는 제출 일정을 먼저 확정하세요.` : "인감, 위임장, 주소 증빙 등 누락되기 쉬운 서류를 먼저 확인하세요.",
    "제출 전 보정 가능성이 높은 항목을 체크하고, 필요한 경우 전문가 검토를 요청하세요.",
  ];

  const criteria = [
    `${scenarioTitle} 처리 경험이 있는 파트너`,
    region ? `${region} 관할 또는 동일 지역 사건 경험` : "유사 사건 처리 경험과 절차 이해도",
    "보정 대응 속도와 커뮤니케이션이 빠른 파트너",
  ];

  const suggestedQuestions = [
    deadlineKnown ? `현재 확인된 일정(${deadlineKnown}) 외에 내부 마감일이 더 있나요?` : "반드시 맞춰야 하는 제출 기한이 있나요?",
    "아직 확정되지 않은 등기 정보나 의사결정 항목이 있나요?",
    "추가 발급이 필요한 증빙 서류나 위임 문서가 있나요?",
  ];

  return {
    summaryKo: summaryParts.join(" "),
    recommendedNextStepsKo: nextSteps,
    recommendedPartnerCriteriaKo: criteria,
    suggestedQuestionsKo: suggestedQuestions,
    followUpQuestions: [
      {
        type: "single_choice",
        text: "반드시 맞춰야 하는 제출 일정이 있나요?",
        options: ["있음", "없음", "아직 미정"],
        required: true,
        depth: 1,
        why: "일정이 있으면 처리 우선순위와 준비 순서가 달라질 수 있습니다.",
      },
      {
        type: "single_choice",
        text: "현재 기준으로 추가 발급이 필요한 서류가 있나요?",
        options: ["있음", "없음", "확인 필요"],
        required: true,
        depth: 2,
        why: "추가 서류 여부에 따라 보정 가능성과 전체 소요 시간이 달라집니다.",
      },
      {
        type: "text",
        text: "가장 걱정되는 준비 항목이나 아직 확정되지 않은 내용을 적어주세요.",
        required: true,
        depth: 2,
        why: "불확실한 지점을 먼저 확인하면 후속 질문과 파트너 추천 기준을 더 정확히 잡을 수 있습니다.",
      },
    ],
  };
}

function normalizeAiSuggestions(parsed: any, input: {
  scenarioCard: any;
  scenarioKey: string;
  answers: Record<string, any>;
}) {
  const fallback = buildFallbackAiSuggestions(input);
  const summaryKo = String(parsed?.summaryKo || "").trim() || fallback.summaryKo;
  const recommendedNextStepsKo = asStringArray(parsed?.recommendedNextStepsKo);
  const recommendedPartnerCriteriaKo = asStringArray(parsed?.recommendedPartnerCriteriaKo);
  const suggestedQuestionsKo = asStringArray(parsed?.suggestedQuestionsKo);
  const followUpQuestions = Array.isArray(parsed?.followUpQuestions) && parsed.followUpQuestions.length > 0
    ? parsed.followUpQuestions
    : fallback.followUpQuestions;

  return {
    summaryKo,
    recommendedNextStepsKo: recommendedNextStepsKo.length > 0 ? recommendedNextStepsKo : fallback.recommendedNextStepsKo,
    recommendedPartnerCriteriaKo: recommendedPartnerCriteriaKo.length > 0 ? recommendedPartnerCriteriaKo : fallback.recommendedPartnerCriteriaKo,
    suggestedQuestionsKo: suggestedQuestionsKo.length > 0 ? suggestedQuestionsKo : fallback.suggestedQuestionsKo,
    followUpQuestions,
  };
}

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

function registryTypeToScenarioKey(v: string): string | null {
  const s = String(v || "").trim();
  if (s === "법인 설립") return "corp_establishment";
  if (s === "본점 이전") return "head_office_relocation";
  if (s === "임원 변경") return "officer_change";
  if (s === "자본금 증자") return "capital_increase";
  if (s === "상호 변경") return "trade_name_change";
  if (s === "청산") return "dissolution";
  return null;
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
  for (const s of listGeneratedFunnelScenarios()) map.set(s.scenarioKey, s);
  for (const s of scenarios) map.set(s.scenarioKey, s);
  const resolved = Array.from(map.values());
  cachedPublished = { loadedAtMs: now, scenarios: resolved };
  return resolved;
}

function validateAnswerForQuestion(
  scenario: FunnelScenarioDefinition,
  questionId: string,
  answer: any
): { ok: true } | { ok: false; messageKo: string } {
  const q = (scenario.questions || []).find((qq) => qq.id === questionId);
  if (!q) return { ok: false, messageKo: "유효하지 않은 questionId 입니다." };
  if (answer === undefined || answer === null || String(answer).trim() === "") {
    if (q.required) return { ok: false, messageKo: "answer가 필요합니다." };
    return { ok: true };
  }
  if (q.type === "single_choice") {
    const opts = q.options || [];
    if (!opts.includes(String(answer))) return { ok: false, messageKo: "선택지에 없는 값입니다." };
  }
  if (q.type === "number") {
    const n = Number(answer);
    if (!Number.isFinite(n)) return { ok: false, messageKo: "숫자 형식의 answer가 필요합니다." };
  }
  return { ok: true };
}

function validateForbidRules(scenario: FunnelScenarioDefinition, answers: Record<string, any>): { ok: true } | { ok: false; messageKo: string } {
  for (const rule of scenario.validators?.forbid || []) {
    if (evaluateConditions(answers, rule.when)) {
      return { ok: false, messageKo: String(rule.messageKo || "요청을 처리할 수 없습니다.") };
    }
  }
  return { ok: true };
}

export function registerFunnelRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();
  let cachedPartnerPool: { loadedAtMs: number; partners: any[] } | null = null;

  async function loadPartnerPool(): Promise<any[]> {
    const now = Date.now();
    if (cachedPartnerPool && now - cachedPartnerPool.loadedAtMs < 10_000) return cachedPartnerPool.partners;
    const snapshot = await db.collection("partners")
      .where("status", "==", "active")
      .where("isOverloaded", "!=", true)
      .orderBy("isOverloaded")
      .orderBy("rankingScore", "desc")
      .limit(100)
      .get();
    const partners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    cachedPartnerPool = { loadedAtMs: now, partners };
    return partners;
  }

  // 1. 의도 제출 및 세션 시작 (EP-01-01)
  app.post("/v1/funnel/intent", async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const { intentText } = req.body;
    
    // (Optional) auth middleware is not strictly required here, but we could check req.user if logged in
    const userId = req.user?.uid || null;

    if (!intentText) {
      return fail(res, 400, "INVALID_ARGUMENT", "intentText가 필요합니다.", { requestId });
    }

    try {
      const published = await loadPublishedScenarios(db);
      const scenario = matchScenario(String(intentText), published) || defaultFunnelScenario();

      const sessionRef = db.collection("funnel_sessions").doc();
      const sessionId = sessionRef.id;

      const initialPreview = computePreview(scenario, {});

      await sessionRef.set({
        id: sessionId,
        userId,
        intent: intentText,
        scenarioKey: scenario.scenarioKey,
        scenarioVersion: scenario.version,
        status: "started",
        answers: {},
        preview: initialPreview,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection("funnel_events").add({
        sessionId,
        type: "INTENT_SUBMITTED",
        payload: { intentText },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return ok(res, {
        sessionId,
        scenarioKey: scenario.scenarioKey,
        scenarioVersion: scenario.version,
        nextQuestion: getNextQuestion(scenario, null, {})
      }, requestId);
    } catch (error: any) {
      logError("POST /v1/funnel/intent", "N/A", "INTERNAL", "의도 제출 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "의도 제출에 실패했습니다.", { error: error.message, requestId });
    }
  });

  app.get("/v1/funnel/sessions/:sessionId/state", async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const sessionId = String(req.params.sessionId);
    try {
      const sessionRef = db.collection("funnel_sessions").doc(sessionId);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 진단 세션을 찾을 수 없습니다.", { requestId });
      }
      const sessionData = sessionDoc.data() as any;
      const published = await loadPublishedScenarios(db);
      const scenario =
        published.find((s) => s.scenarioKey === sessionData.scenarioKey && s.version === sessionData.scenarioVersion) ||
        published.find((s) => s.scenarioKey === sessionData.scenarioKey) ||
        defaultFunnelScenario();
      const answers = (sessionData.answers || {}) as Record<string, any>;
      const nextQuestion = getPendingQuestion(scenario, answers);
      return ok(res, {
        isCompleted: nextQuestion === null,
        nextQuestion,
        preview: sessionData.preview,
        scenarioKey: scenario.scenarioKey,
        scenarioVersion: scenario.version
      }, requestId);
    } catch (error: any) {
      logError("GET /v1/funnel/sessions/:sessionId/state", "N/A", "INTERNAL", "세션 상태 조회 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "세션 상태 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  app.post("/v1/funnel/sessions/:sessionId/followup/start", async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const sessionId = String(req.params.sessionId);
    try {
      const sessionRef = db.collection("funnel_sessions").doc(sessionId);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 진단 세션을 찾을 수 없습니다.", { requestId });
      }
      const sessionData = sessionDoc.data() as any;
      const existing = sessionData?.followUp;
      if (existing?.status === "in_progress" && Array.isArray(existing?.questions)) {
        return ok(res, { started: false }, requestId);
      }
      const followUpRaw: any[] = Array.isArray(sessionData?.aiSuggestions?.followUpQuestions)
        ? sessionData.aiSuggestions.followUpQuestions
        : [];
      const followUpQs = followUpRaw
        .map((q, idx) => {
          const typeRaw = String(q?.type || "text");
          const type = typeRaw === "single_choice" || typeRaw === "number" || typeRaw === "text" ? typeRaw : "text";
          const options =
            type === "single_choice" && Array.isArray(q?.options)
              ? Array.from(new Set(q.options.map((o: any) => String(o)).filter(Boolean))).slice(0, 6)
              : undefined;
          return {
            id: `fq_${idx + 1}`,
            type,
            text: String(q?.text || "").trim(),
            options,
            required: q?.required !== false,
            depth: q?.depth === 1 || q?.depth === 2 || q?.depth === 3 ? q.depth : 3,
            why: typeof q?.why === "string" ? q.why : "정확한 안내를 위해 추가 확인이 필요합니다.",
            next: idx === followUpRaw.length - 1 ? null : `fq_${idx + 2}`
          };
        })
        .filter((q) => (q.type === "single_choice" ? q.text && Array.isArray(q.options) && q.options.length > 0 : q.text));

      const suggested: any[] = Array.isArray(sessionData?.aiSuggestions?.suggestedQuestionsKo)
        ? sessionData.aiSuggestions.suggestedQuestionsKo
        : [];
      const suggestedQs = suggested
        .map((s, idx) => {
          const textRaw = String(s || "").trim();
          const normalized = textRaw.replace(/\s+/g, " ").trim();
          const yesNoLike = /있나요\?|인가요\?|필요하신가요\?|포함되나요\?|해당되나요\?$/;
          const numberLike = /(몇|규모|금액|주식수|인원|명|원|주)\b/;
          const type = yesNoLike.test(normalized) ? "single_choice" : numberLike.test(normalized) ? "number" : "text";
          const options = type === "single_choice" ? ["예", "아니오", "모르겠음"] : undefined;
          const unitized =
            type === "number" && normalized.includes("금액") && !normalized.includes("(원)") ? `${normalized} (원)` :
            type === "number" && (normalized.includes("몇 명") || normalized.includes("인원") || normalized.includes("명")) && !normalized.includes("(명)") ? `${normalized} (명)` :
            type === "number" && normalized.includes("주식") && !normalized.includes("(주)") ? `${normalized} (주)` :
            normalized;
          return {
            id: `fq_${idx + 1}`,
            type,
            text: unitized,
            options,
            required: true,
            depth: type === "text" ? 3 : 2,
            why: "정확한 안내를 위해 추가 확인이 필요합니다.",
            next: idx === suggested.length - 1 ? null : `fq_${idx + 2}`
          };
        })
        .filter((q) => q.text);

      const qs = followUpQs.length > 0 ? followUpQs : suggestedQs;
      if (qs.length === 0) {
        return fail(res, 400, "FAILED_PRECONDITION", "추가 질문이 없습니다. 먼저 AI 추천을 생성해 주세요.", { requestId });
      }
      await sessionRef.set({
        followUp: {
          status: "in_progress",
          questions: qs,
          answers: {},
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }
      }, { merge: true });
      return ok(res, { started: true }, requestId);
    } catch (error: any) {
      logError("POST /v1/funnel/sessions/:sessionId/followup/start", "N/A", "INTERNAL", "추가 질문 시작 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "추가 질문 시작에 실패했습니다.", { error: error.message, requestId });
    }
  });

  app.get("/v1/funnel/sessions/:sessionId/followup/state", async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const sessionId = String(req.params.sessionId);
    try {
      const sessionRef = db.collection("funnel_sessions").doc(sessionId);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 진단 세션을 찾을 수 없습니다.", { requestId });
      }
      const sessionData = sessionDoc.data() as any;
      const followUp = sessionData?.followUp || null;
      const questions = Array.isArray(followUp?.questions) ? followUp.questions : [];
      const answers = (followUp?.answers || {}) as Record<string, any>;
      const tempScenario: FunnelScenarioDefinition = {
        schemaVersion: 1,
        scenarioKey: "followup",
        title: "추가 질문",
        enabled: true,
        version: 1,
        questions,
        previewBase: { minPrice: 0, maxPrice: 0, etaDays: 0, requiredDocs: [] }
      };
      const nextQuestion = getPendingQuestion(tempScenario, answers);
      return ok(res, { isCompleted: nextQuestion === null, nextQuestion }, requestId);
    } catch (error: any) {
      logError("GET /v1/funnel/sessions/:sessionId/followup/state", "N/A", "INTERNAL", "추가 질문 상태 조회 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "추가 질문 상태 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  app.post("/v1/funnel/sessions/:sessionId/followup/answer", async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const sessionId = String(req.params.sessionId);
    const { questionId, answer } = req.body;
    if (!questionId || answer === undefined) {
      return fail(res, 400, "INVALID_ARGUMENT", "questionId와 answer가 필요합니다.", { requestId });
    }
    try {
      const sessionRef = db.collection("funnel_sessions").doc(sessionId);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 진단 세션을 찾을 수 없습니다.", { requestId });
      }
      const sessionData = sessionDoc.data() as any;
      const followUp = sessionData?.followUp || null;
      const questions = Array.isArray(followUp?.questions) ? followUp.questions : [];
      if (questions.length === 0) return fail(res, 400, "FAILED_PRECONDITION", "추가 질문이 시작되지 않았습니다.", { requestId });
      const answers = { ...(followUp?.answers || {}) } as Record<string, any>;
      const published = await loadPublishedScenarios(db);
      const baseScenario =
        published.find((s) => s.scenarioKey === sessionData.scenarioKey && s.version === sessionData.scenarioVersion) ||
        published.find((s) => s.scenarioKey === sessionData.scenarioKey) ||
        defaultFunnelScenario();

      const tempScenario: FunnelScenarioDefinition = {
        schemaVersion: 1,
        scenarioKey: "followup",
        title: "추가 질문",
        enabled: true,
        version: 1,
        questions,
        previewBase: { minPrice: 0, maxPrice: 0, etaDays: 0, requiredDocs: [] }
      };
      const pending = getPendingQuestion(tempScenario, answers);
      if (!pending) return ok(res, { isCompleted: true, nextQuestion: null }, requestId);
      if (pending.id !== String(questionId)) return fail(res, 400, "FAILED_PRECONDITION", "현재 질문과 일치하지 않습니다.", { requestId });
      const answerOk = validateAnswerForQuestion(tempScenario, String(questionId), answer);
      if (!answerOk.ok) return fail(res, 400, "INVALID_ARGUMENT", answerOk.messageKo, { requestId });
      answers[String(questionId)] = answer;
      const mergedAnswers = { ...(sessionData.answers || {}), [String(questionId)]: answer };
      const forbidOk = validateForbidRules(baseScenario, mergedAnswers);
      if (!forbidOk.ok) return fail(res, 400, "FAILED_PRECONDITION", forbidOk.messageKo, { requestId });
      const nextQuestion = getPendingQuestion(tempScenario, answers);
      const isCompleted = nextQuestion === null;
      const preview = computePreview(baseScenario, mergedAnswers);
      await sessionRef.set({
        answers: mergedAnswers,
        followUp: {
          status: isCompleted ? "completed" : "in_progress",
          questions,
          answers,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        preview,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return ok(res, { isCompleted, nextQuestion }, requestId);
    } catch (error: any) {
      logError("POST /v1/funnel/sessions/:sessionId/followup/answer", "N/A", "INTERNAL", "추가 질문 답변 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "추가 질문 답변에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. 진단 답변 제출 (EP-01-02, EP-01-03)
  app.post("/v1/funnel/sessions/:sessionId/answer", async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const sessionId = String(req.params.sessionId);
    const { questionId, answer } = req.body;

    if (!questionId || answer === undefined) {
      return fail(res, 400, "INVALID_ARGUMENT", "questionId와 answer가 필요합니다.", { requestId });
    }

    try {
      const sessionRef = db.collection("funnel_sessions").doc(sessionId);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 진단 세션을 찾을 수 없습니다.", { requestId });
      }
      const sessionData = sessionDoc.data() as any;
      const published = await loadPublishedScenarios(db);
      const scenario =
        published.find((s) => s.scenarioKey === sessionData.scenarioKey && s.version === sessionData.scenarioVersion) ||
        published.find((s) => s.scenarioKey === sessionData.scenarioKey) ||
        defaultFunnelScenario();
      if (!scenario.enabled) return fail(res, 400, "FAILED_PRECONDITION", "현재 시나리오가 비활성화되어 있습니다.", { requestId });

      const answerOk = validateAnswerForQuestion(scenario, String(questionId), answer);
      if (!answerOk.ok) return fail(res, 400, "INVALID_ARGUMENT", answerOk.messageKo, { requestId });
      const scenarioKeyOverride =
        scenario.scenarioKey === "corp_default" && String(questionId) === "q_registry_type"
          ? registryTypeToScenarioKey(String(answer))
          : null;
      const nextScenario =
        scenarioKeyOverride
          ? published.find((s) => s.scenarioKey === scenarioKeyOverride) || scenario
          : scenario;
      const scenarioSwitched = nextScenario.scenarioKey !== scenario.scenarioKey;
      
      await db.runTransaction(async (transaction) => {
        const data = sessionData;
        const newAnswers = { ...(data.answers || {}), [questionId]: answer };
        const forbidOk = validateForbidRules(scenarioSwitched ? nextScenario : scenario, newAnswers);
        if (!forbidOk.ok) {
          throw new Error(`FORBIDDEN_RULE:${forbidOk.messageKo}`);
        }
        const nextQuestion = scenarioSwitched
          ? getNextQuestion(nextScenario, null, newAnswers)
          : getNextQuestion(scenario, String(questionId), newAnswers);
        const isCompleted = nextQuestion === null;
        const status = isCompleted ? "completed" : "diagnosing";
        const preview = computePreview(scenarioSwitched ? nextScenario : scenario, newAnswers);

        transaction.update(sessionRef, {
          answers: newAnswers,
          status,
          preview,
          ...(scenarioSwitched ? { scenarioKey: nextScenario.scenarioKey, scenarioVersion: nextScenario.version } : {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const eventRef = db.collection("funnel_events").doc();
        transaction.set(eventRef, {
          sessionId,
          type: "DIAGNOSIS_ANSWERED",
          payload: { questionId, answer, isCompleted },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Fetch the updated doc to return
      const updatedDoc = await sessionRef.get();
      const updatedData = updatedDoc.data() as any;
      const nextQuestion = scenarioSwitched
        ? getNextQuestion(nextScenario, null, updatedData.answers || {})
        : getNextQuestion(scenario, String(questionId), updatedData.answers || {});

      return ok(res, {
        isCompleted: nextQuestion === null,
        nextQuestion,
        preview: updatedData.preview
      }, requestId);

    } catch (error: any) {
      const msg = String(error?.message || "");
      if (msg.startsWith("FORBIDDEN_RULE:")) {
        return fail(res, 400, "FAILED_PRECONDITION", msg.replace("FORBIDDEN_RULE:", ""), { requestId });
      }
      logError("POST /v1/funnel/sessions/:sessionId/answer", "N/A", "INTERNAL", "답변 제출 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "답변 제출에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 3. 매칭 결과 조회 (EP-01-04, EP-02-01~03)
  app.get("/v1/funnel/sessions/:sessionId/results", async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const sessionId = String(req.params.sessionId);

    try {
      const sessionDoc = await db.collection("funnel_sessions").doc(sessionId).get();
      if (!sessionDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 진단 세션을 찾을 수 없습니다.", { requestId });
      }
      
      const sessionData = sessionDoc.data() as any;
      if (sessionData.status !== "completed") {
        // 완벽하게 막을 수도 있지만 유연성을 위해 경고만 줄 수도 있음. 여기서는 그냥 진행 허용.
      }

      const published = await loadPublishedScenarios(db);
      const scenario =
        published.find((s) => s.scenarioKey === sessionData.scenarioKey && s.version === sessionData.scenarioVersion) ||
        published.find((s) => s.scenarioKey === sessionData.scenarioKey) ||
        defaultFunnelScenario();
      const answers = (sessionData.answers || {}) as Record<string, any>;
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

      // 파트너 필터링 및 랭킹 (워커가 계산해둔 rankingScore를 기반으로 즉시 정렬하여 로드)
      // [EP-12-02] isOverloaded == true 인 파트너는 노출에서 제외
      const pool = await loadPartnerPool();
      let allPartners = pool.map((data: any) => {
        return {
          partnerId: data.id,
          name: data.name,
          profileImage: data.profileImage,
          rating: data.rating || 0,
          reviewCount: data.reviewCount || 0,
          price: data.price || 0,
          etaHours: data.etaHours || 24,
          slaComplianceRate: data.slaComplianceRate || 0,
          isSponsored: data.isSponsored === true,
          isAvailable: data.isAvailable !== false,
          rankingScore: data.rankingScore || 0,
          qualityTier: data.qualityTier || "Bronze",
          tags: sanitizeListWithAliases(data.tags, taxonomy.tags || [], taxonomy.aliases?.tags),
          regions: normalizeByAllowWithAliases(data.regions, taxonomy.regions, taxonomy.aliases?.regions),
          specialties: normalizeByAllowWithAliases(data.specialties, taxonomy.specialties, taxonomy.aliases?.specialties),
          scenarioKeysHandled: normalizeScenarioKeys(data.scenarioKeysHandled),
          activeCaseCount: data.activeCaseCount || 0,
          maxCapacity: data.maxCapacity || 50
        };
      });

      const requireTags = scenario.partnerMatch?.requireTags || [];
      if (requireTags.length > 0) {
        allPartners = allPartners.filter((p: any) => requireTags.every((t) => (p.tags || []).includes(t)));
      }

      allPartners.forEach((p: any) => {
        const m = computeMatch(
          p,
          {
          scenarioKey: String(scenario.scenarioKey),
          answers,
          desiredRegion,
          desiredSpecialties,
          desiredScenarioKeys,
          preferredTags,
          urgent,
          highQuality
          },
          weights
        );
        p.matchScore = m.score;
        p.matchReasons = m.reasons;
      });

      // 스폰서(광고)와 일반 추천 분리
      const sponsoredPartners = allPartners
        .filter(p => p.isSponsored)
        .sort((a: any, b: any) => (b.matchScore - a.matchScore) || (b.rankingScore - a.rankingScore))
        .slice(0, 3)
        .map(p => ({
          ...p,
          disclosure: "Sponsored Partner"
        }));

      const sponsoredIds = new Set(sponsoredPartners.map(p => p.partnerId));
      const organicPartners = allPartners
        .filter(p => !sponsoredIds.has(p.partnerId))
        .sort((a: any, b: any) => (b.matchScore - a.matchScore) || (b.rankingScore - a.rankingScore));

      const recommended = organicPartners.length > 0 ? organicPartners[0] : null;
      const compareTop3 = organicPartners.slice(1, 4);

      await db.collection("funnel_events").add({
        sessionId,
        type: "RESULTS_VIEWED",
        payload: {
          recommendedPartnerId: recommended?.partnerId || "none",
          comparePartnerIds: compareTop3.map(p => p.partnerId),
          sponsoredPartnerIds: sponsoredPartners.map(p => p.partnerId)
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return ok(res, {
        recommended,
        compareTop3,
        sponsored: sponsoredPartners,
        ai: sessionData.aiSuggestions || null
      }, requestId);

    } catch (error: any) {
      logError("GET /v1/funnel/sessions/:sessionId/results", "N/A", "INTERNAL", "매칭 결과 조회 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "매칭 결과 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 4. AI 추천/요약 생성 (기존 흐름은 유지)
  app.post("/v1/funnel/sessions/:sessionId/ai/suggestions", async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const sessionId = String(req.params.sessionId);

    try {
      const sessionRef = db.collection("funnel_sessions").doc(sessionId);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 진단 세션을 찾을 수 없습니다.", { requestId });
      }

      const sessionData = sessionDoc.data() as any;
      const quotaUserId = sessionData.userId || "anonymous";
      const quotaOk = await checkAndRecordUsage(quotaUserId, "ai_user", 50);
      if (!quotaOk) {
        return fail(res, 429, "RESOURCE_EXHAUSTED", "AI 호출 일일 한도를 초과했습니다. 내일 다시 시도해주세요.", { requestId });
      }

      const scenarioCard = getRegistryScenarioCard(String(sessionData.scenarioKey || ""));
      const snapshot = await db.collection("partners")
        .where("status", "==", "active")
        .where("isOverloaded", "!=", true)
        .orderBy("isOverloaded")
        .orderBy("rankingScore", "desc")
        .limit(8)
        .get();

      const partners = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          partnerId: doc.id,
          name: data.name,
          price: data.price || 0,
          etaHours: data.etaHours || 24,
          rating: data.rating || 0,
          reviewCount: data.reviewCount || 0,
          rankingScore: data.rankingScore || 0,
          qualityTier: data.qualityTier || "Bronze"
        };
      });

      const prompt = `
당신은 사용자 퍼널 진단/매칭을 돕는 AI입니다.
아래 입력을 바탕으로 사용자가 이해하기 쉬운 요약과 다음 단계 안내를 만들어 주세요.
반드시 오직 JSON으로만 응답하세요. 마크다운 백틱(\`\`\`)은 쓰지 마세요.

추가 질문 생성 규칙:
- followUpQuestions는 1~6개로 제한
- single_choice는 options 2~6개 필수(권장: ["예","아니오","모르겠음"] 또는 케이스별 대표 분기)
- number는 숫자만 입력하게 설계(질문 text에 단위를 포함: 예: "(원)", "(명)", "(주)")
- text는 문장 1~2개로 답변 가능한 형태로 작성
- why는 사용자가 납득할 수 있는 이유 1문장
- depth: 1=사건 분류/절차가 바뀜, 2=문서/리스크가 바뀜, 3=작성값 수집
- scenarioCard/answers/preview를 참고해 “지금 부족해서 보정/지연이 날” 질문을 우선

입력:
${buildDataBlock("funnel-input", {
  intent: sessionData.intent,
  scenarioKey: sessionData.scenarioKey,
  scenarioVersion: sessionData.scenarioVersion,
  scenarioCard,
  answers: sessionData.answers,
  preview: sessionData.preview,
  topPartners: partners.slice(0, 5),
})}

출력(JSON):
{
  "summaryKo": "요약(1~2문장)",
  "recommendedNextStepsKo": ["다음 단계 1", "다음 단계 2"],
  "recommendedPartnerCriteriaKo": ["추천 기준 1", "추천 기준 2"],
  "suggestedQuestionsKo": ["추가로 물어볼 질문 1", "질문 2"],
  "followUpQuestions": [
    {
      "type": "single_choice|number|text",
      "text": "추가 확인 질문(문장 형태로, number면 단위 포함)",
      "options": ["single_choice일 때만 2~6개 선택지"],
      "required": true,
      "depth": 3,
      "why": "왜 이 질문이 필요한지(사용자에게 설명 가능한 수준)"
    }
  ]
}
`;

      let out: { provider: string; model: string; text: string } | null = null;
      let parsed: any = {};
      let fallbackReason: string | null = null;
      try {
        out = await llmChatComplete(
          adminApp,
          [
            { role: "system", content: "당신은 한국어로만 답변하며, 오직 유효한 JSON만 반환합니다." + SYSTEM_HARDENING_SUFFIX },
            { role: "user", content: prompt }
          ],
          { temperature: 0.2, maxTokens: 900, expectJson: true }
        );
        parsed = parseJsonText(out.text || "{}");
      } catch (llmError: any) {
        fallbackReason = llmError?.message || "AI generation unavailable";
      }

      const normalizedAi = normalizeAiSuggestions(parsed, {
        scenarioCard,
        scenarioKey: String(sessionData.scenarioKey || ""),
        answers: sessionData.answers || {},
      });
      const aiSuggestions = {
        ...normalizedAi,
        provider: out?.provider || "fallback",
        model: out?.model || "fallback",
        ...(fallbackReason ? { fallbackReason } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await sessionRef.set({ aiSuggestions }, { merge: true });
      return ok(res, { ai: aiSuggestions }, requestId);

    } catch (error: any) {
      logError("POST /v1/funnel/sessions/:sessionId/ai/suggestions", "N/A", "INTERNAL", "AI 추천 생성 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "AI 추천 생성에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
