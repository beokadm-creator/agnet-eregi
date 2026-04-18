"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeTimelineEvent = writeTimelineEvent;
const firestore_1 = require("./firestore");
// PII 가드(최소): 키 기반 차단. (프로덕에서는 더 엄격하게)
const PII_KEYS = ["residentId", "rrn", "accountNumber", "cardNumber", "ocrText", "documentUrl"];
async function writeTimelineEvent(adminApp, caseId, eventId, event) {
    const meta = event.meta ?? {};
    for (const k of Object.keys(meta)) {
        if (PII_KEYS.includes(k)) {
            throw new Error(`타임라인 meta에 PII 키는 금지입니다: ${k}`);
        }
    }
    await (0, firestore_1.caseTimelineRef)(adminApp, caseId, eventId).set({
        ...event,
        meta
    });
}
//# sourceMappingURL=timeline.js.map