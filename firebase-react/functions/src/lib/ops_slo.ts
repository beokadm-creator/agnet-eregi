import * as admin from "firebase-admin";

export interface OpsSloConfig {
  gateKey: string;
  targetPercentage: number; // 예: 99.5
  budgetDays: number; // 기준 기간 (보통 7 또는 30)
  updatedAt: admin.firestore.Timestamp;
  updatedBy: string;
}

export const defaultSloConfig: OpsSloConfig = {
  gateKey: "default",
  targetPercentage: 99.0,
  budgetDays: 7,
  updatedAt: admin.firestore.Timestamp.now(),
  updatedBy: "system"
};
