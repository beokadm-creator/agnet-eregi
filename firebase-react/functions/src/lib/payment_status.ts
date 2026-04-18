export type PaymentStatus = "created" | "authorized" | "captured" | "failed" | "cancelled";

export function isAllowedPaymentTransition(from: PaymentStatus, to: PaymentStatus) {
  const allowed: Record<PaymentStatus, PaymentStatus[]> = {
    created: ["authorized", "failed", "cancelled"],
    authorized: ["captured", "failed", "cancelled"],
    captured: [],
    failed: [],
    cancelled: []
  };
  return (allowed[from] ?? []).includes(to);
}

export function statusFromPgEvent(type: string): PaymentStatus | null {
  if (type === "PAYMENT_AUTHORIZED") return "authorized";
  if (type === "PAYMENT_CAPTURED") return "captured";
  if (type === "PAYMENT_FAILED") return "failed";
  if (type === "PAYMENT_CANCELLED") return "cancelled";
  return null;
}

