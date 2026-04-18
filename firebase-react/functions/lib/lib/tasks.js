"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskRef = taskRef;
exports.createTask = createTask;
exports.ensureTask = ensureTask;
exports.setTaskStatus = setTaskStatus;
const node_crypto_1 = __importDefault(require("node:crypto"));
function taskRef(adminApp, caseId, taskId) {
    return adminApp.firestore().doc(`cases/${caseId}/tasks/${taskId}`);
}
async function createTask(adminApp, params) {
    const taskId = node_crypto_1.default.randomUUID();
    const now = adminApp.firestore.FieldValue.serverTimestamp();
    await taskRef(adminApp, params.caseId, taskId).set({
        caseId: params.caseId,
        partnerId: params.partnerId,
        taskId,
        titleKo: params.titleKo,
        type: params.type,
        status: "open",
        dueAt: null,
        createdAt: now,
        updatedAt: now
    });
    return { taskId };
}
async function ensureTask(adminApp, params) {
    const now = adminApp.firestore.FieldValue.serverTimestamp();
    const ref = taskRef(adminApp, params.caseId, params.taskId);
    const snap = await ref.get();
    if (!snap.exists) {
        await ref.set({
            caseId: params.caseId,
            partnerId: params.partnerId,
            taskId: params.taskId,
            titleKo: params.titleKo,
            type: params.type,
            status: "open",
            dueAt: null,
            createdAt: now,
            updatedAt: now
        });
    }
    else {
        await ref.set({
            titleKo: params.titleKo,
            type: params.type,
            partnerId: params.partnerId,
            status: "open",
            updatedAt: now
        }, { merge: true });
    }
    return { taskId: params.taskId };
}
async function setTaskStatus(adminApp, params) {
    const now = adminApp.firestore.FieldValue.serverTimestamp();
    const ref = taskRef(adminApp, params.caseId, params.taskId);
    const snap = await ref.get();
    if (!snap.exists)
        return { ok: false };
    await ref.set({ status: params.status, doneAt: params.status === "done" ? now : null, updatedAt: now }, { merge: true });
    return { ok: true };
}
//# sourceMappingURL=tasks.js.map