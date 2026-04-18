"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAllowedSettlementTransition = isAllowedSettlementTransition;
function isAllowedSettlementTransition(from, to) {
    const allowed = {
        created: ["paid", "failed", "cancelled"],
        paid: [],
        failed: ["paid", "cancelled"],
        cancelled: []
    };
    return (allowed[from] ?? []).includes(to);
}
//# sourceMappingURL=settlement_status.js.map