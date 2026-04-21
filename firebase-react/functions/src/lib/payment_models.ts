import * as admin from "firebase-admin";

export type PaymentStatus = "initiated" | "confirm" | "captured" | "failed";

export interface Payment {
  id?: string;
  userId: string;
  caseId?: string;
  submissionId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
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
