import * as admin from "firebase-admin";
import { logOpsEvent } from "./ops_audit";
import { notifyOpsAlert } from "./ops_alert";

export async function captureQueryHealthError(
  adminApp: typeof admin,
  gateKey: string,
  queryName: string,
  errorObj: any
) {
  const errMsg = errorObj.message || String(errorObj);
  
  // FAILED_PRECONDITION 중 Index required 인지 판별
  if (errMsg.includes("FAILED_PRECONDITION") || errMsg.includes("index") || errMsg.includes("requires an index")) {
    const db = adminApp.firestore();
    
    // Dedup / Cooldown (최근 1시간 내에 같은 에러가 로깅되었는지)
    const recentSnap = await db.collection("ops_query_health")
      .where("gateKey", "==", gateKey)
      .where("queryName", "==", queryName)
      .where("createdAt", ">=", admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 60 * 1000))
      .limit(1)
      .get();
      
    if (!recentSnap.empty) {
      // 이미 최근에 로깅됨, 횟수만 올려줄 수도 있으나 여기서는 그냥 skip
      return;
    }
    
    const docRef = db.collection("ops_query_health").doc();
    await docRef.set({
      gateKey,
      queryName,
      errorMsg: errMsg,
      status: "open",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    await logOpsEvent(adminApp, {
      gateKey,
      action: "ops_query_health.event",
      status: "fail",
      actorUid: "system",
      requestId: `query_${Date.now()}`,
      summary: `[${queryName}] Query failed due to missing index`,
      target: { queryName, errorMsg: errMsg }
    });
    
    await notifyOpsAlert({
      gateKey,
      action: "ops_query_health.event",
      alertType: "query_health",
      summary: `[Query Health] Missing index for query: ${queryName}`,
      severity: "warning",
      error: { message: errMsg }
    });
  }
}