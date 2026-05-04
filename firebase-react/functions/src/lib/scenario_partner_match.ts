import { listRegistryScenarioCards } from "./registry_scenario_cards";

export const PARTNER_SPECIALTIES = [
  "설립",
  "기본 변경",
  "자본·주식",
  "지점·지배인",
  "조직행위",
  "종료·청산",
] as const;

export const PARTNER_TAGS = [
  "긴급대응",
  "외국인케이스",
  "현물출자",
  "관외이전",
  "지점등기",
  "지배인등기",
  "감자",
  "CB/BW",
  "합병",
  "분할",
  "분할합병",
  "조직변경",
  "청산인",
  "청산종결",
  "회사계속",
  "보정재신청",
  "대형케이스",
  "가성비",
  "프리미엄",
] as const;

export interface ScenarioPartnerMatchProfile {
  specialties: string[];
  preferredTags: string[];
}

export interface PartnerProfileTemplate {
  templateKey: string;
  label: string;
  description: string;
  profile: {
    specialties: string[];
    scenarioKeysHandled: string[];
    tags: string[];
    qualityTier: "Bronze" | "Silver" | "Gold" | "Platinum";
    isSponsored: boolean;
    isAvailable: boolean;
    price: number;
    etaHours: number;
    maxCapacity: number;
  };
}

const SCENARIO_PARTNER_MATCH: Record<string, ScenarioPartnerMatchProfile> = {
  announcement_method_change: { specialties: ["기본 변경"], preferredTags: [] },
  branch_change: { specialties: ["지점·지배인"], preferredTags: ["지점등기"] },
  branch_registration: { specialties: ["지점·지배인"], preferredTags: ["지점등기"] },
  business_purpose_change: { specialties: ["기본 변경"], preferredTags: [] },
  capital_increase: { specialties: ["자본·주식"], preferredTags: [] },
  capital_reduction: { specialties: ["자본·주식"], preferredTags: ["감자"] },
  company_continuation: { specialties: ["종료·청산"], preferredTags: ["회사계속"] },
  company_split: { specialties: ["조직행위"], preferredTags: ["분할"] },
  convertible_bond_and_bw: { specialties: ["자본·주식"], preferredTags: ["CB/BW"] },
  corp_establishment: { specialties: ["설립"], preferredTags: [] },
  dissolution: { specialties: ["종료·청산"], preferredTags: [] },
  dormant_company_response: { specialties: ["종료·청산"], preferredTags: ["보정재신청"] },
  foreign_company_registration: { specialties: ["설립"], preferredTags: ["외국인케이스"] },
  head_office_relocation: { specialties: ["기본 변경"], preferredTags: ["관외이전"] },
  in_kind_contribution: { specialties: ["설립"], preferredTags: ["현물출자"] },
  liquidation_closure: { specialties: ["종료·청산"], preferredTags: ["청산종결"] },
  liquidator_appointment: { specialties: ["종료·청산"], preferredTags: ["청산인"] },
  manager_change: { specialties: ["지점·지배인"], preferredTags: ["지배인등기"] },
  manager_registration: { specialties: ["지점·지배인"], preferredTags: ["지배인등기"] },
  merger: { specialties: ["조직행위"], preferredTags: ["합병"] },
  officer_change: { specialties: ["기본 변경"], preferredTags: [] },
  organization_change: { specialties: ["조직행위"], preferredTags: ["조직변경"] },
  reapplication_after_rejection: { specialties: ["종료·청산"], preferredTags: ["보정재신청"] },
  split_merger: { specialties: ["조직행위"], preferredTags: ["분할합병"] },
  stock_consolidation: { specialties: ["자본·주식"], preferredTags: [] },
  stock_option: { specialties: ["자본·주식"], preferredTags: [] },
  stock_split: { specialties: ["자본·주식"], preferredTags: [] },
  trade_name_change: { specialties: ["기본 변경"], preferredTags: [] },
};

function normalizeToken(v: string): string {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[·/_-]/g, "");
}

export function getScenarioPartnerMatchProfile(scenarioKey: string): ScenarioPartnerMatchProfile {
  const key = String(scenarioKey || "").trim();
  return SCENARIO_PARTNER_MATCH[key] || { specialties: [], preferredTags: [] };
}

export function getDesiredSpecialtiesForScenarioKey(scenarioKey: string): string[] {
  return [...getScenarioPartnerMatchProfile(scenarioKey).specialties];
}

export function getPreferredTagsForScenarioKey(scenarioKey: string): string[] {
  return [...getScenarioPartnerMatchProfile(scenarioKey).preferredTags];
}

export function getKnownScenarioKeys(): string[] {
  const cardKeys = listRegistryScenarioCards().map((card) => String(card.scenarioKey || "").trim()).filter(Boolean);
  const mapKeys = Object.keys(SCENARIO_PARTNER_MATCH);
  return Array.from(new Set([...mapKeys, ...cardKeys])).sort();
}

export function normalizeScenarioKeys(input: any): string[] {
  const allow = new Set(getKnownScenarioKeys());
  const alias = new Map<string, string>();
  for (const key of allow) alias.set(normalizeToken(key), key);
  for (const card of listRegistryScenarioCards()) {
    const key = String(card.scenarioKey || "").trim();
    if (!key) continue;
    alias.set(normalizeToken(key), key);
    alias.set(normalizeToken(String(card.displayName || "")), key);
    alias.set(normalizeToken(String(card.title || "")), key);
  }
  const arr = Array.isArray(input) ? input : [];
  const out: string[] = [];
  for (const raw of arr) {
    const mapped = alias.get(normalizeToken(String(raw || "")));
    if (mapped && allow.has(mapped)) out.push(mapped);
  }
  return Array.from(new Set(out));
}

export function getPartnerProfileTemplates(): PartnerProfileTemplate[] {
  return [
    {
      templateKey: "establishment-premium",
      label: "설립 프리미엄",
      description: "법인 설립, 외국회사, 현물출자까지 처리 가능한 고난도 설립형 템플릿",
      profile: {
        specialties: ["설립"],
        scenarioKeysHandled: [
          "corp_establishment",
          "foreign_company_registration",
          "in_kind_contribution",
        ],
        tags: ["외국인케이스", "현물출자", "프리미엄"],
        qualityTier: "Gold",
        isSponsored: false,
        isAvailable: true,
        price: 350000,
        etaHours: 24,
        maxCapacity: 25,
      },
    },
    {
      templateKey: "change-generalist",
      label: "기본 변경 전문",
      description: "본점이전, 임원변경, 상호변경, 목적변경 등 일반 변경 사건 중심 템플릿",
      profile: {
        specialties: ["기본 변경"],
        scenarioKeysHandled: [
          "head_office_relocation",
          "officer_change",
          "trade_name_change",
          "business_purpose_change",
          "announcement_method_change",
        ],
        tags: ["관외이전", "긴급대응"],
        qualityTier: "Silver",
        isSponsored: false,
        isAvailable: true,
        price: 180000,
        etaHours: 18,
        maxCapacity: 40,
      },
    },
    {
      templateKey: "capital-equity",
      label: "자본·주식 특화",
      description: "증자, 감자, CB/BW, 주식분할·병합 등 자본시장 성격 사건 중심 템플릿",
      profile: {
        specialties: ["자본·주식"],
        scenarioKeysHandled: [
          "capital_increase",
          "capital_reduction",
          "convertible_bond_and_bw",
          "stock_split",
          "stock_consolidation",
          "stock_option",
        ],
        tags: ["감자", "CB/BW", "대형케이스"],
        qualityTier: "Gold",
        isSponsored: false,
        isAvailable: true,
        price: 320000,
        etaHours: 30,
        maxCapacity: 20,
      },
    },
    {
      templateKey: "branch-manager",
      label: "지점·지배인 전문",
      description: "지점 설치/변경/폐지와 지배인 선임·변경을 주로 처리하는 템플릿",
      profile: {
        specialties: ["지점·지배인"],
        scenarioKeysHandled: [
          "branch_registration",
          "branch_change",
          "manager_registration",
          "manager_change",
        ],
        tags: ["지점등기", "지배인등기", "가성비"],
        qualityTier: "Silver",
        isSponsored: false,
        isAvailable: true,
        price: 160000,
        etaHours: 24,
        maxCapacity: 35,
      },
    },
    {
      templateKey: "reorg-liquidation",
      label: "조직행위·청산 고난도",
      description: "합병/분할/분할합병/조직변경과 해산·청산·회사계속까지 담당하는 고난도 템플릿",
      profile: {
        specialties: ["조직행위", "종료·청산"],
        scenarioKeysHandled: [
          "merger",
          "company_split",
          "split_merger",
          "organization_change",
          "dissolution",
          "liquidator_appointment",
          "liquidation_closure",
          "company_continuation",
          "dormant_company_response",
          "reapplication_after_rejection",
        ],
        tags: ["합병", "분할", "분할합병", "조직변경", "청산인", "청산종결", "회사계속", "보정재신청", "프리미엄"],
        qualityTier: "Platinum",
        isSponsored: false,
        isAvailable: true,
        price: 480000,
        etaHours: 36,
        maxCapacity: 12,
      },
    },
  ];
}
