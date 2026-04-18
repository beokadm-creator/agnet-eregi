import type * as admin from "firebase-admin";
import { getCasePackConfig, type CaseStage, type DocumentSlotId } from "./casepack";
import { type CaseStatus } from "./case_status";
import { filingRef } from "./filing";
import { officerChangeFormRef } from "./forms";

export type CaseWorkflowDoc = {
  caseId: string;
  casePackId: string;
  stage: CaseStage;
  checklist: Record<string, boolean>; // itemId -> done
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
};

export function workflowRef(adminApp: typeof admin, caseId: string) {
  return adminApp.firestore().doc(`cases/${caseId}/workflow/main`);
}

export function initChecklist(casePackId: string, stage: CaseStage) {
  const cfg = getCasePackConfig(casePackId);
  const items = cfg?.checklistByStage?.[stage] ?? [];
  const map: Record<string, boolean> = {};
  for (const it of items) map[it.id] = false;
  return map;
}

export function nextStage(casePackId: string, stage: CaseStage): CaseStage | null {
  const cfg = getCasePackConfig(casePackId);
  if (!cfg) return null;
  const idx = cfg.stages.findIndex((s) => s.id === stage);
  if (idx < 0 || idx === cfg.stages.length - 1) return null;
  return cfg.stages[idx + 1].id;
}

export function isCaseStage(v: string): v is CaseStage {
  return (
    v === "intake" ||
    v === "docs_collect" ||
    v === "docs_review" ||
    v === "draft_filing" ||
    v === "filing_submitted" ||
    v === "completed"
  );
}

export function stageToCaseStatus(stage: CaseStage): CaseStatus {
  switch (stage) {
    case "intake":
      return "new";
    case "docs_collect":
      return "waiting_user";
    case "docs_review":
    case "draft_filing":
    case "filing_submitted":
      return "waiting_partner";
    case "completed":
      return "completed";
    default:
      return "in_progress";
  }
}

export async function requiredSlotsForStage(
  adminApp: typeof admin,
  params: { caseId: string; casePackId: string; stage: CaseStage }
): Promise<DocumentSlotId[]> {
  const cfg = getCasePackConfig(params.casePackId);
  if (!cfg) return [];
  const base = (cfg.requiredSlotsByStage?.[params.stage] ?? []) as DocumentSlotId[];
  const set = new Set<DocumentSlotId>(base);

  // corp_officer_change_v1: draft_filing 단계는 케이스 내용에 따라 추가 서류가 필요하다.
  if (params.casePackId === "corp_officer_change_v1" && params.stage === "draft_filing") {
    // 생성 템플릿(초안) + 서명본을 함께 요구(실무)
    set.add("slot_registration_application");
    set.add("slot_registration_application_signed");
    const fSnap = await officerChangeFormRef(adminApp, params.caseId).get();
    const officers = fSnap.exists ? ((fSnap.data() as any).officers ?? []) : [];
    const hasAppoint = Array.isArray(officers) && officers.some((o: any) => ["appoint", "reappoint"].includes(String(o?.changeType)));
    const hasResign = Array.isArray(officers) && officers.some((o: any) => String(o?.changeType) === "resign");
    const hasRepChange =
      Array.isArray(officers) &&
      officers.some((o: any) => (o?.isRepresentative === true || String(o?.roleKo ?? "").includes("대표")) && ["appoint", "reappoint", "resign"].includes(String(o?.changeType)));
    // 의사록/위임장도 서명본 요구
    set.add("slot_minutes_signed");
    set.add("slot_power_of_attorney_signed");
    if (hasAppoint) {
      set.add("slot_acceptance_letter");
      set.add("slot_acceptance_letter_signed");
    }
    if (hasResign) {
      set.add("slot_resignation_letter");
      set.add("slot_resignation_letter_signed");
    }
    if (hasRepChange) set.add("slot_representative_change_statement");
  }

  return Array.from(set);
}

// 현재 stage를 "완료"했는지(=다음 단계로 갈 수 있는지) 판단
export async function validateStagePrerequisites(adminApp: typeof admin, params: { caseId: string; casePackId: string; stage: CaseStage }) {
  const cfg = getCasePackConfig(params.casePackId);
  if (!cfg) return { ok: false as const, reasonKo: "알 수 없는 casePackId 입니다." };

  // 1) 현재 stage에서 요구되는 docs가 OK인지
  const requiredSlots = await requiredSlotsForStage(adminApp, { caseId: params.caseId, casePackId: params.casePackId, stage: params.stage });
  if (requiredSlots.length > 0) {
    const snap = await adminApp.firestore().collection(`cases/${params.caseId}/documents`).get();
    const docs = snap.docs.map((d) => d.data() as any);
    const okSlots = new Set(docs.filter((d) => d.status === "ok").map((d) => String(d.slotId)));
    const missing = requiredSlots.filter((s) => !okSlots.has(s));
    if (missing.length > 0) {
      return { ok: false as const, reasonKo: `필수 서류가 부족합니다: ${missing.join(", ")}`, details: { missingSlots: missing } };
    }
  }

  // 2) 현재 stage의 체크리스트(필수 항목)가 모두 완료됐는지
  const wfSnap = await workflowRef(adminApp, params.caseId).get();
  const wf = wfSnap.exists ? (wfSnap.data() as any) : null;
  if (!wf) return { ok: false as const, reasonKo: "워크플로우가 없습니다." };
  if (String(wf.stage || "") !== params.stage) {
    // 안전: 다른 stage에 대한 완료 여부를 묻는 경우(클라 오작동) 방지
    return { ok: false as const, reasonKo: "현재 단계가 아니어서 완료 여부를 판단할 수 없습니다." };
  }
  const checklist = (wf?.checklist ?? {}) as Record<string, boolean>;
  const items = cfg.checklistByStage?.[params.stage] ?? [];
  const undone = items.filter((it) => it.required && !checklist[it.id]);
  if (undone.length > 0) {
    return { ok: false as const, reasonKo: `체크리스트가 미완료입니다: ${undone.map((u) => u.titleKo).join(", ")}`, details: { undone: undone.map((u) => u.id) } };
  }

  // 3) filing_submitted 단계는 접수 정보가 반드시 있어야 완료 처리 가능
  if (params.stage === "filing_submitted") {
    const f = await filingRef(adminApp, params.caseId).get();
    if (!f.exists) {
      return { ok: false as const, reasonKo: "접수 정보가 입력되지 않았습니다.", details: { missing: "filing_info" } };
    }
    const data = f.data() as any;
    if (!data.receiptNo || !data.submittedDate || !data.jurisdictionKo) {
      return { ok: false as const, reasonKo: "접수 정보(접수번호/접수일/관할)가 부족합니다.", details: { missing: "filing_fields" } };
    }
  }

  return { ok: true as const };
}
