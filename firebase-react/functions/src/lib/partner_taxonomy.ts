import * as admin from "firebase-admin";
import { getOpsSettingsCollection } from "./ops_settings";

export interface PartnerTaxonomy {
  regions: string[];
  specialties: string[];
  tags?: string[];
  aliases?: {
    regions?: Record<string, string>;
    specialties?: Record<string, string>;
    tags?: Record<string, string>;
  };
}

export interface PartnerTaxonomyDoc extends PartnerTaxonomy {
  updatedAt?: admin.firestore.Timestamp;
  updatedBy?: string;
}

export function defaultPartnerTaxonomy(): PartnerTaxonomy {
  return {
    regions: ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "기타"],
    specialties: ["법인 설립", "본점 이전", "임원 변경", "자본금 증자", "상호 변경", "청산"],
    tags: ["긴급대응", "외국인케이스", "대형케이스", "가성비", "프리미엄"],
    aliases: {
      regions: {
        "서울특별시": "서울",
        "경기도": "경기",
        "인천광역시": "인천",
        "부산광역시": "부산",
        "대구광역시": "대구",
        "광주광역시": "광주",
        "대전광역시": "대전",
        "울산광역시": "울산",
        "세종특별자치시": "세종",
      },
      specialties: {
        "법인설립": "법인 설립",
        "회사설립": "법인 설립",
        "본점이전": "본점 이전",
        "임원변경": "임원 변경",
        "증자": "자본금 증자",
        "자본금증자": "자본금 증자",
        "상호변경": "상호 변경",
        "해산": "청산",
      },
      tags: {
        "긴급": "긴급대응",
        "프리미엄급": "프리미엄",
      }
    }
  };
}

let cached: { loadedAtMs: number; taxonomy: PartnerTaxonomy } | null = null;

export async function loadPartnerTaxonomy(db: admin.firestore.Firestore): Promise<PartnerTaxonomy> {
  const now = Date.now();
  if (cached && now - cached.loadedAtMs < 10_000) return cached.taxonomy;
  const snap: any = await getOpsSettingsCollection().doc("partner_taxonomy").get();
  const raw = snap?.exists ? (snap.data() as any) : null;
  const base = defaultPartnerTaxonomy();
  const taxonomy: PartnerTaxonomy = {
    regions: Array.isArray(raw?.regions) ? raw.regions.map((v: any) => String(v)).filter(Boolean) : base.regions,
    specialties: Array.isArray(raw?.specialties) ? raw.specialties.map((v: any) => String(v)).filter(Boolean) : base.specialties,
    tags: Array.isArray(raw?.tags) ? raw.tags.map((v: any) => String(v)).filter(Boolean) : base.tags,
    aliases: raw?.aliases && typeof raw.aliases === "object" ? raw.aliases : base.aliases
  };
  cached = { loadedAtMs: now, taxonomy };
  return taxonomy;
}

export function normalizePartnerTaxonomy(input: any): PartnerTaxonomy {
  const regions = Array.isArray(input?.regions) ? input.regions.map((v: any) => String(v)).filter(Boolean) : [];
  const specialties = Array.isArray(input?.specialties) ? input.specialties.map((v: any) => String(v)).filter(Boolean) : [];
  const tags = Array.isArray(input?.tags) ? input.tags.map((v: any) => String(v)).filter(Boolean) : [];
  const aliases = input?.aliases && typeof input.aliases === "object" ? input.aliases : undefined;
  if (regions.length === 0) throw new Error("regions가 필요합니다.");
  if (specialties.length === 0) throw new Error("specialties가 필요합니다.");
  return { regions, specialties, tags, aliases };
}

export function sanitizeList(input: any, allow: string[]): string[] {
  const set = new Set(allow.map((v) => String(v)));
  const arr = Array.isArray(input) ? input : [];
  return arr.map((v: any) => String(v)).filter((v: string) => set.has(v));
}

export function normalizeToken(v: string): string {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function aliasToCanonical(raw: string, aliases: Record<string, string> | undefined): string {
  if (!aliases) return raw;
  const direct = aliases[raw];
  if (direct) return direct;
  const key = normalizeToken(raw);
  for (const [k, v] of Object.entries(aliases)) {
    if (normalizeToken(k) === key) return v;
  }
  return raw;
}

export function normalizeByAllowWithAliases(input: any, allow: string[], aliases: Record<string, string> | undefined): string[] {
  const allowNorm = new Map<string, string>();
  for (const a of allow) allowNorm.set(normalizeToken(a), a);
  const arr = Array.isArray(input) ? input : [];
  const out: string[] = [];
  for (const raw of arr) {
    const canonical = aliasToCanonical(String(raw), aliases);
    const mapped = allowNorm.get(normalizeToken(canonical));
    if (mapped) out.push(mapped);
  }
  return Array.from(new Set(out));
}

export function sanitizeListWithAliases(input: any, allow: string[], aliases: Record<string, string> | undefined): string[] {
  const canon = Array.isArray(input) ? input.map((v: any) => aliasToCanonical(String(v), aliases)) : [];
  return sanitizeList(canon, allow);
}
