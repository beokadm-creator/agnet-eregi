import * as admin from "firebase-admin";

export interface OpsIncidentSampleEvent {
  at: admin.firestore.Timestamp;
  action: string;
  status: string;
  summary: string;
  refId?: string;
}

export interface OpsIncident {
  gateKey: string;
  status: "open" | "closed";
  severity: "warn" | "critical";
  startAt: admin.firestore.Timestamp;
  endAt?: admin.firestore.Timestamp;
  lastSeenAt: admin.firestore.Timestamp;
  reasons: string[];
  counters: {
    auditFail: number;
    alertDead: number;
    deadJobs: number;
    cbOpen: number;
    authDenied: number;
  };
  sampleEvents: OpsIncidentSampleEvent[];
}

export async function processIncidentEvents(
  adminApp: typeof admin,
  gateKey: string,
  events: Array<{
    id: string;
    action: string;
    status: string;
    summary: string;
    createdAt: admin.firestore.Timestamp;
  }>
) {
  if (events.length === 0) return;

  const incidentsRef = adminApp.firestore().collection("ops_incidents");
  
  // Get the most recent open incident for this gateKey
  const openIncidentSnap = await incidentsRef
    .where("gateKey", "==", gateKey)
    .where("status", "==", "open")
    .orderBy("startAt", "desc")
    .limit(1)
    .get();

  let incidentDoc: admin.firestore.DocumentReference;
  let incidentData: OpsIncident;

  // Sort events by time ascending
  const sortedEvents = [...events].sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
  const THIRTY_MINUTES_MS = 30 * 60 * 1000;

  if (openIncidentSnap.empty) {
    // Create new incident
    incidentDoc = incidentsRef.doc();
    const firstEvent = sortedEvents[0];
    incidentData = {
      gateKey,
      status: "open",
      severity: "warn",
      startAt: firstEvent.createdAt,
      lastSeenAt: firstEvent.createdAt,
      reasons: [],
      counters: {
        auditFail: 0,
        alertDead: 0,
        deadJobs: 0,
        cbOpen: 0,
        authDenied: 0,
      },
      sampleEvents: [],
    };
  } else {
    incidentDoc = openIncidentSnap.docs[0].ref;
    incidentData = openIncidentSnap.docs[0].data() as OpsIncident;
  }

  for (const event of sortedEvents) {
    // Check if event is more than 30 minutes after lastSeenAt
    if (event.createdAt.toMillis() - incidentData.lastSeenAt.toMillis() > THIRTY_MINUTES_MS) {
      // Close current incident
      incidentData.status = "closed";
      incidentData.endAt = incidentData.lastSeenAt; // Or current time? Requirement says "open Incident가 lastSeenAt 이후 30분 동안 새 이벤트 없으면 status=closed, endAt=now". We will handle auto-close in a worker, but here if there is a new event after 30 min, we close the old one and create a new one.
      await incidentDoc.set(incidentData);

      // Create new incident
      incidentDoc = incidentsRef.doc();
      incidentData = {
        gateKey,
        status: "open",
        severity: "warn",
        startAt: event.createdAt,
        lastSeenAt: event.createdAt,
        reasons: [],
        counters: {
          auditFail: 0,
          alertDead: 0,
          deadJobs: 0,
          cbOpen: 0,
          authDenied: 0,
        },
        sampleEvents: [],
      };
    }

    // Update counters and reasons
    incidentData.lastSeenAt = event.createdAt;
    
    let isSignificant = false;
    let reasonToAdd: string | null = null;

    if (event.action === "ops_circuit_breaker.open" || event.action === "ops_circuit_breaker.fail") {
      incidentData.counters.cbOpen++;
      reasonToAdd = "cb_open";
      incidentData.severity = "critical";
      isSignificant = true;
    } else if (event.action.startsWith("ops_retry") && event.action.includes("deadletter")) {
      incidentData.counters.deadJobs++;
      reasonToAdd = "dead_jobs";
      incidentData.severity = "critical";
      isSignificant = true;
    } else if (event.action === "ops_alert.notify" && event.status === "fail") {
      incidentData.counters.alertDead++;
      reasonToAdd = "alert_dead";
      isSignificant = true;
    } else if (event.action === "ops_auth.denied") {
      incidentData.counters.authDenied++;
      if (incidentData.counters.authDenied >= 10) {
        reasonToAdd = "auth_denied_spike";
      }
      isSignificant = true;
    } else if (event.status === "fail") {
      incidentData.counters.auditFail++;
      isSignificant = true;
    }

    if (reasonToAdd && !incidentData.reasons.includes(reasonToAdd)) {
      incidentData.reasons.push(reasonToAdd);
    }

    // Add to sampleEvents if significant and we have room
    if (isSignificant && !incidentData.sampleEvents.find(e => e.refId === event.id)) {
      incidentData.sampleEvents.push({
        at: event.createdAt,
        action: event.action,
        status: event.status,
        summary: event.summary,
        refId: event.id,
      });
      // Keep only max 20 events
      if (incidentData.sampleEvents.length > 20) {
        // Remove the oldest, or just keep the first 20. Let's keep the most recent 20
        incidentData.sampleEvents = incidentData.sampleEvents.slice(-20);
      }
    }
  }

  await incidentDoc.set(incidentData);
}

export async function closeStaleIncidents(adminApp: typeof admin) {
  const incidentsRef = adminApp.firestore().collection("ops_incidents");
  const thirtyMinsAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 30 * 60 * 1000);
  
  const staleSnap = await incidentsRef
    .where("status", "==", "open")
    .where("lastSeenAt", "<=", thirtyMinsAgo)
    .get();

  const batch = adminApp.firestore().batch();
  for (const doc of staleSnap.docs) {
    batch.update(doc.ref, {
      status: "closed",
      endAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  
  if (!staleSnap.empty) {
    await batch.commit();
  }
}
