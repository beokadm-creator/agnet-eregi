"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhookSignature = verifyWebhookSignature;
const node_crypto_1 = __importDefault(require("node:crypto"));
/**
 * PG 웹훅 서명 검증(HMAC-SHA256 기본형)
 * - 서명 헤더: X-PG-Signature (hex)
 * - 서명 키: PG_WEBHOOK_SECRET
 *
 * 실제 PG 벤더가 제공하는 서명 규격이 다르면 이 모듈만 교체하면 된다.
 */
function verifyWebhookSignature(params) {
    const { rawBody, signatureHeader, secret } = params;
    if (!secret)
        return { ok: false, reason: "missing_secret" };
    if (!signatureHeader)
        return { ok: false, reason: "missing_signature" };
    const expected = node_crypto_1.default.createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(String(signatureHeader), "utf8");
    if (a.length !== b.length)
        return { ok: false, reason: "mismatch" };
    const ok = node_crypto_1.default.timingSafeEqual(a, b);
    return ok ? { ok: true } : { ok: false, reason: "mismatch" };
}
//# sourceMappingURL=pg.js.map