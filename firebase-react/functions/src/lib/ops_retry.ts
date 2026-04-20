import * as admin from "firebase-admin";
import { categorizeError } from "./ops_audit";

export interface OpsRetryJob {
  gateKey?: string;
  action: string;
  payload: any;
  status: "queued" | "running" | "success" | "failed" | "dead";
  attempts: number;
  maxAttempts: number;
  nextRunAt: admin.firestore.Timestamp;
  lastError?: {
    code?: string;
    message?: string;
  };
  sourceEventId?: string;
  correlationId?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

const RETRYABLE_ACTIONS = [
  "monthly.generate",
  "project.discover",
  "project.resolve",
  "project.add",
  "workflow.dispatch",
  "issue.create" // 조건부 retryable (여기서는 일단 큐에 넣고 워커에서 처리)
];

export function isRetryableAction(action: string): boolean {
  return RETRYABLE_ACTIONS.includes(action);
}

export async function enqueueRetryJob(
  adminApp: typeof admin,
  eventId: string,
  event: any
): Promise<{ jobId: string; status: string }> {
  if (!isRetryableAction(event.action)) {
    throw new Error(`Action '${event.action}' is not retryable.`);
  }

  // 조건부 Retry: issue.create나 기타 action에서 error category 기반으로 판단
  if (event.error && event.error.message) {
    const categoryInfo = categorizeError(event.error.message);
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
    correlationId: event.correlationId || event.requestId || `corr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    createdAt: now,
    updatedAt: now
  });

  return { jobId: jobRef.id, status: "queued" };
}
