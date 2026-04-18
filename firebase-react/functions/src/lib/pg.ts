import crypto from "node:crypto";

/**
 * PG 웹훅 서명 검증(HMAC-SHA256 기본형)
 * - 서명 헤더: X-PG-Signature (hex)
 * - 서명 키: PG_WEBHOOK_SECRET
 *
 * 실제 PG 벤더가 제공하는 서명 규격이 다르면 이 모듈만 교체하면 된다.
 */
export function verifyWebhookSignature(params: {
  rawBody: Buffer;
  signatureHeader: string | null | undefined;
  secret: string | null | undefined;
}) {
  const { rawBody, signatureHeader, secret } = params;
  if (!secret) return { ok: false, reason: "missing_secret" as const };
  if (!signatureHeader) return { ok: false, reason: "missing_signature" as const };

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signatureHeader), "utf8");
  if (a.length !== b.length) return { ok: false, reason: "mismatch" as const };
  const ok = crypto.timingSafeEqual(a, b);
  return ok ? { ok: true as const } : { ok: false as const, reason: "mismatch" as const };
}

