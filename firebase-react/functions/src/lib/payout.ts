import crypto from "node:crypto";

export type PayoutAttemptStatus = "processing" | "succeeded" | "failed";

export type ExecutePayoutInput = {
  settlementId: string;
  partnerId: string;
  amount: { amount: number; currency: string };
};

export type ExecutePayoutResult =
  | { ok: true; provider: "fake"; providerRef: string }
  | { ok: false; provider: "fake"; error: string };

/**
 * 지급 실행 추상화(v1: fake provider)
 *
 * 운영에서 은행/지급 API를 붙일 때 이 함수만 교체하면 된다.
 *
 * 동작:
 * - PAYOUT_FAKE_FAIL=1이면 실패
 * - 그 외에는 성공 처리 + providerRef 생성
 */
export async function executePayout(input: ExecutePayoutInput): Promise<ExecutePayoutResult> {
  if (process.env.PAYOUT_FAKE_FAIL === "1") {
    return { ok: false, provider: "fake", error: "PAYOUT_FAKE_FAIL=1" };
  }
  const providerRef = `fake_${input.settlementId}_${crypto.randomUUID()}`;
  return { ok: true, provider: "fake", providerRef };
}

