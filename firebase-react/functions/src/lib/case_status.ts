export type CaseStatus =
  | "new"
  | "in_progress"
  | "waiting_user"
  | "waiting_partner"
  | "completed"
  | "cancelled"
  | "escalated_to_ops";

export function isAllowedTransition(from: CaseStatus, to: CaseStatus) {
  const allowed: Record<CaseStatus, CaseStatus[]> = {
    new: ["in_progress", "cancelled", "escalated_to_ops"],
    in_progress: ["waiting_user", "waiting_partner", "completed", "cancelled", "escalated_to_ops"],
    waiting_user: ["waiting_partner", "in_progress", "cancelled", "escalated_to_ops"],
    // 실무: 파트너 작업/제출 완료 시 waiting_partner에서도 완료로 전이 가능
    waiting_partner: ["waiting_user", "in_progress", "completed", "cancelled", "escalated_to_ops"],
    completed: [],
    cancelled: [],
    escalated_to_ops: ["in_progress", "cancelled"]
  };
  return (allowed[from] ?? []).includes(to);
}

export function isTerminal(status: CaseStatus) {
  return status === "completed" || status === "cancelled";
}

export function decideCaseStatusByDocumentReview(from: CaseStatus, decision: "ok" | "needs_fix"): CaseStatus | null {
  if (isTerminal(from)) return null;
  if (decision === "needs_fix") return "waiting_user";
  if (decision === "ok" && from === "waiting_user") return "waiting_partner";
  return null;
}

export function decideCaseStatusByDocumentComplete(from: CaseStatus): CaseStatus | null {
  if (isTerminal(from)) return null;
  if (from === "waiting_user") return "waiting_partner";
  return null;
}
