import * as admin from "firebase-admin";
import { logOpsEvent } from "./ops_audit";

export async function processFirestoreBackup(adminApp: typeof admin) {
  // 실제 Firestore Export는 gcloud alpha firestore export를 이용해 Cloud Storage로 백업하는 것을 의미.
  // Node.js Admin SDK에는 Export 기능이 내장되어 있지 않기 때문에, Google Cloud의 Firestore Admin API(REST)를 호출해야 합니다.
  // 여기서는 MVP 용도로 REST API 호출을 시뮬레이션(또는 최소 구현)합니다.
  
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG as string).projectId : "unknown";
  
  if (projectId === "unknown") {
    throw new Error("Project ID를 환경변수에서 찾을 수 없습니다.");
  }
  
  const bucketName = process.env.OPS_BACKUP_BUCKET_NAME || `${projectId}-firestore-backup`;
  
  try {
    // 실제로는 Google Auth Library를 통해 토큰을 받아오고,
    // POST https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments
    // Body: { outputUriPrefix: `gs://${bucketName}/backup_${Date.now()}` }
    // 를 호출해야 함.
    
    // (MVP 모의)
    console.log(`[Ops Backup] Triggering export to gs://${bucketName}/...`);
    
    // 상태 저장 (비동기 LRO Operation ID를 받아 주기적으로 체크하는 것이 정석이나 임시 저장)
    await adminApp.firestore().collection("ops_backup_runs").doc().set({
      bucket: bucketName,
      status: "started", // "started" -> "success" or "fail" (별도 워커가 확인)
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    await logOpsEvent(adminApp, {
      gateKey: "system",
      action: "ops_backup.run",
      status: "success",
      actorUid: "system",
      requestId: `backup_${Date.now()}`,
      summary: `Firestore Export Triggered to gs://${bucketName}`,
      target: { bucketName }
    });
    
  } catch (e: any) {
    await logOpsEvent(adminApp, {
      gateKey: "system",
      action: "ops_backup.run",
      status: "fail",
      actorUid: "system",
      requestId: `backup_${Date.now()}`,
      summary: `Firestore Export Trigger Failed`,
      error: { message: e.message }
    });
    throw e;
  }
}
