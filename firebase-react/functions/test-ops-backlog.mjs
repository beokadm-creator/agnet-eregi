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
  const url = `${FUNCTIONS_BASE}/v1/ops/reports/pilot-gate/backlog`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ date: "2026-04-18", topN: 3 })
  });
  
  if (!resp.ok) {
    throw new Error(`API failed: ${resp.status} ${await resp.text()}`);
  }
  
  const json = await resp.json();
  const backlogItems = json.data.items || [];
  
  const lines = backlogItems.map(item => {
      const reproLines = item.reproSteps.split("\n").map(l => "  " + l).join("\n");
      const acLines = item.acceptanceCriteria.split("\n").map(l => "  " + l).join("\n");
      const severityStr = String(item.severity).startsWith("Sev") ? item.severity : `Sev${item.severity}`;
      const ownerStr = item.owner || "ops";
      const etaStr = item.eta || "TBD";
      
      return `### ${item.title}
- **Sev**: ${severityStr}
- **영향도**: ${item.impactCount}건 발생
- **샘플 케이스**: ${item.sampleCaseIds.join(", ") || "없음"}
- **재현 단계**:
${reproLines}
- **AC (Acceptance Criteria)**:
${acLines}
- **Owner**: ${ownerStr}
- **ETA**: ${etaStr}`;
  });

  const markdown = lines.join("\n\n");
  console.log(markdown);
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
