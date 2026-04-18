export type DocumentSlotId =
  | "slot_id_card"
  | "slot_corp_registry"
  | "slot_minutes"
  | "slot_minutes_signed"
  | "slot_power_of_attorney"
  | "slot_power_of_attorney_signed"
  | "slot_seal_certificate"
  | "slot_filing_receipt"
  | "slot_registration_application"
  | "slot_registration_application_signed"
  | "slot_acceptance_letter"
  | "slot_acceptance_letter_signed"
  | "slot_resignation_letter"
  | "slot_resignation_letter_signed"
  | "slot_representative_change_statement";

export type CaseStage =
  | "intake"
  | "docs_collect"
  | "docs_review"
  | "draft_filing"
  | "filing_submitted"
  | "completed";

export type ChecklistItem = {
  id: string;
  titleKo: string;
  required: boolean;
};

export type ReviewIssue = {
  code: string;
  titleKo: string;
  guidanceKo: string;
};

export type CasePackConfig = {
  id: string;
  nameKo: string;
  stages: { id: CaseStage; titleKo: string }[];
  requiredSlotsByStage: Partial<Record<CaseStage, DocumentSlotId[]>>;
  checklistByStage: Partial<Record<CaseStage, ChecklistItem[]>>;
  slotTitlesKo: Partial<Record<DocumentSlotId, string>>;
  reviewIssuesBySlot: Partial<Record<DocumentSlotId, ReviewIssue[]>>;
};

export function getSlotTitleKo(casePackId: string, slotId: string) {
  const cfg = getCasePackConfig(casePackId);
  if (!cfg) return null;
  const key = slotId as DocumentSlotId;
  return cfg.slotTitlesKo?.[key] ?? null;
}

export function isKnownSlot(casePackId: string, slotId: string) {
  return getSlotTitleKo(casePackId, slotId) != null;
}

export function getCasePackConfig(casePackId: string): CasePackConfig | null {
  // v1: corp_officer_change_v1 (임원 변경 등기)
  if (casePackId === "corp_officer_change_v1") {
    return {
      id: "corp_officer_change_v1",
      nameKo: "임원 변경 등기",
      stages: [
        { id: "intake", titleKo: "접수" },
        { id: "docs_collect", titleKo: "서류 수집" },
        { id: "docs_review", titleKo: "서류 검토" },
        { id: "draft_filing", titleKo: "등기 서류 작성" },
        { id: "filing_submitted", titleKo: "등기 제출" },
        { id: "completed", titleKo: "완료" }
      ],
      requiredSlotsByStage: {
        docs_collect: ["slot_id_card", "slot_corp_registry"],
        docs_review: ["slot_id_card", "slot_corp_registry"],
        draft_filing: ["slot_minutes", "slot_power_of_attorney", "slot_seal_certificate"],
        filing_submitted: ["slot_filing_receipt"]
      },
      checklistByStage: {
        docs_review: [
          { id: "chk_id_card_legible", titleKo: "신분증 식별 가능", required: true },
          { id: "chk_registry_recent", titleKo: "법인등기부 최신본 확인", required: true }
        ],
        draft_filing: [
          { id: "chk_minutes_correct", titleKo: "의사록/결의서 내용 검토", required: true },
          { id: "chk_poa_signed", titleKo: "위임장 서명/날인 확인", required: true }
        ],
        filing_submitted: [{ id: "chk_submission_receipt", titleKo: "접수증 업로드/기록", required: true }]
      },
      slotTitlesKo: {
        slot_id_card: "신분증",
        slot_corp_registry: "법인등기부등본",
        slot_minutes: "의사록/결의서",
        slot_minutes_signed: "의사록/결의서(서명본)",
        slot_power_of_attorney: "위임장",
        slot_power_of_attorney_signed: "위임장(서명본)",
        slot_seal_certificate: "인감증명서",
        slot_filing_receipt: "접수증(등기소)",
        slot_registration_application: "등기신청서",
        slot_registration_application_signed: "등기신청서(서명본)",
        slot_acceptance_letter: "취임승낙서",
        slot_acceptance_letter_signed: "취임승낙서(서명본)",
        slot_resignation_letter: "사임서",
        slot_resignation_letter_signed: "사임서(서명본)",
        slot_representative_change_statement: "대표이사 변경 확인서"
      },
      reviewIssuesBySlot: {
        slot_id_card: [
          { code: "ID_LEGIBILITY", titleKo: "식별 불가/흐림", guidanceKo: "빛 반사 없이 글자가 선명하게 나오도록 다시 촬영해 주세요." },
          { code: "ID_EXPIRED", titleKo: "유효기간 만료", guidanceKo: "유효한 신분증으로 다시 제출해 주세요." }
        ],
        slot_corp_registry: [
          { code: "REGISTRY_OUTDATED", titleKo: "최신본 아님", guidanceKo: "발급일이 최근인 등기부등본(최신본)으로 다시 제출해 주세요." },
          { code: "REGISTRY_MISSING_PAGES", titleKo: "페이지 누락", guidanceKo: "전체 페이지가 포함되도록 다시 제출해 주세요." }
        ],
        slot_minutes: [
          { code: "MINUTES_CONTENT_MISMATCH", titleKo: "결의 내용 불일치", guidanceKo: "임원 변경 내용/일자/성명이 정확히 기재되었는지 확인해 주세요." },
          { code: "MINUTES_SIGNATURE_MISSING", titleKo: "서명/날인 누락", guidanceKo: "필요 서명/날인이 모두 포함되도록 다시 작성/제출해 주세요." }
        ],
        slot_power_of_attorney: [
          { code: "POA_SIGNATURE_MISSING", titleKo: "서명/날인 누락", guidanceKo: "위임인 서명/날인이 누락되지 않도록 확인해 주세요." },
          { code: "POA_SCOPE_INSUFFICIENT", titleKo: "위임 범위 불충분", guidanceKo: "임원변경 등기 업무를 포함하도록 위임 범위를 수정해 주세요." }
        ],
        slot_seal_certificate: [
          { code: "SEAL_CERT_OUTDATED", titleKo: "발급일 경과", guidanceKo: "발급일이 최근인 인감증명서를 제출해 주세요." },
          { code: "SEAL_CERT_MISMATCH", titleKo: "인감 불일치", guidanceKo: "제출 서류의 인감과 일치하는 인감증명서를 제출해 주세요." }
        ],
        slot_filing_receipt: [
          { code: "RECEIPT_NOT_LEGIBLE", titleKo: "접수증 식별 불가", guidanceKo: "접수번호/접수일/관할이 확인되도록 선명하게 제출해 주세요." },
          { code: "RECEIPT_MISSING_FIELDS", titleKo: "필수 정보 누락", guidanceKo: "접수번호/접수일/관할 정보가 포함되도록 제출해 주세요." }
        ],
        slot_acceptance_letter: [
          { code: "ACCEPTANCE_SIGNATURE_MISSING", titleKo: "서명/날인 누락", guidanceKo: "취임승낙서에 서명/날인이 포함되도록 제출해 주세요." }
        ],
        slot_resignation_letter: [
          { code: "RESIGNATION_SIGNATURE_MISSING", titleKo: "서명/날인 누락", guidanceKo: "사임서에 서명/날인이 포함되도록 제출해 주세요." }
        ],
        slot_representative_change_statement: [
          { code: "REP_CHANGE_SIGNATURE_MISSING", titleKo: "서명/날인 누락", guidanceKo: "대표이사 변경 확인서에 서명/날인이 포함되도록 제출해 주세요." }
        ],
        // 서명본(스캔/PDF) 공통 이슈 (v1 최소)
        slot_minutes_signed: [
          { code: "SIGNED_NOT_LEGIBLE", titleKo: "식별 불가/흐림", guidanceKo: "서명/날인이 식별 가능하도록 선명하게 제출해 주세요." }
        ],
        slot_power_of_attorney_signed: [
          { code: "SIGNED_NOT_LEGIBLE", titleKo: "식별 불가/흐림", guidanceKo: "서명/날인이 식별 가능하도록 선명하게 제출해 주세요." }
        ],
        slot_registration_application_signed: [
          { code: "SIGNED_NOT_LEGIBLE", titleKo: "식별 불가/흐림", guidanceKo: "서명/날인이 식별 가능하도록 선명하게 제출해 주세요." }
        ],
        slot_acceptance_letter_signed: [
          { code: "SIGNED_NOT_LEGIBLE", titleKo: "식별 불가/흐림", guidanceKo: "서명/날인이 식별 가능하도록 선명하게 제출해 주세요." }
        ],
        slot_resignation_letter_signed: [
          { code: "SIGNED_NOT_LEGIBLE", titleKo: "식별 불가/흐림", guidanceKo: "서명/날인이 식별 가능하도록 선명하게 제출해 주세요." }
        ]
      }
    };
  }
  return null;
}
