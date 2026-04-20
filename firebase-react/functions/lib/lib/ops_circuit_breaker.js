"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCircuitBreaker = checkCircuitBreaker;
exports.recordCircuitBreakerSuccess = recordCircuitBreakerSuccess;
exports.recordCircuitBreakerFail = recordCircuitBreakerFail;
exports.getCircuitBreakerState = getCircuitBreakerState;
exports.resetCircuitBreaker = resetCircuitBreaker;
const admin = __importStar(require("firebase-admin"));
const CIRCUIT_OPEN_MINUTES = 60; // 1시간 차단
const MAX_FAIL_COUNT = 3; // 3회 연속 실패 시 차단 (또는 Rate Limit은 즉시 차단)
async function checkCircuitBreaker(adminApp, gateKey) {
    const docRef = adminApp.firestore().collection("ops_circuit_breakers").doc(`${gateKey}:github`);
    const snap = await docRef.get();
    if (!snap.exists)
        return;
    const cb = snap.data();
    if (cb.state === "open") {
        if (cb.openUntil && cb.openUntil.toDate() > new Date()) {
            throw new Error(`[Circuit Breaker OPEN] GitHub API 접근이 차단되었습니다. (${cb.openUntil.toDate().toLocaleString()} 까지)`);
        }
        else {
            // 시간 경과로 half_open 전환 (테스트 허용)
            await docRef.update({ state: "half_open" });
        }
    }
}
async function recordCircuitBreakerSuccess(adminApp, gateKey) {
    var _a;
    const docRef = adminApp.firestore().collection("ops_circuit_breakers").doc(`${gateKey}:github`);
    const snap = await docRef.get();
    if (snap.exists && ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.state) !== "closed") {
        await docRef.update({
            state: "closed",
            failCount: 0,
            openedAt: admin.firestore.FieldValue.delete(),
            openUntil: admin.firestore.FieldValue.delete(),
            reason: "Success after half_open"
        });
    }
}
async function recordCircuitBreakerFail(adminApp, gateKey, category, message) {
    var _a;
    // 권한 오류는 Breaker를 Open 시키지 않고 즉시 실패 처리 (카운트 증가 안함)
    if (category === "AUTH" || category === "PERMISSION" || category === "MISSING_CONFIG") {
        return;
    }
    const docRef = adminApp.firestore().collection("ops_circuit_breakers").doc(`${gateKey}:github`);
    const snap = await docRef.get();
    const now = adminApp.firestore.FieldValue.serverTimestamp();
    let nextState = "closed";
    let failCount = 1;
    if (snap.exists) {
        const cb = snap.data();
        failCount = (cb.failCount || 0) + 1;
        nextState = cb.state;
    }
    // Rate Limit이거나 연속 3회 이상 실패 시 Open
    if (category === "GITHUB_RATE_LIMIT" || failCount >= MAX_FAIL_COUNT) {
        nextState = "open";
    }
    if (nextState === "open" && (!snap.exists || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.state) !== "open")) {
        const openUntilDate = new Date();
        openUntilDate.setMinutes(openUntilDate.getMinutes() + CIRCUIT_OPEN_MINUTES);
        await docRef.set({
            state: "open",
            failCount,
            openedAt: now,
            openUntil: admin.firestore.Timestamp.fromDate(openUntilDate),
            reason: message,
            lastCategory: category
        }, { merge: true });
    }
    else {
        await docRef.set({
            failCount,
            lastCategory: category,
            state: nextState
        }, { merge: true });
    }
}
async function getCircuitBreakerState(adminApp, gateKey) {
    const docRef = adminApp.firestore().collection("ops_circuit_breakers").doc(`${gateKey}:github`);
    const snap = await docRef.get();
    return snap.exists ? snap.data() : null;
}
async function resetCircuitBreaker(adminApp, gateKey, reason = "Manual Reset") {
    const docRef = adminApp.firestore().collection("ops_circuit_breakers").doc(`${gateKey}:github`);
    await docRef.set({
        state: "closed",
        failCount: 0,
        openedAt: admin.firestore.FieldValue.delete(),
        openUntil: admin.firestore.FieldValue.delete(),
        reason,
        lastCategory: "MANUAL_RESET"
    }, { merge: true });
}
//# sourceMappingURL=ops_circuit_breaker.js.map