"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filingRef = filingRef;
exports.validateSubmittedDate = validateSubmittedDate;
function filingRef(adminApp, caseId) {
    return adminApp.firestore().doc(`cases/${caseId}/filing/main`);
}
function validateSubmittedDate(s) {
    // YYYY-MM-DD 간단 검증
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
//# sourceMappingURL=filing.js.map