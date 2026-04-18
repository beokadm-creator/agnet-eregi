import type * as admin from "firebase-admin";

export type ApprovalGate = "refund_approve" | "quote_finalize" | "pii_view" | "partner_onboarding";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired";

export type ApprovalTarget =
  | { type: "refund"; caseId: string; refundId: string }
  | { type: "quote"; caseId: string; quoteId: string }
  | { type: "partner"; partnerId: string }
  | { type: "other"; ref: string };

export type ApprovalDoc = {
  gate: ApprovalGate;
  status: ApprovalStatus;
  target: ApprovalTarget;
  requiredRole: "ops_approver";
  summaryKo: string;
  payloadHash: string | null;
  createdBy: { uid: string; role?: string };
  decidedBy?: { uid: string; role?: string };
  createdAt: admin.firestore.FieldValue;
  decidedAt?: admin.firestore.FieldValue;
};

export function approvalRef(adminApp: typeof admin, approvalId: string) {
  return adminApp.firestore().doc(`approvals/${approvalId}`);
}

export async function createApproval(
  adminApp: typeof admin,
  approvalId: string,
  input: Omit<ApprovalDoc, "createdAt">
) {
  const now = adminApp.firestore.FieldValue.serverTimestamp();
  await approvalRef(adminApp, approvalId).set({ ...input, createdAt: now });
}

export async function decideApproval(
  adminApp: typeof admin,
  approvalId: string,
  decision: "approve" | "reject",
  decidedBy: { uid: string; role?: string },
  reasonKo?: string | null
) {
  const now = adminApp.firestore.FieldValue.serverTimestamp();
  const ref = approvalRef(adminApp, approvalId);
  await adminApp.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("NOT_FOUND");
    const a = snap.data() as any;
    if (a.status !== "pending") return; // 멱등: 이미 처리됨
    tx.set(
      ref,
      {
        status: decision === "approve" ? "approved" : "rejected",
        decidedBy,
        decidedAt: now,
        decisionReasonKo: reasonKo ?? null
      },
      { merge: true }
    );
  });
}

