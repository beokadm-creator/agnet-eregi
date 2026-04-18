"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalRef = approvalRef;
exports.createApproval = createApproval;
exports.decideApproval = decideApproval;
function approvalRef(adminApp, approvalId) {
    return adminApp.firestore().doc(`approvals/${approvalId}`);
}
async function createApproval(adminApp, approvalId, input) {
    const now = adminApp.firestore.FieldValue.serverTimestamp();
    await approvalRef(adminApp, approvalId).set({ ...input, createdAt: now });
}
async function decideApproval(adminApp, approvalId, decision, decidedBy, reasonKo) {
    const now = adminApp.firestore.FieldValue.serverTimestamp();
    const ref = approvalRef(adminApp, approvalId);
    await adminApp.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new Error("NOT_FOUND");
        const a = snap.data();
        if (a.status !== "pending")
            return; // 멱등: 이미 처리됨
        tx.set(ref, {
            status: decision === "approve" ? "approved" : "rejected",
            decidedBy,
            decidedAt: now,
            decisionReasonKo: reasonKo ?? null
        }, { merge: true });
    });
}
//# sourceMappingURL=approvals.js.map