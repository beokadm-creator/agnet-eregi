"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executePayout = executePayout;
const node_crypto_1 = __importDefault(require("node:crypto"));
/**
 * 지급 실행 추상화(v1: fake provider)
 *
 * 운영에서 은행/지급 API를 붙일 때 이 함수만 교체하면 된다.
 *
 * 동작:
 * - PAYOUT_FAKE_FAIL=1이면 실패
 * - 그 외에는 성공 처리 + providerRef 생성
 */
async function executePayout(input) {
    if (process.env.PAYOUT_FAKE_FAIL === "1") {
        return { ok: false, provider: "fake", error: "PAYOUT_FAKE_FAIL=1" };
    }
    const providerRef = `fake_${input.settlementId}_${node_crypto_1.default.randomUUID()}`;
    return { ok: true, provider: "fake", providerRef };
}
//# sourceMappingURL=payout.js.map