import admin from "firebase-admin";

const PROJECT_ID = "agent-eregi";
const API_KEY = "AIzaSyAaVp-7itlHDgHlLvkZAb5k8ZXh-GiRaMo";
const FUNCTIONS_BASE = "https://asia-northeast3-agent-eregi.cloudfunctions.net/api";

admin.initializeApp({ projectId: PROJECT_ID });

async function getOpsToken() {
  const email = `ops_test_${Date.now()}@example.com`;
  const password = "password123";
  const userRecord = await admin.auth().createUser({ email, password });
  
  await admin.auth().setCustomUserClaims(userRecord.uid, { role: "ops_agent" });

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
  
  console.log("=== Testing Daily Report ===");
  const res1 = await fetch(`${FUNCTIONS_BASE}/v1/ops/reports/pilot-gate/daily?date=2026-04-18`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const json1 = await res1.json();
  if (!json1.ok) {
    console.error(json1);
  } else {
    console.log(JSON.stringify({ total: json1.data.total, ok: json1.data.ok, fail: json1.data.fail, topMissing: json1.data.topMissing[0] }));
  }
  
  console.log("\n=== Testing Backlog Generation ===");
  const res2 = await fetch(`${FUNCTIONS_BASE}/v1/ops/reports/pilot-gate/backlog`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ date: "2026-04-18", topN: 3 })
  });
  const json2 = await res2.json();
  if (!json2.ok) {
    console.error(json2);
  } else {
    console.log(JSON.stringify(json2.data.items[0], null, 2));
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
