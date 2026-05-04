import * as admin from "firebase-admin";
import { getOpsSettingsCollection } from "./ops_settings";

export interface MatchingWeights {
  ratingWeight: number;
  slaWeight: number;
  tierWeight: number;
  regionMatchWeight: number;
  regionMismatchWeight: number;
  specialtyMatchWeight: number;
  specialtyMismatchWeight: number;
  scenarioKeyMatchWeight: number;
  scenarioKeyMismatchWeight: number;
  preferredTagMatchWeight: number;
  urgentEtaWeight: number;
  normalEtaWeight: number;
  priceWeight: number;
  availableBonus: number;
  notAvailablePenalty: number;
  highQualityLowTierPenalty: number;
  reviewBonus50: number;
  reviewBonus200: number;
}

export interface MatchingWeightsDoc extends MatchingWeights {
  updatedAt?: admin.firestore.Timestamp;
  updatedBy?: string;
}

export function defaultMatchingWeights(): MatchingWeights {
  return {
    ratingWeight: 5,
    slaWeight: 5,
    tierWeight: 4,
    regionMatchWeight: 8,
    regionMismatchWeight: -4,
    specialtyMatchWeight: 10,
    specialtyMismatchWeight: -3,
    scenarioKeyMatchWeight: 12,
    scenarioKeyMismatchWeight: -4,
    preferredTagMatchWeight: 3,
    urgentEtaWeight: 1,
    normalEtaWeight: 1,
    priceWeight: 1,
    availableBonus: 2,
    notAvailablePenalty: -20,
    highQualityLowTierPenalty: -8,
    reviewBonus50: 1.5,
    reviewBonus200: 3,
  };
}

let cached: { loadedAtMs: number; weights: MatchingWeights } | null = null;

export async function loadMatchingWeights(db: admin.firestore.Firestore): Promise<MatchingWeights> {
  const now = Date.now();
  if (cached && now - cached.loadedAtMs < 10_000) return cached.weights;
  const snap: any = await getOpsSettingsCollection().doc("matching_weights").get();
  const raw = snap?.exists ? (snap.data() as any) : null;
  const d = defaultMatchingWeights();
  const w: MatchingWeights = {
    ratingWeight: Number.isFinite(Number(raw?.ratingWeight)) ? Number(raw.ratingWeight) : d.ratingWeight,
    slaWeight: Number.isFinite(Number(raw?.slaWeight)) ? Number(raw.slaWeight) : d.slaWeight,
    tierWeight: Number.isFinite(Number(raw?.tierWeight)) ? Number(raw.tierWeight) : d.tierWeight,
    regionMatchWeight: Number.isFinite(Number(raw?.regionMatchWeight)) ? Number(raw.regionMatchWeight) : d.regionMatchWeight,
    regionMismatchWeight: Number.isFinite(Number(raw?.regionMismatchWeight)) ? Number(raw.regionMismatchWeight) : d.regionMismatchWeight,
    specialtyMatchWeight: Number.isFinite(Number(raw?.specialtyMatchWeight)) ? Number(raw.specialtyMatchWeight) : d.specialtyMatchWeight,
    specialtyMismatchWeight: Number.isFinite(Number(raw?.specialtyMismatchWeight)) ? Number(raw.specialtyMismatchWeight) : d.specialtyMismatchWeight,
    scenarioKeyMatchWeight: Number.isFinite(Number(raw?.scenarioKeyMatchWeight)) ? Number(raw.scenarioKeyMatchWeight) : d.scenarioKeyMatchWeight,
    scenarioKeyMismatchWeight: Number.isFinite(Number(raw?.scenarioKeyMismatchWeight)) ? Number(raw.scenarioKeyMismatchWeight) : d.scenarioKeyMismatchWeight,
    preferredTagMatchWeight: Number.isFinite(Number(raw?.preferredTagMatchWeight)) ? Number(raw.preferredTagMatchWeight) : d.preferredTagMatchWeight,
    urgentEtaWeight: Number.isFinite(Number(raw?.urgentEtaWeight)) ? Number(raw.urgentEtaWeight) : d.urgentEtaWeight,
    normalEtaWeight: Number.isFinite(Number(raw?.normalEtaWeight)) ? Number(raw.normalEtaWeight) : d.normalEtaWeight,
    priceWeight: Number.isFinite(Number(raw?.priceWeight)) ? Number(raw.priceWeight) : d.priceWeight,
    availableBonus: Number.isFinite(Number(raw?.availableBonus)) ? Number(raw.availableBonus) : d.availableBonus,
    notAvailablePenalty: Number.isFinite(Number(raw?.notAvailablePenalty)) ? Number(raw.notAvailablePenalty) : d.notAvailablePenalty,
    highQualityLowTierPenalty: Number.isFinite(Number(raw?.highQualityLowTierPenalty))
      ? Number(raw.highQualityLowTierPenalty)
      : d.highQualityLowTierPenalty,
    reviewBonus50: Number.isFinite(Number(raw?.reviewBonus50)) ? Number(raw.reviewBonus50) : d.reviewBonus50,
    reviewBonus200: Number.isFinite(Number(raw?.reviewBonus200)) ? Number(raw.reviewBonus200) : d.reviewBonus200,
  };
  cached = { loadedAtMs: now, weights: w };
  return w;
}

export function normalizeMatchingWeights(input: any): MatchingWeights {
  const d = defaultMatchingWeights();
  const v = (k: keyof MatchingWeights): number => {
    const n = Number(input?.[k]);
    return Number.isFinite(n) ? n : d[k];
  };
  return {
    ratingWeight: v("ratingWeight"),
    slaWeight: v("slaWeight"),
    tierWeight: v("tierWeight"),
    regionMatchWeight: v("regionMatchWeight"),
    regionMismatchWeight: v("regionMismatchWeight"),
    specialtyMatchWeight: v("specialtyMatchWeight"),
    specialtyMismatchWeight: v("specialtyMismatchWeight"),
    scenarioKeyMatchWeight: v("scenarioKeyMatchWeight"),
    scenarioKeyMismatchWeight: v("scenarioKeyMismatchWeight"),
    preferredTagMatchWeight: v("preferredTagMatchWeight"),
    urgentEtaWeight: v("urgentEtaWeight"),
    normalEtaWeight: v("normalEtaWeight"),
    priceWeight: v("priceWeight"),
    availableBonus: v("availableBonus"),
    notAvailablePenalty: v("notAvailablePenalty"),
    highQualityLowTierPenalty: v("highQualityLowTierPenalty"),
    reviewBonus50: v("reviewBonus50"),
    reviewBonus200: v("reviewBonus200"),
  };
}
