import * as admin from "firebase-admin";
import { logOpsEvent } from "./ops_audit";
import axios from "axios";

export async function processFirestoreBackup(adminApp: typeof admin) {
  const requestId = `backup_${Date.now()}`;
  const projectId = process.env.GCLOUD_PROJECT
    || (process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG as string).projectId : "unknown");

  if (projectId === "unknown") throw new Error("Project ID를 환경변수에서 찾을 수 없습니다.");

  const bucketName = process.env.OPS_BACKUP_BUCKET_NAME || `${projectId}-firestore-backup`;
  const outputUriPrefix = `gs://${bucketName}/backup_${Date.now()}`;
  const emulator = process.env.FUNCTIONS_EMULATOR === "true";
  const simulate = emulator || process.env.OPS_BACKUP_SIMULATE === "1";

  const runRef = adminApp.firestore().collection("ops_backup_runs").doc();

  try {
    if (simulate) {
      await runRef.set({
        bucket: bucketName,
        outputUriPrefix,
        status: "simulated",
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logOpsEvent(adminApp, {
        gateKey: "system",
        action: "ops_backup.run",
        status: "success",
        actorUid: "system",
        requestId,
        summary: `Firestore Export Simulated to ${outputUriPrefix}`,
        target: { bucketName, outputUriPrefix, runId: runRef.id },
      });
      return;
    }

    const tokenRes = await axios.get(
      "http://metadata/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" } }
    );
    const accessToken = tokenRes.data?.access_token;
    if (!accessToken) throw new Error("Failed to obtain access token from metadata server");

    const exportRes = await axios.post(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`,
      { outputUriPrefix },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const operationName = exportRes.data?.name || null;

    await runRef.set({
      bucket: bucketName,
      outputUriPrefix,
      status: "running",
      operationName,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await logOpsEvent(adminApp, {
      gateKey: "system",
      action: "ops_backup.run",
      status: "success",
      actorUid: "system",
      requestId,
      summary: `Firestore Export Triggered`,
      target: { bucketName, outputUriPrefix, operationName, runId: runRef.id },
    });
  } catch (e: any) {
    await runRef.set({
      bucket: bucketName,
      outputUriPrefix,
      status: "fail",
      error: e?.message || String(e),
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await logOpsEvent(adminApp, {
      gateKey: "system",
      action: "ops_backup.run",
      status: "fail",
      actorUid: "system",
      requestId,
      summary: `Firestore Export Trigger Failed`,
      error: { message: e?.message || String(e) },
      target: { bucketName, outputUriPrefix, runId: runRef.id },
    });
    throw e;
  }
}
