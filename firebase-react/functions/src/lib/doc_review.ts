import { getCasePackConfig, type DocumentSlotId, type ReviewIssue } from "./casepack";

export function resolveReviewIssues(params: { casePackId: string; slotId: string; issueCodes: string[] }) {
  const cfg = getCasePackConfig(params.casePackId);
  if (!cfg) return { ok: false as const, reasonKo: "알 수 없는 casePackId 입니다." };

  const slot = params.slotId as DocumentSlotId;
  const catalog = cfg.reviewIssuesBySlot?.[slot] ?? [];
  const map = new Map<string, ReviewIssue>(catalog.map((i) => [i.code, i]));

  const unknown = params.issueCodes.filter((c) => !map.has(c));
  if (unknown.length > 0) {
    return { ok: false as const, reasonKo: `알 수 없는 issue code: ${unknown.join(", ")}` };
  }

  const issues = params.issueCodes.map((c) => map.get(c)!).filter(Boolean);
  return { ok: true as const, issues };
}

