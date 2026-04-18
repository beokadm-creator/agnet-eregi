import type * as admin from "firebase-admin";

export type OfficerChangeForm = {
  caseId: string;
  companyName: string;
  meetingDate: string; // YYYY-MM-DD
  resolutionKo: string;
  officers: {
    nameKo: string;
    roleKo: string; // 직위(예: 대표이사/이사/감사)
    changeType: "appoint" | "resign" | "reappoint";
    effectiveDate: string; // YYYY-MM-DD
    birthDate?: string; // YYYY-MM-DD (선택)
    addressKo?: string; // 선택
    isRepresentative?: boolean; // 대표이사 여부(선택)
  }[];
  principalName: string;
  agentName: string;
  scopeKo: string;
  updatedAt: admin.firestore.FieldValue;
  createdAt: admin.firestore.FieldValue;
};

export function officerChangeFormRef(adminApp: typeof admin, caseId: string) {
  return adminApp.firestore().doc(`cases/${caseId}/forms/officer_change`);
}

export function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s));
}

export function buildOfficerChangeResolutionKo(officers: any[]) {
  const list = Array.isArray(officers) ? officers : [];
  if (list.length === 0) return "임원 변경의 건";
  const lines: string[] = [];
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
