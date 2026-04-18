import type * as admin from "firebase-admin";

export type FilingInfo = {
  caseId: string;
  partnerId: string;
  receiptNo: string;
  jurisdictionKo: string;
  submittedDate: string; // YYYY-MM-DD
  memoKo: string | null;
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
};

export function filingRef(adminApp: typeof admin, caseId: string) {
  return adminApp.firestore().doc(`cases/${caseId}/filing/main`);
}

export function validateSubmittedDate(s: string) {
  // YYYY-MM-DD 간단 검증
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

