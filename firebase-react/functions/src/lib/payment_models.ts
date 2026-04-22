import * as admin from "firebase-admin";

export type PaymentStatus =
  | "initiated"
  | "confirm"
  | "captured"
  | "failed"
  | "partially_refunded"
  | "refunded";

export interface Payment {
  id?: string;
  userId: string;
  caseId?: string;
  submissionId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider?: "stripe" | "tosspayments" | "mock";
  /**
   * 결제 프로바이더의 참조 키
   * - stripe: PaymentIntent ID (또는 Checkout Session ID)
   * - tosspayments: paymentKey
   */
  providerRef?: string;
  /** Stripe 전용 */
  checkoutUrl?: string;
  /** 부분 환불/취소 누적 금액 (없으면 0으로 간주) */
  refundedAmount?: number;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export type RefundStatus = "requested" | "approved" | "executed" | "rejected";

export interface Refund {
  id?: string;
  caseId: string;
  paymentId: string;
  partnerId: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  requestedBy: string;
  approvedBy?: string;
  executedBy?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}
