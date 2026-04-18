import type * as admin from "firebase-admin";
import crypto from "node:crypto";

export type TaskStatus = "open" | "done";

export type CaseTask = {
  caseId: string;
  partnerId: string;
  taskId: string;
  titleKo: string;
  type: string;
  status: TaskStatus;
  dueAt: admin.firestore.FieldValue | null;
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
};

export function taskRef(adminApp: typeof admin, caseId: string, taskId: string) {
  return adminApp.firestore().doc(`cases/${caseId}/tasks/${taskId}`);
}

export async function createTask(adminApp: typeof admin, params: { caseId: string; partnerId: string; titleKo: string; type: string }) {
  const taskId = crypto.randomUUID();
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
  } satisfies CaseTask);
  return { taskId };
}

export async function ensureTask(adminApp: typeof admin, params: { caseId: string; taskId: string; partnerId: string; titleKo: string; type: string }) {
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
    } satisfies CaseTask);
  } else {
    await ref.set(
      {
        titleKo: params.titleKo,
        type: params.type,
        partnerId: params.partnerId,
        status: "open",
        updatedAt: now
      },
      { merge: true }
    );
  }
  return { taskId: params.taskId };
}

export async function setTaskStatus(adminApp: typeof admin, params: { caseId: string; taskId: string; status: TaskStatus }) {
  const now = adminApp.firestore.FieldValue.serverTimestamp();
  const ref = taskRef(adminApp, params.caseId, params.taskId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const };
  await ref.set({ status: params.status, doneAt: params.status === "done" ? now : null, updatedAt: now }, { merge: true });
  return { ok: true as const };
}
