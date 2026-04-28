import * as admin from "firebase-admin";
import * as crypto from "crypto";

type UserDeletionStatus = "queued" | "processing" | "done" | "failed";

interface UserDeletionJob {
  userId: string;
  deletedUserId: string;
  status: UserDeletionStatus;
  attempts?: number;
  nextRunAt?: admin.firestore.Timestamp;
  progress?: {
    submissionsUpdated?: number;
    submissionEventsUpdated?: number;
    funnelSessionsDeleted?: number;
    funnelEventsDeleted?: number;
    notificationJobsDeleted?: number;
    pushTokensDeleted?: number;
  };
  lastError?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  finishedAt?: admin.firestore.Timestamp;
}

function deletedUserIdOf(uid: string): string {
  const h = crypto.createHash("sha256").update(uid).digest("hex").slice(0, 16);
  return `deleted_${h}`;
}

async function deleteDocsByIds(db: FirebaseFirestore.Firestore, col: string, ids: string[]) {
  if (ids.length === 0) return;
  const batch = db.batch();
  for (const id of ids) batch.delete(db.collection(col).doc(id));
  await batch.commit();
}

export async function processUserDeletionJobs(adminApp: typeof admin) {
  const db = adminApp.firestore();
  const now = admin.firestore.Timestamp.now();

  const jobSnap = await db.collection("user_deletion_jobs")
    .where("status", "==", "queued")
    .where("nextRunAt", "<=", now)
    .limit(1)
    .get();
  if (jobSnap.empty) return;

  const jobDoc = jobSnap.docs[0];
  const job = jobDoc.data() as UserDeletionJob;
  const uid = job.userId;
  const deletedUserId = job.deletedUserId || deletedUserIdOf(uid);
  const attempts = job.attempts || 0;

  await jobDoc.ref.update({
    status: "processing",
    deletedUserId,
    attempts,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const progress: NonNullable<UserDeletionJob["progress"]> = {
    ...(job.progress || {}),
  };

  try {
    const pushTokenSnap = await db.collection("user_push_tokens").where("userId", "==", uid).limit(200).get();
    await deleteDocsByIds(db, "user_push_tokens", pushTokenSnap.docs.map((d) => d.id));
    progress.pushTokensDeleted = (progress.pushTokensDeleted || 0) + pushTokenSnap.size;

    await db.collection("user_notification_settings").doc(uid).delete().catch(() => {});

    let submissionsUpdated = 0;
    while (submissionsUpdated < 400) {
      const snap = await db.collection("user_submissions").where("userId", "==", uid).limit(200).get();
      if (snap.empty) break;
      const batch = db.batch();
      for (const d of snap.docs) {
        batch.update(d.ref, {
          userId: deletedUserId,
          userDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      submissionsUpdated += snap.size;
      progress.submissionsUpdated = (progress.submissionsUpdated || 0) + snap.size;
      if (snap.size < 200) break;
    }

    let eventsUpdated = 0;
    while (eventsUpdated < 400) {
      const snap = await db.collection("submission_events").where("userId", "==", uid).limit(200).get();
      if (snap.empty) break;
      const batch = db.batch();
      for (const d of snap.docs) {
        batch.update(d.ref, {
          userId: deletedUserId,
        });
      }
      await batch.commit();
      eventsUpdated += snap.size;
      progress.submissionEventsUpdated = (progress.submissionEventsUpdated || 0) + snap.size;
      if (snap.size < 200) break;
    }

    const sessionIds: string[] = [];
    let sessionsDeleted = 0;
    while (sessionsDeleted < 400) {
      const snap = await db.collection("funnel_sessions").where("userId", "==", uid).limit(100).get();
      if (snap.empty) break;
      const batch = db.batch();
      for (const d of snap.docs) {
        sessionIds.push(d.id);
        batch.delete(d.ref);
      }
      await batch.commit();
      sessionsDeleted += snap.size;
      progress.funnelSessionsDeleted = (progress.funnelSessionsDeleted || 0) + snap.size;
      if (snap.size < 100) break;
    }

    let funnelEventsDeleted = 0;
    for (const sessionId of sessionIds) {
      const snap = await db.collection("funnel_events").where("sessionId", "==", sessionId).limit(200).get();
      if (snap.empty) continue;
      const batch = db.batch();
      for (const d of snap.docs) batch.delete(d.ref);
      await batch.commit();
      funnelEventsDeleted += snap.size;
    }
    if (funnelEventsDeleted > 0) progress.funnelEventsDeleted = (progress.funnelEventsDeleted || 0) + funnelEventsDeleted;

    let notifyDeleted = 0;
    while (notifyDeleted < 400) {
      const snap = await db.collection("notification_jobs").where("target.userId", "==", uid).limit(200).get();
      if (snap.empty) break;
      const batch = db.batch();
      for (const d of snap.docs) batch.delete(d.ref);
      await batch.commit();
      notifyDeleted += snap.size;
      progress.notificationJobsDeleted = (progress.notificationJobsDeleted || 0) + snap.size;
      if (snap.size < 200) break;
    }

    await adminApp.auth().deleteUser(uid).catch(() => {});

    await jobDoc.ref.update({
      status: "done",
      progress,
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e: any) {
    const nextAttempts = attempts + 1;
    const maxAttempts = 5;
    const backoffMinutes = [1, 5, 15, 60][nextAttempts - 1] || 60;
    const nextRunAt = admin.firestore.Timestamp.fromMillis(Date.now() + backoffMinutes * 60 * 1000);

    await jobDoc.ref.update({
      status: nextAttempts >= maxAttempts ? "failed" : "queued",
      progress,
      lastError: e?.message || String(e),
      attempts: nextAttempts,
      nextRunAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}
