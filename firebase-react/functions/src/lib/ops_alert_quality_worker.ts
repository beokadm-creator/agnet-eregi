import * as admin from "firebase-admin";
import { logOpsEvent } from "./ops_audit";

export async function processAlertQualityDaily(adminApp: typeof admin) {
  const db = adminApp.firestore();
  
  // 어제 날짜
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const yyyy = yesterday.getFullYear();
  const mm = String(yesterday.getMonth() + 1).padStart(2, "0");
  const dd = String(yesterday.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  // 어제 0시 ~ 23시59분
  const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0));
  const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999));

  const startTs = admin.firestore.Timestamp.fromDate(startOfDay);
  const endTs = admin.firestore.Timestamp.fromDate(endOfDay);

  // 1. ops_alert_jobs (전체 발송 수)
  const alertSnap = await db.collection("ops_alert_jobs")
    .where("createdAt", ">=", startTs)
    .where("createdAt", "<=", endTs)
    .get();

  // 2. ops_audit_events (ops_alert.suppressed, ops_playbook.run)
  const auditSnap = await db.collection("ops_audit_events")
    .where("createdAt", ">=", startTs)
    .where("createdAt", "<=", endTs)
    .get();

  // 3. ops_incidents (새로 열린 인시던트 수)
  const incidentSnap = await db.collection("ops_incidents")
    .where("startAt", ">=", startTs)
    .where("startAt", "<=", endTs)
    .get();

  const gateStats: Record<string, any> = {};
  
  const getStats = (gateKey: string) => {
    if (!gateStats[gateKey]) {
      gateStats[gateKey] = {
        gateKey,
        date: dateStr,
        alertsSent: 0,
        alertsFailed: 0,
        alertsSuppressed: 0,
        playbookRuns: 0,
        incidentsOpened: 0
      };
    }
    return gateStats[gateKey];
  };

  for (const doc of alertSnap.docs) {
    const data = doc.data();
    const gk = data.gateKey || "unknown";
    const s = getStats(gk);
    if (data.status === "done") {
      s.alertsSent++;
    } else if (data.status === "dead") {
      s.alertsFailed++;
    }
  }

  for (const doc of auditSnap.docs) {
    const data = doc.data();
    const gk = data.gateKey || "unknown";
    const s = getStats(gk);
    if (data.action === "ops_alert.suppressed") {
      s.alertsSuppressed++;
    }
    if (data.action === "ops_playbook.run") {
      s.playbookRuns++;
    }
  }

  for (const doc of incidentSnap.docs) {
    const data = doc.data();
    const gk = data.gateKey || "unknown";
    const s = getStats(gk);
    s.incidentsOpened++;
  }

  const batch = db.batch();
  for (const [gateKey, s] of Object.entries(gateStats)) {
    // Quality Score 계산
    const totalAlerts = s.alertsSent + s.alertsFailed + s.alertsSuppressed;
    let score = 100;
    
    let suppressedRate = 0;
    let failureRate = 0;
    let actionedRate = 0;

    if (totalAlerts > 0) {
      suppressedRate = s.alertsSuppressed / totalAlerts;
      failureRate = s.alertsFailed / totalAlerts;
      
      // 알림이 왔는데 행동(플레이북, 인시던트)으로 이어진 비율 (단순화된 모델)
      actionedRate = (s.playbookRuns + s.incidentsOpened) / s.alertsSent;
      if (actionedRate > 1) actionedRate = 1;
      
      // 페널티 적용
      score -= (suppressedRate * 30); // 억제율 높으면 최대 30점 감점
      score -= (failureRate * 50); // 발송 실패율 높으면 최대 50점 감점
      
      // 보너스 적용
      score += (actionedRate * 20); // 액션 이어지면 최대 20점 가점
    } else if (s.incidentsOpened > 0) {
      // 알림이 전혀 안 나갔는데 인시던트만 열렸다면 탐지 누락 페널티
      score -= 50;
    }

    if (score < 0) score = 0;
    if (score > 100) score = 100;

    const docRef = db.collection("ops_alert_quality_daily").doc(`${gateKey}__${dateStr}`);
    batch.set(docRef, {
      gateKey,
      date: dateStr,
      score: Number(score.toFixed(1)),
      signals: {
        suppressedRate: Number(suppressedRate.toFixed(4)),
        failureRate: Number(failureRate.toFixed(4)),
        actionedRate: Number(actionedRate.toFixed(4))
      },
      rawCounts: s,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  if (Object.keys(gateStats).length > 0) {
    await batch.commit();
  }

  await logOpsEvent(adminApp, {
    gateKey: "system",
    action: "ops_quality.daily",
    status: "success",
    actorUid: "system",
    requestId: `quality_${Date.now()}`,
    summary: `Daily alert quality score generated for ${dateStr}`,
    target: { date: dateStr, processedGates: Object.keys(gateStats).length }
  });
}
