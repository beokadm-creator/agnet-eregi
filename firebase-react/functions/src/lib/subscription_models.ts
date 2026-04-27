import * as admin from "firebase-admin";

export type PlanInterval = "month" | "year";

// 1) 시스템에 등록된 구독 플랜 (예: Free, Pro, Enterprise)
export interface SubscriptionPlan {
  id?: string;
  name: string;
  price: number;
  currency: string; // 예: "KRW", "USD"
  interval: PlanInterval;
  features: string[]; // 제공되는 기능 목록
  active: boolean; // 현재 가입 가능한 플랜인지 여부
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "incomplete" | "trialing";

// 2) 특정 파트너의 현재 구독 상태 정보
export interface PartnerSubscription {
  id?: string;
  partnerId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: admin.firestore.Timestamp;
  currentPeriodEnd: admin.firestore.Timestamp;
  cancelAtPeriodEnd: boolean; // 이번 주기 종료 후 취소 여부
  trialEnd?: admin.firestore.Timestamp; // 무료 체험 기간이 있을 경우
  paymentMethodId?: string; // 등록된 결제 수단 참조 ID
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export type BillingHistoryStatus = "paid" | "open" | "failed" | "void";

// 3) 파트너의 결제 및 청구 내역 (Billing History)
export interface BillingHistory {
  id?: string;
  partnerId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: BillingHistoryStatus;
  invoiceUrl?: string; // PG사 혹은 자체 생성 영수증 링크
  paidAt?: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
}
