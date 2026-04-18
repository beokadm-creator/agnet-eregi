"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.officerChangeFormRef = officerChangeFormRef;
exports.isYmd = isYmd;
exports.buildOfficerChangeResolutionKo = buildOfficerChangeResolutionKo;
function officerChangeFormRef(adminApp, caseId) {
    return adminApp.firestore().doc(`cases/${caseId}/forms/officer_change`);
}
function isYmd(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s));
}
function buildOfficerChangeResolutionKo(officers) {
    const list = Array.isArray(officers) ? officers : [];
    if (list.length === 0)
        return "임원 변경의 건";
    const lines = [];
    lines.push("다음과 같이 임원 변경을 결의한다.");
    for (const o of list.slice(0, 20)) {
        const name = String(o?.nameKo ?? "");
        const role = String(o?.roleKo ?? "");
        const dt = String(o?.effectiveDate ?? "");
        const ct = String(o?.changeType ?? "");
        const ctKo = ct === "appoint" ? "선임" : ct === "resign" ? "사임" : ct === "reappoint" ? "중임" : ct;
        const rep = o?.isRepresentative ? " (대표이사)" : "";
        lines.push(`- ${role} ${name}${rep}: ${ctKo} (효력일 ${dt})`);
    }
    return lines.join("\n");
}
//# sourceMappingURL=forms.js.map