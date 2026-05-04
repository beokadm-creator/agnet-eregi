import * as admin from "firebase-admin";
import { logOpsEvent } from "./ops_audit";

export async function processOpsMetricsDaily(adminApp: typeof admin) {
  const db = adminApp.firestore();
  
  // 어제 날짜를 기준으로 처리
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const yyyy = yesterday.getFullYear();
  const mm = String(yesterday.getMonth() + 1).padStart(2, "0");
  const dd = String(yesterday.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  // 어제 0시 ~ 23시59분 범위
  const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0));
  const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999));

  const startTs = admin.firestore.Timestamp.fromDate(startOfDay);
  const endTs = admin.firestore.Timestamp.fromDate(endOfDay);

  // 1. Audit Events 스캔 (failRate, authDenied, costSignals)
  const auditSnap = await db.collection("ops_audit_events")
    .where("createdAt", ">=", startTs)
    .where("createdAt", "<=", endTs)
    .get();

  // 2. Retry Jobs 스캔 (deadJobs)
  const retrySnap = await db.collection("ops_retry_jobs")
    .where("createdAt", ">=", startTs)
    .where("createdAt", "<=", endTs)
    .get();

  // 3. Alert Jobs 스캔 (alertsSent, alertsFailed, alertsSuppressed)
  const alertSnap = await db.collection("ops_alert_jobs")
    .where("createdAt", ">=", startTs)
    .where("createdAt", "<=", endTs)
    .get();

  // 4. Incidents 스캔 (incidentsOpened, incidentsClosed)
  const incidentSnap = await db.collection("ops_incidents")
    .where("startAt", ">=", startTs)
    .where("startAt", "<=", endTs)
    .get();

  // GateKey 별로 집계
  const gateMetrics: Record<string, any> = {};

  const getGateMetric = (gateKey: string) => {
    if (!gateMetrics[gateKey]) {
      gateMetrics[gateKey] = {
        gateKey,
        date: dateStr,
        auditTotal: 0,
        auditFail: 0,
        authDeniedCount: 0,
        deadJobsCount: 0,
        alertsSent: 0,
        alertsFailed: 0,
        alertsSuppressed: 0,
        incidentsOpened: 0,
        incidentsClosed: 0,
        playbookRuns: 0,
        costSignals: 0
      };
    }
    return gateMetrics[gateKey];
  };

  // Audit Events
  for (const doc of auditSnap.docs) {
    const data = doc.data();
    const gk = data.gateKey || "unknown";
    const m = getGateMetric(gk);

    m.auditTotal++;
    m.costSignals++; // 단순 볼륨
    
    if (data.status === "fail") {
      m.auditFail++;
    }
    if (data.action === "ops_auth.denied") {
      m.authDeniedCount++;
    }
    if (data.action === "ops_playbook.run") {
      m.playbookRuns++;
    }
    if (data.action === "ops_alert.suppressed") {
       m.alertsSuppressed++;
    }
  }

  // Retry Jobs
  for (const doc of retrySnap.docs) {
    const data = doc.data();
    const gk = data.gateKey || "unknown";
    const m = getGateMetric(gk);
    if (data.status === "dead") {
      m.deadJobsCount++;
    }
  }

  // Alert Jobs
  for (const doc of alertSnap.docs) {
    const data = doc.data();
    const gk = data.gateKey || "unknown";
    const m = getGateMetric(gk);
    if (data.status === "done") {
      m.alertsSent++;
    } else if (data.status === "dead") {
      m.alertsFailed++;
    }
  }

  // Incidents
  for (const doc of incidentSnap.docs) {
    const data = doc.data();
    const gk = data.gateKey || "unknown";
    const m = getGateMetric(gk);
    
    m.incidentsOpened++;
    if (data.status === "closed") {
      m.incidentsClosed++;
    }
  }

  // 저장
  const batch = db.batch();
  for (const [gateKey, m] of Object.entries(gateMetrics)) {
    // 파생 메트릭 계산
    m.failRate = m.auditTotal > 0 ? Number((m.auditFail / m.auditTotal).toFixed(4)) : 0;

    const docRef = db.collection("ops_metrics_daily").doc(`${gateKey}__${dateStr}`);
    batch.set(docRef, {
      ...m,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  if (Object.keys(gateMetrics).length > 0) {
    await batch.commit();
  }

  await logOpsEvent(adminApp, {
    gateKey: "system",
    action: "ops_metrics.daily",
    status: "success",
    actorUid: "system",
    requestId: `metrics_${Date.now()}`,
    summary: `Daily metrics snapshot generated for ${dateStr}`,
    target: { date: dateStr, processedGates: Object.keys(gateMetrics).length }
  });
}
