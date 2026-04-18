import type * as admin from "firebase-admin";

export function db(adminApp: typeof admin) {
  return adminApp.firestore();
}

export function sessionRef(adminApp: typeof admin, sessionId: string) {
  return db(adminApp).doc(`sessions/${sessionId}`);
}

export function caseRef(adminApp: typeof admin, caseId: string) {
  return db(adminApp).doc(`cases/${caseId}`);
}

export function caseTimelineRef(adminApp: typeof admin, caseId: string, eventId: string) {
  return db(adminApp).doc(`cases/${caseId}/timeline/${eventId}`);
}

