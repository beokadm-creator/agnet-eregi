import * as admin from "firebase-admin";

import { TossPaymentsSettings } from "./ops_settings";

const TOSS_API_BASE = "https://api.tosspayments.com";

const toBasicAuthHeader = (secretKey: string): string => {
  // 토스페이먼츠는 "시크릿키:" 를 base64 인코딩한 값을 Basic 인증에 사용
  const raw = `${secretKey}:`;
  const encoded = Buffer.from(raw).toString("base64");
  return `Basic ${encoded}`;
};

export const getTossPaymentsSettings = async (): Promise<TossPaymentsSettings | null> => {
  const snap = await admin.firestore().collection("ops_settings").doc("tosspayments").get();
  if (!snap.exists) return null;
  return snap.data() as TossPaymentsSettings;
};

export const tossConfirmPayment = async (params: {
  secretKey: string;
  paymentKey: string;
  orderId: string;
  amount: number;
  idempotencyKey: string;
}) => {
  const res = await fetch(`${TOSS_API_BASE}/v1/payments/confirm`, {
    method: "POST",
    headers: {
      Authorization: toBasicAuthHeader(params.secretKey),
      "Content-Type": "application/json",
      "Idempotency-Key": params.idempotencyKey
    },
    body: JSON.stringify({
      paymentKey: params.paymentKey,
      orderId: params.orderId,
      amount: params.amount
    })
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Toss confirm failed (${res.status}): ${text}`);
  }
  return JSON.parse(text);
};

export const tossGetPaymentByPaymentKey = async (params: { secretKey: string; paymentKey: string }) => {
  const res = await fetch(`${TOSS_API_BASE}/v1/payments/${encodeURIComponent(params.paymentKey)}`, {
    method: "GET",
    headers: {
      Authorization: toBasicAuthHeader(params.secretKey)
    }
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Toss get payment failed (${res.status}): ${text}`);
  }
  return JSON.parse(text);
};

export const tossCancelPayment = async (params: {
  secretKey: string;
  paymentKey: string;
  cancelReason: string;
  cancelAmount?: number;
  refundReceiveAccount?: {
    bankCode: string;
    accountNumber: string;
    holderName: string;
  };
  idempotencyKey: string;
}) => {
  const body: any = {
    cancelReason: params.cancelReason
  };
  if (typeof params.cancelAmount === "number") {
    body.cancelAmount = params.cancelAmount;
  }
  if (params.refundReceiveAccount) {
    body.refundReceiveAccount = params.refundReceiveAccount;
  }

  const res = await fetch(`${TOSS_API_BASE}/v1/payments/${encodeURIComponent(params.paymentKey)}/cancel`, {
    method: "POST",
    headers: {
      Authorization: toBasicAuthHeader(params.secretKey),
      "Content-Type": "application/json",
      "Idempotency-Key": params.idempotencyKey
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Toss cancel failed (${res.status}): ${text}`);
  }
  return JSON.parse(text);
};

