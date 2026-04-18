"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveReviewIssues = resolveReviewIssues;
const casepack_1 = require("./casepack");
function resolveReviewIssues(params) {
    const cfg = (0, casepack_1.getCasePackConfig)(params.casePackId);
    if (!cfg)
        return { ok: false, reasonKo: "알 수 없는 casePackId 입니다." };
    const slot = params.slotId;
    const catalog = cfg.reviewIssuesBySlot?.[slot] ?? [];
    const map = new Map(catalog.map((i) => [i.code, i]));
    const unknown = params.issueCodes.filter((c) => !map.has(c));
    if (unknown.length > 0) {
        return { ok: false, reasonKo: `알 수 없는 issue code: ${unknown.join(", ")}` };
    }
    const issues = params.issueCodes.map((c) => map.get(c)).filter(Boolean);
    return { ok: true, issues };
}
//# sourceMappingURL=doc_review.js.map