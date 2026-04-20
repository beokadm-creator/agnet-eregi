import * as admin from "firebase-admin";

export interface CircuitBreakerState {
  state: "closed" | "open" | "half_open";
  openedAt?: admin.firestore.Timestamp;
  openUntil?: admin.firestore.Timestamp;
  reason?: string;
  lastCategory?: string;
  failCount: number;
}

const CIRCUIT_OPEN_MINUTES = 60; // 1시간 차단
const MAX_FAIL_COUNT = 3; // 3회 연속 실패 시 차단 (또는 Rate Limit은 즉시 차단)

export async function checkCircuitBreaker(
  adminApp: typeof admin,
  gateKey: string
): Promise<void> {
  const docRef = adminApp.firestore().collection("ops_circuit_breakers").doc(`${gateKey}:github`);
  const snap = await docRef.get();
  
  if (!snap.exists) return;
  
  const cb = snap.data() as CircuitBreakerState;
  
  if (cb.state === "open") {
    if (cb.openUntil && cb.openUntil.toDate() > new Date()) {
      throw new Error(`[Circuit Breaker OPEN] GitHub API 접근이 차단되었습니다. (${cb.openUntil.toDate().toLocaleString()} 까지)`);
    } else {
      // 시간 경과로 half_open 전환 (테스트 허용)
      await docRef.update({ state: "half_open" });
    }
  }
}

export async function recordCircuitBreakerSuccess(
  adminApp: typeof admin,
  gateKey: string
): Promise<void> {
  const docRef = adminApp.firestore().collection("ops_circuit_breakers").doc(`${gateKey}:github`);
  const snap = await docRef.get();
  if (snap.exists && snap.data()?.state !== "closed") {
    await docRef.update({
      state: "closed",
      failCount: 0,
      openedAt: admin.firestore.FieldValue.delete(),
      openUntil: admin.firestore.FieldValue.delete(),
      reason: "Success after half_open"
    });
  }
}

export async function recordCircuitBreakerFail(
  adminApp: typeof admin,
  gateKey: string,
  category: string,
  message: string
): Promise<void> {
  // 권한 오류는 Breaker를 Open 시키지 않고 즉시 실패 처리 (카운트 증가 안함)
  if (category === "AUTH" || category === "PERMISSION" || category === "MISSING_CONFIG") {
    return;
  }

  const docRef = adminApp.firestore().collection("ops_circuit_breakers").doc(`${gateKey}:github`);
  const snap = await docRef.get();
  
  const now = adminApp.firestore.FieldValue.serverTimestamp();
  let nextState: "closed" | "open" | "half_open" = "closed";
  let failCount = 1;
  
  if (snap.exists) {
    const cb = snap.data() as CircuitBreakerState;
    failCount = (cb.failCount || 0) + 1;
    nextState = cb.state;
  }
  
  // Rate Limit이거나 연속 3회 이상 실패 시 Open
  if (category === "GITHUB_RATE_LIMIT" || failCount >= MAX_FAIL_COUNT) {
    nextState = "open";
  }

  if (nextState === "open" && (!snap.exists || snap.data()?.state !== "open")) {
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
    
  } else {
    await docRef.set({
      failCount,
      lastCategory: category,
      state: nextState
    }, { merge: true });
  }
}

export async function getCircuitBreakerState(
  adminApp: typeof admin,
  gateKey: string
): Promise<CircuitBreakerState | null> {
  const docRef = adminApp.firestore().collection("ops_circuit_breakers").doc(`${gateKey}:github`);
  const snap = await docRef.get();
  return snap.exists ? (snap.data() as CircuitBreakerState) : null;
}

export async function resetCircuitBreaker(
  adminApp: typeof admin,
  gateKey: string,
  reason: string = "Manual Reset"
): Promise<void> {
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

