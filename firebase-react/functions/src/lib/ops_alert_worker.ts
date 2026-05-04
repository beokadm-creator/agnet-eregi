import * as admin from "firebase-admin";
import { notifyOpsAlert, OpsAlertParams } from "./ops_alert";

function calculateNextRunAt(attempts: number): Date {
  const now = new Date();
  let addMinutes = 1;
  if (attempts === 1) addMinutes = 5;
  else if (attempts === 2) addMinutes = 15;
  else if (attempts >= 3) addMinutes = 60;
  
  now.setMinutes(now.getMinutes() + addMinutes);
  return now;
}

export async function processOpsAlertJobs(adminApp: typeof admin) {
  const db = adminApp.firestore();
  const now = adminApp.firestore.Timestamp.now();

  const snap = await db.collection("ops_alert_jobs")
    .where("status", "==", "pending")
    .where("nextRunAt", "<=", now)
    .limit(10)
    .get();

  if (snap.empty) return;

  for (const doc of snap.docs) {
    const job = doc.data();
    const jobId = doc.id;

    try {
      await db.runTransaction(async (t) => {
        const freshSnap = await t.get(doc.ref);
        if (freshSnap.data()?.status !== "pending") {
          throw new Error("Job is no longer pending");
        }
        t.update(doc.ref, { status: "running", updatedAt: adminApp.firestore.FieldValue.serverTimestamp() });
      });
    } catch (e) {
      continue;
    }

    const payload = job.payload as OpsAlertParams;
    let success = false;
    let errorMessage = "";
    
    try {
      const result = await notifyOpsAlert({
        ...payload,
        force: true // Force to bypass cooldown logic when retrying
      });
      if (result.success) {
        success = true;
      } else {
        errorMessage = result.reason || "Unknown error";
      }
    } catch (e: any) {
      errorMessage = e.message || "Unknown error";
    }

    if (success) {
      await doc.ref.update({
        status: "done",
        updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
      });
    } else {
      const newAttempts = (job.attempts || 0) + 1;
      const maxAttempts = job.maxAttempts || 5;
      
      if (newAttempts >= maxAttempts) {
        await doc.ref.update({
          status: "dead",
          attempts: newAttempts,
          lastError: { message: errorMessage },
          updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
        });

        await db.collection("ops_audit_events").doc().set({
          gateKey: job.gateKey,
          action: "ops_alert.dead",
          status: "fail",
          actorUid: "system",
          requestId: payload.requestId || "unknown",
          summary: `Alert permanently failed after ${newAttempts} attempts: ${payload.summary}`,
          target: { jobId, error: errorMessage },
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        const nextRun = calculateNextRunAt(newAttempts);
        await doc.ref.update({
          status: "pending",
          attempts: newAttempts,
          nextRunAt: admin.firestore.Timestamp.fromDate(nextRun),
          lastError: { message: errorMessage },
          updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  }
}
