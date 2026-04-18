import process from "node:process";
import admin from "firebase-admin";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "agent-eregi";

// If you want to run against production (agent-eregi), make sure you have GOOGLE_APPLICATION_CREDENTIALS or are logged in via gcloud auth application-default login
// If running locally against emulator, FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST must be set.
if (process.env.FIRESTORE_EMULATOR_HOST) {
  admin.initializeApp({ projectId: PROJECT_ID });
  admin.firestore().settings({ host: process.env.FIRESTORE_EMULATOR_HOST, ssl: false });
} else {
  admin.initializeApp({ projectId: PROJECT_ID });
}

async function main() {
  const args = process.argv.slice(2);
  const dateArg = args.find(a => a.startsWith("--date="));
  
  // Use provided date, or today based on local time
  let targetDateStr = dateArg ? dateArg.split("=")[1] : new Date().toLocaleDateString("en-CA").split("/").reverse().join("-");

  const targetDate = new Date(targetDateStr);
  if (isNaN(targetDate.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

  const snapshot = await admin.firestore()
    .collection("pilot_gate_evidence")
    .where("validatedAt", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
    .where("validatedAt", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
    .get();

  const docs = snapshot.docs.map(d => d.data());

  const total = docs.length;
  const ok = docs.filter(d => d.ok === true || d.status === "ok").length;
  const fail = total - ok;

  const missingCount = {};
  const failCases = new Set();

  for (const d of docs) {
    if (d.ok === false || d.status === "fail") {
      failCases.add(d.caseId);
      if (Array.isArray(d.missing)) {
        for (const m of d.missing) {
          missingCount[m] = (missingCount[m] || 0) + 1;
        }
      }
    }
  }

  const topMissing = Object.entries(missingCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(e => `${e[0]}(${e[1]}건)`)
    .join(", ");

  const sampleFailCases = Array.from(failCases).slice(0, 3).join(", ");

  console.log(`[${targetDateStr} Gate 집계] 총 ${total}건 (성공: ${ok}건, 실패: ${fail}건)`);
  if (fail > 0) {
    console.log(`- 주요 누락서류: ${topMissing || "없음"}`);
    console.log(`- 실패 샘플(최대3건): ${sampleFailCases || "없음"}`);
  }
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
