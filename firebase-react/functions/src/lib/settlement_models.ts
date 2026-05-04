import * as admin from "firebase-admin";

export interface AdCampaign {
  id: string;
  partnerId: string;
  status: "active" | "paused" | "budget_exhausted";
  type: "CPC" | "CPM";
  bidAmount: number;
  dailyBudget: number;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface AdEvent {
  id: string;
  partnerId: string;
  campaignId: string;
  eventType: "impression" | "click";
  source: string;
  ipHash: string; // for simple abuse prevention
  userId?: string;
  createdAt: admin.firestore.Timestamp;
}

export interface AdBilling {
  id: string;
  partnerId: string;
  targetDate: string; // YYYY-MM-DD
  validImpressions: number;
  validClicks: number;
  billingAmount: number;
  isSettled: boolean;
  createdAt: admin.firestore.Timestamp;
}

export interface Settlement {
  id: string;
  partnerId: string;
  periodStart: admin.firestore.Timestamp;
  periodEnd: admin.firestore.Timestamp;
  totalPaymentAmount: number;
  totalRefundAmount: number;
  platformFee: number;
  adDeductionAmount: number;
  netSettlementAmount: number;
  status: "calculated" | "approved" | "transferred" | "pay_failed";
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface SettlementItem {
  id: string;
  settlementId: string;
  type: "payment" | "refund" | "ad_fee";
  referenceId: string;
  amount: number;
}
