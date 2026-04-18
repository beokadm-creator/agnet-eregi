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
  
  console.log("=== 1) API 호출 결과(요약) ===");
  const res = await fetch(`${FUNCTIONS_BASE}/v1/ops/reports/pilot-gate/backlog`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ date: "2026-04-18", topN: 3 })
  });
  const json = await res.json();
  
  if (!json.ok) {
    console.error("API failed:", json);
  } else {
    const items = json.data.items;
    console.log(`items.length: ${items.length}`);
    if (items.length > 0) {
      const item = items[0];
      console.log(`- severity: ${item.severity}`);
      console.log(`- reproSteps (재현): ${item.reproSteps ? '존재함' : '없음'}`);
      console.log(`- acceptanceCriteria (수용기준): ${item.acceptanceCriteria ? '존재함' : '없음'}`);
      // note: owner/eta는 UI 단에서 마크다운 복사 시 추가되는 필드입니다.
    }
  }
  
  console.log("\n=== 2) Ops Console 복사 결과(마크다운) 시뮬레이션 ===");
  if (json.ok && json.data.items.length > 0) {
    const item = json.data.items[0];
    const reproLines = item.reproSteps.split("\n").map(l => "  " + l).join("\n");
    const acLines = item.acceptanceCriteria.split("\n").map(l => "  " + l).join("\n");
    const markdown = `### ${item.title}
- **Sev**: ${item.severity}
- **영향도**: ${item.impactCount}건 발생
- **샘플 케이스**: ${item.sampleCaseIds.join(", ") || "없음"}
- **재현 단계**:
${reproLines}
- **AC (Acceptance Criteria)**:
${acLines}
- **Owner**: 
- **ETA**: `;
    console.log(markdown);
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
