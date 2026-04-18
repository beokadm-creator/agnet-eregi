"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = db;
exports.sessionRef = sessionRef;
exports.caseRef = caseRef;
exports.caseTimelineRef = caseTimelineRef;
function db(adminApp) {
    return adminApp.firestore();
}
function sessionRef(adminApp, sessionId) {
    return db(adminApp).doc(`sessions/${sessionId}`);
}
function caseRef(adminApp, caseId) {
    return db(adminApp).doc(`cases/${caseId}`);
}
function caseTimelineRef(adminApp, caseId, eventId) {
    return db(adminApp).doc(`cases/${caseId}/timeline/${eventId}`);
}
//# sourceMappingURL=firestore.js.map