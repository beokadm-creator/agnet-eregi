"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRetryableAction = isRetryableAction;
exports.enqueueRetryJob = enqueueRetryJob;
const ops_audit_1 = require("./ops_audit");
const RETRYABLE_ACTIONS = [
    "monthly.generate",
    "project.discover",
    "project.resolve",
    "project.add",
    "workflow.dispatch",
    "issue.create" // 조건부 retryable (여기서는 일단 큐에 넣고 워커에서 처리)
];
function isRetryableAction(action) {
    return RETRYABLE_ACTIONS.includes(action);
}
async function enqueueRetryJob(adminApp, eventId, event) {
    if (!isRetryableAction(event.action)) {
        throw new Error(`Action '${event.action}' is not retryable.`);
    }
    // 조건부 Retry: issue.create나 기타 action에서 error category 기반으로 판단
    if (event.error && event.error.message) {
        const categoryInfo = (0, ops_audit_1.categorizeError)(event.error.message);
        if (!categoryInfo.retryable) {
            throw new Error(`Error category '${categoryInfo.category}' is marked as non-retryable.`);
        }
    }
    const db = adminApp.firestore();
    // 이미 큐에 있거나 실행중인지 확인 (중복 방지)
    const snap = await db.collection("ops_retry_jobs")
        .where("sourceEventId", "==", eventId)
        .where("status", "in", ["queued", "running"])
        .limit(1)
        .get();
    if (!snap.empty) {
        const doc = snap.docs[0];
        return { jobId: doc.id, status: doc.data().status };
    }
    const now = adminApp.firestore.FieldValue.serverTimestamp();
    // payload 구성: event의 target, gateKey 등 활용
    const payload = {
        gateKey: event.gateKey,
        target: event.target || {}
    };
    const jobRef = db.collection("ops_retry_jobs").doc();
    await jobRef.set({
        gateKey: event.gateKey,
        action: event.action,
        payload,
        status: "queued",
        attempts: 0,
        maxAttempts: 4,
        nextRunAt: now,
        sourceEventId: eventId,
        createdAt: now,
        updatedAt: now
    });
    return { jobId: jobRef.id, status: "queued" };
}
//# sourceMappingURL=ops_retry.js.map