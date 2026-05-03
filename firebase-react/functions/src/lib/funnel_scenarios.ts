import * as admin from "firebase-admin";
import { listRegistryScenarioCards } from "./registry_scenario_cards";

export type FunnelQuestionType = "single_choice" | "text" | "number";

export interface FunnelQuestion {
  id: string;
  type: FunnelQuestionType;
  text: string;
  options?: string[];
  required?: boolean;
  depth?: 1 | 2 | 3;
  why?: string;
  next?: FunnelNext;
}

export type FunnelConditionOp = "eq" | "neq" | "in" | "nin" | "exists" | "not_exists" | "regex";

export interface FunnelCondition {
  questionId: string;
  op: FunnelConditionOp;
  value?: any;
}

export interface FunnelNextCase {
  when: FunnelCondition[];
  then: string | null;
}

export type FunnelNext = string | null | { cases: FunnelNextCase[] };

export interface FunnelPreviewBase {
  minPrice: number;
  maxPrice: number;
  etaDays: number;
  requiredDocs: string[];
}

export interface FunnelPreviewRule {
  when: FunnelCondition[];
  addMinPrice?: number;
  addMaxPrice?: number;
  addEtaDays?: number;
  addDocs?: string[];
  removeDocs?: string[];
}

export interface FunnelValidators {
  forbid?: Array<{
    when: FunnelCondition[];
    messageKo: string;
  }>;
}

export interface FunnelEntryMatchers {
  keywords?: string[];
}

export interface FunnelPartnerMatchRules {
  requireTags?: string[];
  desiredSpecialties?: string[];
}

export interface FunnelScenarioDefinition {
  schemaVersion: 1;
  scenarioKey: string;
  title: string;
  enabled: boolean;
  version: number;
  entry?: FunnelEntryMatchers;
  questions: FunnelQuestion[];
  previewBase: FunnelPreviewBase;
  previewRules?: FunnelPreviewRule[];
  validators?: FunnelValidators;
  partnerMatch?: FunnelPartnerMatchRules;
}

export interface FunnelScenarioDoc {
  scenarioKey: string;
  enabled: boolean;
  draft?: FunnelScenarioDefinition;
  published?: FunnelScenarioDefinition;
  updatedAt?: admin.firestore.Timestamp;
  updatedBy?: string;
}

export const getOpsFunnelScenariosCollection = () => admin.firestore().collection("ops_funnel_scenarios");

export function defaultFunnelScenario(): FunnelScenarioDefinition {
  return {
    schemaVersion: 1,
    scenarioKey: "corp_default",
    title: "기본 등기 시나리오",
    enabled: true,
    version: 1,
    entry: { keywords: ["법인", "등기", "설립", "본점", "임원", "증자", "상호", "청산"] },
    questions: [
      {
        id: "q_registry_type",
        type: "single_choice",
        text: "어떤 등기 업무를 원하시나요?",
        options: ["법인 설립", "본점 이전", "임원 변경", "자본금 증자", "상호 변경", "청산", "기타"],
        required: true,
        next: "q_region"
      },
      {
        id: "q_region",
        type: "single_choice",
        text: "어느 지역(관할) 관련 업무인가요?",
        options: ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "기타"],
        required: true,
        next: "q_notes"
      },
      {
        id: "q_notes",
        type: "text",
        text: "특이사항이나 요청사항을 간단히 적어주세요.",
        required: false,
        next: null
      }
    ],
    previewBase: {
      minPrice: 150000,
      maxPrice: 300000,
      etaDays: 3,
      requiredDocs: ["법인등기부등본", "인감증명서"]
    },
    previewRules: [
      { when: [{ questionId: "q_registry_type", op: "eq", value: "법인 설립" }], addDocs: ["주주명부"] },
      { when: [{ questionId: "q_registry_type", op: "eq", value: "자본금 증자" }], addMinPrice: 50000, addMaxPrice: 100000, addEtaDays: 1 }
    ],
    validators: {
      forbid: [
        {
          when: [{ questionId: "q_registry_type", op: "eq", value: "기타" }, { questionId: "q_notes", op: "regex", value: "코딩|프로그래밍|개발|react|typescript|python" }],
          messageKo: "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
        }
      ]
    }
  };
}

export function normalizeScenario(input: any): FunnelScenarioDefinition {
  const scenarioKey = String(input?.scenarioKey || "").trim();
  const title = String(input?.title || "").trim();
  if (!scenarioKey) throw new Error("scenarioKey가 필요합니다.");
  if (!title) throw new Error("title이 필요합니다.");
  const enabled = input?.enabled !== false;
  const version = Number.isFinite(Number(input?.version)) ? Number(input.version) : 1;
  const questions: FunnelQuestion[] = Array.isArray(input?.questions) ? input.questions : [];
  if (questions.length === 0) throw new Error("questions가 필요합니다.");
  const qIds = new Set<string>();
  for (const q of questions) {
    const id = String(q?.id || "").trim();
    if (!id) throw new Error("question.id가 필요합니다.");
    if (qIds.has(id)) throw new Error(`question.id 중복: ${id}`);
    qIds.add(id);
    const type = String(q?.type || "").trim() as FunnelQuestionType;
    if (type !== "single_choice" && type !== "text" && type !== "number") {
      throw new Error(`question.type이 올바르지 않습니다: ${id}`);
    }
    if (q?.depth !== undefined) {
      const d = Number(q.depth);
      if (d !== 1 && d !== 2 && d !== 3) throw new Error(`question.depth가 올바르지 않습니다: ${id}`);
    }
    if (q?.why !== undefined && typeof q.why !== "string") throw new Error(`question.why가 올바르지 않습니다: ${id}`);
    if (!String(q?.text || "").trim()) throw new Error(`question.text가 필요합니다: ${id}`);
    if (type === "single_choice" && (!Array.isArray(q?.options) || q.options.length === 0)) {
      throw new Error(`question.options가 필요합니다: ${id}`);
    }
  }
  const previewBase = input?.previewBase;
  if (!previewBase) throw new Error("previewBase가 필요합니다.");
  const requiredDocs = Array.isArray(previewBase.requiredDocs) ? previewBase.requiredDocs.map((d: any) => String(d)).filter(Boolean) : [];
  if (!Number.isFinite(Number(previewBase.minPrice)) || !Number.isFinite(Number(previewBase.maxPrice)) || !Number.isFinite(Number(previewBase.etaDays))) {
    throw new Error("previewBase(minPrice/maxPrice/etaDays)가 올바르지 않습니다.");
  }
  return {
    schemaVersion: 1,
    scenarioKey,
    title,
    enabled,
    version,
    entry: input?.entry && typeof input.entry === "object" ? { keywords: Array.isArray(input.entry.keywords) ? input.entry.keywords.map((k: any) => String(k)) : undefined } : undefined,
    questions: questions.map((q: any) => ({
      id: String(q.id).trim(),
      type: q.type,
      text: String(q.text),
      options: Array.isArray(q.options) ? q.options.map((o: any) => String(o)) : undefined,
      required: q.required === true,
      depth: q.depth === 1 || q.depth === 2 || q.depth === 3 ? q.depth : undefined,
      why: typeof q.why === "string" ? q.why : undefined,
      next: q.next ?? null
    })),
    previewBase: {
      minPrice: Number(previewBase.minPrice),
      maxPrice: Number(previewBase.maxPrice),
      etaDays: Number(previewBase.etaDays),
      requiredDocs
    },
    previewRules: Array.isArray(input?.previewRules) ? input.previewRules : undefined,
    validators: input?.validators && typeof input.validators === "object" ? input.validators : undefined,
    partnerMatch: input?.partnerMatch && typeof input.partnerMatch === "object" ? input.partnerMatch : undefined
  };
}

export function evaluateConditions(answers: Record<string, any>, conditions: FunnelCondition[] | undefined): boolean {
  if (!conditions || conditions.length === 0) return true;
  for (const c of conditions) {
    const actual = answers[c.questionId];
    const op = c.op;
    if (op === "exists") {
      if (actual === undefined || actual === null || String(actual).trim() === "") return false;
      continue;
    }
    if (op === "not_exists") {
      if (!(actual === undefined || actual === null || String(actual).trim() === "")) return false;
      continue;
    }
    if (op === "eq") {
      if (actual !== c.value) return false;
      continue;
    }
    if (op === "neq") {
      if (actual === c.value) return false;
      continue;
    }
    if (op === "in") {
      if (!Array.isArray(c.value) || !c.value.includes(actual)) return false;
      continue;
    }
    if (op === "nin") {
      if (Array.isArray(c.value) && c.value.includes(actual)) return false;
      continue;
    }
    if (op === "regex") {
      const re = new RegExp(String(c.value || ""), "i");
      if (!re.test(String(actual ?? ""))) return false;
      continue;
    }
    return false;
  }
  return true;
}

export function resolveNextQuestionId(next: FunnelNext | undefined, answers: Record<string, any>): string | null {
  if (next === undefined) return null;
  if (next === null) return null;
  if (typeof next === "string") return next;
  const cases = Array.isArray((next as any).cases) ? (next as any).cases as FunnelNextCase[] : [];
  for (const c of cases) {
    if (evaluateConditions(answers, c.when)) return c.then;
  }
  return null;
}

export function getNextQuestion(scenario: FunnelScenarioDefinition, currentQuestionId: string | null, answers: Record<string, any>): FunnelQuestion | null {
  const list = scenario.questions || [];
  if (!currentQuestionId) return list[0] || null;
  const cur = list.find((q) => q.id === currentQuestionId);
  if (!cur) return null;
  const nextId = resolveNextQuestionId(cur.next ?? null, answers);
  if (!nextId) return null;
  return list.find((q) => q.id === nextId) || null;
}

export function getPendingQuestion(scenario: FunnelScenarioDefinition, answers: Record<string, any>): FunnelQuestion | null {
  const list = scenario.questions || [];
  let q: FunnelQuestion | null = list[0] || null;
  let safety = 0;
  while (q && safety < 100) {
    safety += 1;
    const v = answers?.[q.id];
    if (v === undefined || v === null || String(v).trim() === "") return q;
    const nextId = resolveNextQuestionId(q.next ?? null, answers);
    if (!nextId) return null;
    q = list.find((x) => x.id === nextId) || null;
  }
  return null;
}

export function computePreview(scenario: FunnelScenarioDefinition, answers: Record<string, any>): FunnelPreviewBase {
  let minPrice = scenario.previewBase.minPrice;
  let maxPrice = scenario.previewBase.maxPrice;
  let etaDays = scenario.previewBase.etaDays;
  const docs = new Set<string>(scenario.previewBase.requiredDocs || []);
  for (const r of scenario.previewRules || []) {
    if (!evaluateConditions(answers, r.when)) continue;
    if (Number.isFinite(Number(r.addMinPrice))) minPrice += Number(r.addMinPrice);
    if (Number.isFinite(Number(r.addMaxPrice))) maxPrice += Number(r.addMaxPrice);
    if (Number.isFinite(Number(r.addEtaDays))) etaDays += Number(r.addEtaDays);
    for (const d of r.addDocs || []) docs.add(String(d));
    for (const d of r.removeDocs || []) docs.delete(String(d));
  }
  return { minPrice, maxPrice, etaDays, requiredDocs: Array.from(docs) };
}

export function validateAnswers(
  scenario: FunnelScenarioDefinition,
  answers: Record<string, any>
): { ok: true } | { ok: false; messageKo: string } {
  for (const q of scenario.questions || []) {
    if (!q.required) continue;
    const v = answers[q.id];
    if (v === undefined || v === null || String(v).trim() === "") {
      return { ok: false, messageKo: "필수 질문에 답변이 필요합니다." };
    }
  }
  for (const rule of scenario.validators?.forbid || []) {
    if (evaluateConditions(answers, rule.when)) {
      return { ok: false, messageKo: String(rule.messageKo || "요청을 처리할 수 없습니다.") };
    }
  }
  return { ok: true };
}

export function matchScenario(intentText: string, scenarios: FunnelScenarioDefinition[]): FunnelScenarioDefinition | null {
  const text = String(intentText || "").toLowerCase();
  if (!text) return null;
  let best: { score: number; scenario: FunnelScenarioDefinition } | null = null;
  for (const s of scenarios) {
    if (!s.enabled) continue;
    const keywords = s.entry?.keywords || [];
    let score = 0;
    for (const k of keywords) {
      const kk = String(k || "").trim().toLowerCase();
      if (!kk) continue;
      if (text.includes(kk)) score += kk.length;
    }
    if (score <= 0) continue;
    if (!best || score > best.score) best = { score, scenario: s };
  }
  return best?.scenario || null;
}

export function registryScenarioTemplates(): FunnelScenarioDefinition[] {
  const commonRegion: FunnelQuestion = {
    id: "q_region",
    type: "single_choice",
    text: "어느 지역(관할) 관련 업무인가요?",
    options: ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "기타"],
    required: true,
    next: "q_notes"
  };
  const commonNotes: FunnelQuestion = {
    id: "q_notes",
    type: "text",
    text: "특이사항이나 요청사항을 간단히 적어주세요.",
    required: false,
    next: null
  };

  const validators: FunnelValidators = {
    forbid: [
      {
        when: [{ questionId: "q_notes", op: "regex", value: "코딩|프로그래밍|개발|react|typescript|python|java|sql|docker|kubernetes|깃|git" }],
        messageKo: "본 입력은 서비스 범위와 무관합니다. 등기 업무 관련 요청을 입력해주세요."
      }
    ]
  };

  const corpEstablishment: FunnelScenarioDefinition = {
    schemaVersion: 1,
    scenarioKey: "corp_establishment",
    title: "법인 설립",
    enabled: true,
    version: 1,
    entry: { keywords: ["법인 설립", "회사 설립", "신설 법인", "법인 만들기", "설립"] },
    questions: [
      {
        id: "q_corp_type",
        type: "single_choice",
        text: "어떤 형태의 법인인가요?",
        options: ["주식회사", "유한회사", "기타"],
        required: true,
        depth: 1,
        why: "회사 형태에 따라 필요한 절차/서류와 난이도가 달라집니다.",
        next: "q_founders_count_band"
      },
      {
        id: "q_founders_count_band",
        type: "single_choice",
        text: "발기인/주주 수는 어느 정도인가요?",
        options: ["1명", "2~3명", "4명 이상"],
        required: true,
        depth: 1,
        why: "참여자 수가 많을수록 의사결정/서명 회수와 서류가 복잡해집니다.",
        next: "q_capital_band"
      },
      {
        id: "q_capital_band",
        type: "single_choice",
        text: "자본금 규모는 어느 정도인가요?",
        options: ["1천만원 이하", "1천만원~1억원", "1억원 이상"],
        required: true,
        depth: 1,
        why: "자본금 규모에 따라 비용/기간과 추가 확인이 달라질 수 있습니다.",
        next: "q_officer_has_auditor"
      },
      {
        id: "q_officer_has_auditor",
        type: "single_choice",
        text: "감사(또는 감사위원회) 선임이 필요한가요?",
        options: ["예", "아니오", "모르겠음"],
        required: true,
        depth: 2,
        why: "감사 선임 여부에 따라 임원 관련 서류와 절차가 추가됩니다.",
        next: "q_foreign_participant"
      },
      {
        id: "q_foreign_participant",
        type: "single_choice",
        text: "외국인(또는 외국법인) 주주/임원이 포함되나요?",
        options: ["아니오", "예", "모르겠음"],
        required: true,
        depth: 2,
        why: "외국인/외국법인은 번역·공증·아포스티유 등 추가 요건이 발생할 수 있습니다.",
        next: "q_seal_ready"
      },
      {
        id: "q_seal_ready",
        type: "single_choice",
        text: "법인 인감/사용인감 준비 상태는 어떤가요?",
        options: ["준비됨", "미준비(제작 필요)", "모르겠음"],
        required: true,
        depth: 2,
        why: "인감 준비 여부가 서명/날인 회수와 일정에 직접 영향을 줍니다.",
        next: "q_region"
      },
      commonRegion,
      commonNotes
    ],
    previewBase: { minPrice: 250000, maxPrice: 450000, etaDays: 5, requiredDocs: ["정관(초안)", "주주명부", "임원 취임승낙서"] },
    previewRules: [
      { when: [{ questionId: "q_corp_type", op: "eq", value: "기타" }], addMinPrice: 50000, addMaxPrice: 100000, addEtaDays: 1 },
      { when: [{ questionId: "q_founders_count_band", op: "eq", value: "4명 이상" }], addMinPrice: 30000, addMaxPrice: 80000, addEtaDays: 1 },
      { when: [{ questionId: "q_capital_band", op: "eq", value: "1억원 이상" }], addMinPrice: 50000, addMaxPrice: 150000, addEtaDays: 1 },
      { when: [{ questionId: "q_officer_has_auditor", op: "eq", value: "예" }], addDocs: ["감사 취임승낙서"] },
      { when: [{ questionId: "q_foreign_participant", op: "in", value: ["예", "모르겠음"] }], addMinPrice: 80000, addMaxPrice: 150000, addEtaDays: 2, addDocs: ["외국인/외국법인 관련 추가서류(확인 필요)"] },
      { when: [{ questionId: "q_seal_ready", op: "in", value: ["미준비(제작 필요)", "모르겠음"] }], addEtaDays: 1 }
    ],
    validators: {
      forbid: [
        ...(validators.forbid || []),
        {
          when: [{ questionId: "q_corp_type", op: "eq", value: "기타" }, { questionId: "q_notes", op: "not_exists" }],
          messageKo: "법인 형태가 '기타'인 경우 요청사항(특이사항)을 입력해주세요."
        },
        {
          when: [{ questionId: "q_foreign_participant", op: "eq", value: "예" }, { questionId: "q_notes", op: "not_exists" }],
          messageKo: "외국인/외국법인 참여가 있는 경우 특이사항에 대상(주주/임원), 국적/구성 등을 간단히 적어주세요."
        }
      ]
    },
    partnerMatch: {
      desiredSpecialties: ["법인 설립"]
    }
  };

  const hqRelocation: FunnelScenarioDefinition = {
    schemaVersion: 1,
    scenarioKey: "hq_relocation",
    title: "본점 이전",
    enabled: true,
    version: 1,
    entry: { keywords: ["본점 이전", "주소 이전", "이전 등기", "사무실 이전"] },
    questions: [
      {
        id: "q_move_scope",
        type: "single_choice",
        text: "이전 범위는 어떤가요?",
        options: ["관내 이전", "관외 이전(관할 변경)"],
        required: true,
        depth: 1,
        why: "관할 변경 여부에 따라 접수/서류/기간이 달라집니다.",
        next: "q_move_timing"
      },
      {
        id: "q_move_timing",
        type: "single_choice",
        text: "언제까지 처리가 필요하신가요?",
        options: ["긴급(1~2일)", "일반(3~5일)", "여유(1주 이상)"],
        required: true,
        depth: 1,
        why: "기한이 촉박할수록 우선 처리/일정 조정이 필요할 수 있습니다.",
        next: "q_address_ready"
      },
      {
        id: "q_address_ready",
        type: "single_choice",
        text: "이전할 주소(임대차 등)가 확정되어 있나요?",
        options: ["예(확정)", "아니오(미정)", "모르겠음"],
        required: true,
        depth: 2,
        why: "주소 확정 여부는 결의/신청서 작성 가능 여부에 직접 영향을 줍니다.",
        next: "q_documents_ready"
      },
      {
        id: "q_documents_ready",
        type: "single_choice",
        text: "임대차계약서/사용승낙서 등 주소 관련 서류 준비가 되어 있나요?",
        options: ["예(준비됨)", "아니오(준비 필요)", "모르겠음"],
        required: true,
        depth: 2,
        why: "주소 관련 서류가 없으면 접수 전 단계에서 지연/보정이 발생할 수 있습니다.",
        next: "q_region"
      },
      commonRegion,
      commonNotes
    ],
    previewBase: { minPrice: 120000, maxPrice: 260000, etaDays: 3, requiredDocs: ["법인등기부등본", "임대차계약서(또는 사용승낙서)"] },
    previewRules: [
      { when: [{ questionId: "q_move_scope", op: "eq", value: "관외 이전(관할 변경)" }], addMinPrice: 60000, addMaxPrice: 120000, addEtaDays: 1 },
      { when: [{ questionId: "q_move_timing", op: "eq", value: "긴급(1~2일)" }], addMinPrice: 50000, addMaxPrice: 80000 },
      { when: [{ questionId: "q_address_ready", op: "in", value: ["아니오(미정)", "모르겠음"] }], addEtaDays: 2 },
      { when: [{ questionId: "q_documents_ready", op: "in", value: ["아니오(준비 필요)", "모르겠음"] }], addEtaDays: 1 }
    ],
    validators: {
      forbid: [
        ...(validators.forbid || []),
        {
          when: [{ questionId: "q_address_ready", op: "eq", value: "아니오(미정)" }, { questionId: "q_notes", op: "not_exists" }],
          messageKo: "주소가 미정인 경우, 현재 예상 지역/시점 등을 특이사항에 적어주세요."
        }
      ]
    },
    partnerMatch: {
      desiredSpecialties: ["본점 이전"]
    }
  };

  const officerChange: FunnelScenarioDefinition = {
    schemaVersion: 1,
    scenarioKey: "officer_change",
    title: "임원 변경",
    enabled: true,
    version: 1,
    entry: { keywords: ["임원 변경", "대표 변경", "이사 변경", "감사 변경", "취임", "사임", "중임", "퇴임"] },
    questions: [
      {
        id: "q_officer_kind",
        type: "single_choice",
        text: "어떤 임원에 대한 변경인가요?",
        options: ["대표이사", "이사", "감사", "기타"],
        required: true,
        depth: 1,
        why: "변경 대상 직위에 따라 결의/서류/보정 포인트가 달라집니다.",
        next: "q_officer_change_type"
      },
      {
        id: "q_officer_change_type",
        type: "single_choice",
        text: "어떤 임원 변경인가요?",
        options: ["취임", "사임", "중임", "퇴임", "대표이사 변경", "기타"],
        required: true,
        depth: 1,
        why: "취임/사임/중임 조합에 따라 서류 구성과 효력일이 달라집니다.",
        next: "q_resolution_kind"
      },
      {
        id: "q_resolution_kind",
        type: "single_choice",
        text: "의사결정 방식은 어떤가요?",
        options: ["주주총회 결의", "이사회 결의", "서면결의/동의", "모르겠음"],
        required: true,
        depth: 2,
        why: "결의기관/방식에 따라 의사록/주주명부 등 첨부서류가 달라집니다.",
        next: "q_officer_count_band"
      },
      {
        id: "q_officer_count_band",
        type: "single_choice",
        text: "변경되는 임원 수는 몇 명인가요?",
        options: ["1명", "2~3명", "4명 이상"],
        required: true,
        depth: 2,
        why: "변경 인원이 많을수록 서명/첨부서류와 일정이 늘어납니다.",
        next: "q_effective_timing"
      },
      {
        id: "q_effective_timing",
        type: "single_choice",
        text: "변경 효력(취임/사임 등) 발생 시점은 어떤가요?",
        options: ["이미 확정됨", "예정(변경 가능)", "모르겠음"],
        required: true,
        depth: 3,
        why: "효력일은 신청서/의사록 작성과 기한 판단에 필요합니다.",
        next: "q_region"
      },
      commonRegion,
      commonNotes
    ],
    previewBase: { minPrice: 150000, maxPrice: 320000, etaDays: 3, requiredDocs: ["주주총회 의사록(또는 이사회 의사록)", "임원 취임승낙서/사임서"] },
    previewRules: [
      { when: [{ questionId: "q_officer_count_band", op: "eq", value: "2~3명" }], addMinPrice: 40000, addMaxPrice: 80000 },
      { when: [{ questionId: "q_officer_count_band", op: "eq", value: "4명 이상" }], addMinPrice: 80000, addMaxPrice: 150000, addEtaDays: 1 },
      { when: [{ questionId: "q_officer_kind", op: "eq", value: "대표이사" }], addMinPrice: 30000, addMaxPrice: 60000 },
      { when: [{ questionId: "q_resolution_kind", op: "eq", value: "주주총회 결의" }], addDocs: ["주주명부"] },
      { when: [{ questionId: "q_resolution_kind", op: "eq", value: "서면결의/동의" }], addDocs: ["서면결의서/동의서"] },
      { when: [{ questionId: "q_effective_timing", op: "in", value: ["예정(변경 가능)", "모르겠음"] }], addEtaDays: 1 }
    ],
    validators: {
      forbid: [
        ...(validators.forbid || []),
        {
          when: [{ questionId: "q_officer_kind", op: "eq", value: "기타" }, { questionId: "q_notes", op: "not_exists" }],
          messageKo: "임원 종류가 '기타'인 경우 요청사항(특이사항)을 입력해주세요."
        },
        {
          when: [{ questionId: "q_officer_change_type", op: "eq", value: "기타" }, { questionId: "q_notes", op: "not_exists" }],
          messageKo: "임원 변경 유형이 '기타'인 경우 요청사항(특이사항)을 입력해주세요."
        },
        {
          when: [{ questionId: "q_resolution_kind", op: "eq", value: "모르겠음" }, { questionId: "q_notes", op: "not_exists" }],
          messageKo: "의사결정 방식이 '모르겠음'인 경우 현재 상황(대표/이사 수, 이사회 존재 여부 등)을 특이사항에 적어주세요."
        }
      ]
    },
    partnerMatch: {
      desiredSpecialties: ["임원 변경"]
    }
  };

  const capitalIncrease: FunnelScenarioDefinition = {
    schemaVersion: 1,
    scenarioKey: "capital_increase",
    title: "자본금 증자",
    enabled: true,
    version: 1,
    entry: { keywords: ["증자", "유상증자", "무상증자", "자본금 증자", "신주 발행"] },
    questions: [
      {
        id: "q_increase_type",
        type: "single_choice",
        text: "어떤 방식의 증자인가요?",
        options: ["유상증자", "무상증자", "모르겠음"],
        required: true,
        depth: 1,
        why: "유상/무상에 따라 결의·납입·첨부서류가 크게 달라집니다.",
        next: "q_investor_kind"
      },
      {
        id: "q_investor_kind",
        type: "single_choice",
        text: "신주 인수자는 누구인가요?",
        options: ["기존 주주", "제3자 포함", "모르겠음"],
        required: true,
        depth: 1,
        why: "제3자 배정 여부에 따라 절차/리스크/추가서류가 달라집니다.",
        next: "q_payment_proof"
      },
      {
        id: "q_payment_proof",
        type: "single_choice",
        text: "납입(또는 출자) 증빙 준비는 어떤가요?",
        options: ["예(준비됨)", "아니오(준비 필요)", "모르겠음"],
        required: true,
        depth: 2,
        why: "납입증빙은 접수 가능 여부와 보정 리스크를 좌우합니다.",
        next: "q_increase_band"
      },
      {
        id: "q_increase_band",
        type: "single_choice",
        text: "증자 규모는 어느 정도인가요?",
        options: ["1천만원 이하", "1천만원~1억원", "1억원 이상"],
        required: true,
        depth: 2,
        why: "규모가 클수록 추가 확인(납입/주금 관련)과 기간이 늘 수 있습니다.",
        next: "q_region"
      },
      commonRegion,
      commonNotes
    ],
    previewBase: { minPrice: 220000, maxPrice: 420000, etaDays: 4, requiredDocs: ["주주총회 의사록", "납입증명서류"] },
    previewRules: [
      { when: [{ questionId: "q_increase_type", op: "eq", value: "모르겠음" }], addEtaDays: 1 },
      { when: [{ questionId: "q_investor_kind", op: "eq", value: "제3자 포함" }], addMinPrice: 60000, addMaxPrice: 120000, addEtaDays: 1 },
      { when: [{ questionId: "q_payment_proof", op: "in", value: ["아니오(준비 필요)", "모르겠음"] }], addEtaDays: 2 },
      { when: [{ questionId: "q_increase_band", op: "eq", value: "1억원 이상" }], addMinPrice: 70000, addMaxPrice: 140000, addEtaDays: 1 }
    ],
    validators: {
      forbid: [
        ...(validators.forbid || []),
        {
          when: [{ questionId: "q_increase_type", op: "eq", value: "모르겠음" }, { questionId: "q_notes", op: "not_exists" }],
          messageKo: "증자 방식이 '모르겠음'인 경우 현재 상황(유상/무상 여부, 납입 예정 등)을 특이사항에 적어주세요."
        },
        {
          when: [{ questionId: "q_investor_kind", op: "eq", value: "제3자 포함" }, { questionId: "q_notes", op: "not_exists" }],
          messageKo: "제3자 배정이 포함되면, 특이사항에 인수자 정보/관계/조건 등을 간단히 적어주세요."
        }
      ]
    },
    partnerMatch: {
      desiredSpecialties: ["자본금 증자"]
    }
  };

  const nameChange: FunnelScenarioDefinition = {
    schemaVersion: 1,
    scenarioKey: "name_change",
    title: "상호 변경",
    enabled: true,
    version: 1,
    entry: { keywords: ["상호 변경", "회사명 변경", "법인명 변경", "이름 변경"] },
    questions: [
      {
        id: "q_name_ready",
        type: "single_choice",
        text: "변경할 상호(회사명)를 이미 정하셨나요?",
        options: ["예(정해짐)", "아니오(검토 필요)"],
        required: true,
        depth: 1,
        why: "상호 확정 여부에 따라 진행 단계(검토→결의→신청)가 달라집니다.",
        next: "q_name_check_needed"
      },
      {
        id: "q_name_check_needed",
        type: "single_choice",
        text: "동일/유사 상호 검토(선점 가능성 체크)가 필요하신가요?",
        options: ["예", "아니오", "모르겠음"],
        required: true,
        depth: 2,
        why: "유사 상호 리스크는 변경 실패/추가 일정 발생으로 이어질 수 있습니다.",
        next: "q_name_assets_ready"
      },
      {
        id: "q_name_assets_ready",
        type: "single_choice",
        text: "정관/인감/명함/도장 등 후속 변경(내부 자산 정리)이 필요한가요?",
        options: ["예", "아니오", "모르겠음"],
        required: true,
        depth: 3,
        why: "등기 외 후속 작업까지 함께 잡을지 판단하기 위한 질문입니다.",
        next: "q_region"
      },
      commonRegion,
      commonNotes
    ],
    previewBase: { minPrice: 120000, maxPrice: 240000, etaDays: 3, requiredDocs: ["주주총회 의사록(또는 이사회 의사록)"] },
    previewRules: [
      { when: [{ questionId: "q_name_ready", op: "eq", value: "아니오(검토 필요)" }], addEtaDays: 1 },
      { when: [{ questionId: "q_name_check_needed", op: "in", value: ["예", "모르겠음"] }], addEtaDays: 1 },
      { when: [{ questionId: "q_name_assets_ready", op: "eq", value: "예" }], addDocs: ["내부 변경 대상 리스트(확인 필요)"] }
    ],
    validators: {
      forbid: [
        ...(validators.forbid || []),
        {
          when: [{ questionId: "q_name_ready", op: "eq", value: "예(정해짐)" }, { questionId: "q_notes", op: "not_exists" }],
          messageKo: "상호가 이미 정해진 경우, 특이사항에 희망 상호(회사명) 후보를 적어주세요."
        }
      ]
    },
    partnerMatch: {
      desiredSpecialties: ["상호 변경"]
    }
  };

  const dissolution: FunnelScenarioDefinition = {
    schemaVersion: 1,
    scenarioKey: "dissolution",
    title: "청산(해산/청산)",
    enabled: true,
    version: 1,
    entry: { keywords: ["청산", "해산", "폐업", "정리", "법인 종료"] },
    questions: [
      {
        id: "q_dissolution_type",
        type: "single_choice",
        text: "어떤 유형의 청산인가요?",
        options: ["자진 해산", "기타(상담 필요)"],
        required: true,
        next: "q_dissolution_scope"
      },
      {
        id: "q_dissolution_scope",
        type: "single_choice",
        text: "어디까지 진행이 필요하신가요?",
        options: ["해산 등기만", "해산 + 청산종결까지", "모르겠음"],
        required: true,
        next: "q_asset_state"
      },
      {
        id: "q_asset_state",
        type: "single_choice",
        text: "미정산 자산/채무/미수금 등이 있나요?",
        options: ["없음", "있음", "모르겠음"],
        required: true,
        next: "q_tax_issue"
      },
      {
        id: "q_tax_issue",
        type: "single_choice",
        text: "세무/정산(신고·체납 등) 이슈 가능성이 있나요?",
        options: ["없음", "있음", "모르겠음"],
        required: true,
        next: "q_region"
      },
      commonRegion,
      commonNotes
    ],
    previewBase: { minPrice: 300000, maxPrice: 600000, etaDays: 7, requiredDocs: ["주주총회 의사록", "청산인 관련 서류"] },
    previewRules: [
      { when: [{ questionId: "q_dissolution_type", op: "eq", value: "기타(상담 필요)" }], addEtaDays: 2 },
      { when: [{ questionId: "q_dissolution_scope", op: "in", value: ["해산 + 청산종결까지", "모르겠음"] }], addMinPrice: 150000, addMaxPrice: 250000, addEtaDays: 3 },
      { when: [{ questionId: "q_asset_state", op: "in", value: ["있음", "모르겠음"] }], addMinPrice: 100000, addMaxPrice: 200000, addEtaDays: 2 },
      { when: [{ questionId: "q_tax_issue", op: "in", value: ["있음", "모르겠음"] }], addMinPrice: 80000, addMaxPrice: 150000, addEtaDays: 2, addDocs: ["세무/정산 관련 추가 확인(필요)"] }
    ],
    validators: {
      forbid: [
        ...(validators.forbid || []),
        {
          when: [{ questionId: "q_dissolution_type", op: "eq", value: "기타(상담 필요)" }, { questionId: "q_notes", op: "not_exists" }],
          messageKo: "청산 유형이 '기타'인 경우 현재 상황을 특이사항에 적어주세요."
        },
        {
          when: [{ questionId: "q_tax_issue", op: "eq", value: "있음" }, { questionId: "q_notes", op: "not_exists" }],
          messageKo: "세무/정산 이슈가 있는 경우, 특이사항에 간단한 현황을 적어주세요."
        }
      ]
    },
    partnerMatch: {
      desiredSpecialties: ["청산"]
    }
  };

  const base = [corpEstablishment, hqRelocation, officerChange, capitalIncrease, nameChange, dissolution];
  const map = new Map<string, FunnelScenarioDefinition>();
  for (const s of base) map.set(s.scenarioKey, s);

  for (const card of listRegistryScenarioCards()) {
    const scenarioKey = String(card?.scenarioKey || "").trim();
    if (!scenarioKey) continue;
    if (scenarioKey === "corp_default") continue;
    if (map.has(scenarioKey)) continue;

    const displayName = String(card.displayName || "").trim() || scenarioKey;
    const keywords = Array.from(
      new Set(
        [displayName, ...displayName.split("/").map((v) => v.trim()).filter(Boolean)]
      )
    );

    const generic: FunnelScenarioDefinition = {
      schemaVersion: 1,
      scenarioKey,
      title: displayName,
      enabled: true,
      version: 1,
      entry: { keywords },
      questions: [
        {
          id: "q_case_detail",
          type: "text",
          text: `${displayName} 등기에서 현재 상황을 간단히 적어주세요.`,
          required: true,
          next: "q_region"
        },
        commonRegion,
        commonNotes
      ],
      previewBase: { minPrice: 150000, maxPrice: 300000, etaDays: 3, requiredDocs: ["등기사항전부증명서", "정관(있으면)"] },
      validators,
      partnerMatch: { desiredSpecialties: [displayName] }
    };

    map.set(scenarioKey, generic);
  }

  return Array.from(map.values()).sort((a, b) => a.scenarioKey.localeCompare(b.scenarioKey));
}
