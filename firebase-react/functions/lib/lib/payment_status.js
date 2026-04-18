"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAllowedPaymentTransition = isAllowedPaymentTransition;
exports.statusFromPgEvent = statusFromPgEvent;
function isAllowedPaymentTransition(from, to) {
    const allowed = {
        created: ["authorized", "failed", "cancelled"],
        authorized: ["captured", "failed", "cancelled"],
        captured: [],
        failed: [],
        cancelled: []
    };
    return (allowed[from] ?? []).includes(to);
}
function statusFromPgEvent(type) {
    if (type === "PAYMENT_AUTHORIZED")
        return "authorized";
    if (type === "PAYMENT_CAPTURED")
        return "captured";
    if (type === "PAYMENT_FAILED")
        return "failed";
    if (type === "PAYMENT_CANCELLED")
        return "cancelled";
    return null;
}
//# sourceMappingURL=payment_status.js.map