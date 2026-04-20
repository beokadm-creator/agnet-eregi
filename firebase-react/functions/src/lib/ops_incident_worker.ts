import * as admin from "firebase-admin";
import { processIncidentEvents, closeStaleIncidents } from "./ops_incident";

export async function processOpsIncidents(adminApp: typeof admin) {
  const db = adminApp.firestore();
  
  // To avoid duplicate processing, we need to keep track of the last processed event time.
  // We can store it in a system document or just scan recent events.
  // For simplicity and idempotency, let's scan events from the last 15 minutes.
  // The processIncidentEvents function deduplicates by refId (event.id), but if we process the same event again,
  // we might increment counters again if we are not careful.
  // Wait, in `processIncidentEvents`, we just increment counters for every event passed. 
  // If we pass the same event twice, it will double count.
  // To fix this, we should fetch only events that haven't been processed yet.
  
  const stateDocRef = db.collection("ops_system").doc("incident_worker_state");
  const stateSnap = await stateDocRef.get();
  
  // Default to 15 minutes ago if no state
  let lastProcessedTime = adminApp.firestore.Timestamp.fromMillis(Date.now() - 15 * 60 * 1000);
  
  if (stateSnap.exists && stateSnap.data()?.lastProcessedTime) {
    lastProcessedTime = stateSnap.data()?.lastProcessedTime;
  }

  const now = adminApp.firestore.Timestamp.now();

  const eventsSnap = await db.collection("ops_audit_events")
    .where("createdAt", ">", lastProcessedTime)
    .where("createdAt", "<=", now)
    .orderBy("createdAt", "asc")
    .get();

  if (!eventsSnap.empty) {
    // Group events by gateKey
    const eventsByGate: Record<string, any[]> = {};
    for (const doc of eventsSnap.docs) {
      const data = doc.data();
      const gateKey = data.gateKey || "unknown";
      if (!eventsByGate[gateKey]) {
        eventsByGate[gateKey] = [];
      }
      eventsByGate[gateKey].push({
        id: doc.id,
        action: data.action,
        status: data.status,
        summary: data.summary,
        createdAt: data.createdAt,
        correlationId: data.correlationId
      });
    }

    // Process incidents per gateKey
    for (const [gateKey, events] of Object.entries(eventsByGate)) {
      await processIncidentEvents(adminApp, gateKey, events);
    }
  }

  // Update lastProcessedTime
  await stateDocRef.set({ lastProcessedTime: now }, { merge: true });

  // Close stale incidents (no events for 30 mins)
  await closeStaleIncidents(adminApp);
}

export async function generateWeeklyIncidentSummary(adminApp: typeof admin) {
  const db = adminApp.firestore();
  
  // 지난 7일의 시작과 끝 시간 계산
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const endTimestamp = adminApp.firestore.Timestamp.fromMillis(now.getTime());
  const startTimestamp = adminApp.firestore.Timestamp.fromMillis(sevenDaysAgo.getTime());

  // 지난 7일 내에 시작된 closed 상태의 incidents 가져오기
  const incidentsSnap = await db.collection("ops_incidents")
    .where("status", "==", "closed")
    .where("startAt", ">=", startTimestamp)
    .where("startAt", "<=", endTimestamp)
    .get();

  if (incidentsSnap.empty) {
    return;
  }

  // gateKey별로 그룹화
  const incidentsByGate: Record<string, any[]> = {};
  for (const doc of incidentsSnap.docs) {
    const data = doc.data();
    const gateKey = data.gateKey || "unknown";
    if (!incidentsByGate[gateKey]) {
      incidentsByGate[gateKey] = [];
    }
    incidentsByGate[gateKey].push(data);
  }

  // 주차(Week) 포맷 생성 (예: 2026-W16)
  // 간단하게 현재 날짜 기준으로 생성
  const year = now.getFullYear();
  const weekNum = Math.ceil(Math.floor((now.getTime() - new Date(year, 0, 1).getTime()) / (24 * 60 * 60 * 1000)) / 7);
  const weekStr = `${year}-W${weekNum.toString().padStart(2, "0")}`;

  const batch = db.batch();

  for (const [gateKey, incidents] of Object.entries(incidentsByGate)) {
    // Markdown 요약 텍스트 생성
    let markdown = `# ${gateKey} Incident Weekly Summary (${weekStr})\n\n`;
    markdown += `**기간**: ${sevenDaysAgo.toISOString().split('T')[0]} ~ ${now.toISOString().split('T')[0]}\n`;
    markdown += `**총 사건 발생 수**: ${incidents.length}건\n\n`;

    // 심각도 통계
    const criticalCount = incidents.filter(i => i.severity === "critical").length;
    const warnCount = incidents.filter(i => i.severity === "warn").length;
    markdown += `## 📊 심각도 요약\n`;
    markdown += `- **Critical**: ${criticalCount}건\n`;
    markdown += `- **Warn**: ${warnCount}건\n\n`;

    // 상세 리스트
    markdown += `## 🚨 상세 사건 목록\n`;
    for (const incident of incidents.sort((a, b) => b.startAt.toMillis() - a.startAt.toMillis())) {
      const startAt = incident.startAt.toDate().toLocaleString();
      const endAt = incident.endAt ? incident.endAt.toDate().toLocaleString() : "Unknown";
      const durationMin = incident.endAt ? Math.floor((incident.endAt.toMillis() - incident.startAt.toMillis()) / 60000) : 0;
      
      markdown += `### [${incident.severity.toUpperCase()}] ${startAt} ~ ${endAt} (${durationMin}분)\n`;
      markdown += `- **Reasons**: ${incident.reasons?.join(", ") || "None"}\n`;
      markdown += `- **Counters**: CB: ${incident.counters?.cbOpen || 0}, DeadJobs: ${incident.counters?.deadJobs || 0}, AlertDead: ${incident.counters?.alertDead || 0}, AuditFail: ${incident.counters?.auditFail || 0}\n`;
      if (incident.sampleEvents?.length > 0) {
        markdown += `- **Key Event**: ${incident.sampleEvents[0].action} - ${incident.sampleEvents[0].summary}\n`;
      }
      markdown += `\n`;
    }

    const summaryRef = db.collection("ops_incident_summaries").doc(`${gateKey}_${weekStr}`);
    batch.set(summaryRef, {
      gateKey,
      week: weekStr,
      markdown,
      incidentCount: incidents.length,
      createdAt: adminApp.firestore.FieldValue.serverTimestamp()
    });
  }

  await batch.commit();
}
