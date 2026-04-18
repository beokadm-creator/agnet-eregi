export type SettlementStatus = "created" | "paid" | "failed" | "cancelled";

export function isAllowedSettlementTransition(from: SettlementStatus, to: SettlementStatus) {
  const allowed: Record<SettlementStatus, SettlementStatus[]> = {
    created: ["paid", "failed", "cancelled"],
    paid: [],
    failed: ["paid", "cancelled"],
    cancelled: []
  };
  return (allowed[from] ?? []).includes(to);
}

