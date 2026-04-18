import admin from "firebase-admin";

const PROJECT_ID = "agent-eregi";
const API_KEY = "AIzaSyAaVp-7itlHDgHlLvkZAb5k8ZXh-GiRaMo";
const FUNCTIONS_BASE = "https://asia-northeast3-agent-eregi.cloudfunctions.net/api";

admin.initializeApp({ projectId: PROJECT_ID });

async function getOpsToken() {
  const email = `ops_test_${Date.now()}@example.com`;
  const password = "password123";
  const userRecord = await admin.auth().createUser({ email, password });
  
  // Add custom claims to simulate ops
  await admin.auth().setCustomUserClaims(userRecord.uid, { role: "ops" });

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  if (!resp.ok) throw new Error(`auth sign in failed: ${resp.status} ${await resp.text()}`);
  const json = await resp.json();
  return json.idToken;
}

async function main() {
  const token = await getOpsToken();
  const url = `${FUNCTIONS_BASE}/v1/ops/reports/pilot-gate/daily`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!resp.ok) {
    throw new Error(`API failed: ${resp.status} ${await resp.text()}`);
  }
  
  const json = await resp.json();
  console.log("=== API Response ===");
  console.log(JSON.stringify(json, null, 2));
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
