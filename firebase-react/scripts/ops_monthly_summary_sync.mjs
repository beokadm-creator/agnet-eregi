const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function requireEnv(key) {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

async function main() {
  const repoRoot = process.env.REPO_ROOT ? path.resolve(process.env.REPO_ROOT) : process.cwd();
  const gateKey = requireEnv("GATE_KEY");
  
  // targetMonth 파싱 (KST 기준)
  let targetMonth = process.env.TARGET_MONTH;
  if (!targetMonth) {
    const kstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    targetMonth = kstNow.toISOString().substring(0, 7);
  }
  
  // OUTPUT_MODE (separate 또는 append-to-log, 기본값: separate)
  const outputMode = process.env.OUTPUT_MODE || "separate";

  const saJson = requireEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(saJson);
  } catch (err) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. ${err.message}`);
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const db = admin.firestore();
  
  // 1. 월간 리포트 SSOT 문서 조회
  const docId = `${gateKey}:${targetMonth}`;
  const docRef = db.collection("ops_monthly_reports").doc(docId);
  const docSnap = await docRef.get();
  
  if (!docSnap.exists) {
    console.log(`[Monthly Summary Sync] No monthly report found for ${docId}. Exiting.`);
    // 만약 문서가 없으면(월초 등) 그냥 종료하거나, generate API를 호출하도록 짤 수 있지만, 
    // 여기서는 워크플로우를 분리했으므로 단순히 스킵한다.
    return;
  }
  
  const data = docSnap.data();
  const markdownSummary = data.markdownSummary || "";
  
  if (!markdownSummary) {
    console.log(`[Monthly Summary Sync] markdownSummary is empty for ${docId}. Exiting.`);
    return;
  }

  // 2. 출력 파일 경로 결정
  let fileName;
  if (outputMode === "separate") {
    fileName = gateKey === "pilot-gate" 
      ? `${targetMonth}-pilot-ops-monthly-summary.md` 
      : `${targetMonth}-${gateKey}-ops-monthly-summary.md`;
  } else {
    // 기존 log 파일에 append 하는 모드
    fileName = gateKey === "pilot-gate" 
      ? `${targetMonth}-pilot-ops-log.md` 
      : `${targetMonth}-${gateKey}-ops-log.md`;
  }
  
  const relOutPath = path.join("spec", "00-index", fileName);
  const absOutPath = path.join(repoRoot, relOutPath);
  
  // 3. 마커 기반 치환 로직
  const MARKER_START = "<!-- OPS_MONTHLY_SUMMARY_AUTO:START -->";
  const MARKER_END = "<!-- OPS_MONTHLY_SUMMARY_AUTO:END -->";
  
  let fileContent = "";
  if (fs.existsSync(absOutPath)) {
    fileContent = fs.readFileSync(absOutPath, "utf-8");
  } else {
    // 파일이 없으면 뼈대 생성
    fileContent = `# ${targetMonth} Ops Monthly Summary (${gateKey})\n\n${MARKER_START}\n${MARKER_END}\n`;
  }
  
  const startIdx = fileContent.indexOf(MARKER_START);
  const endIdx = fileContent.indexOf(MARKER_END);
  
  if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    // 기존 마커 구간 치환
    const beforeMarker = fileContent.substring(0, startIdx + MARKER_START.length);
    const afterMarker = fileContent.substring(endIdx);
    fileContent = `${beforeMarker}\n\n${markdownSummary}\n\n${afterMarker}`;
  } else {
    // 마커가 없으면 파일 맨 아래에 마커와 함께 추가
    fileContent += `\n\n${MARKER_START}\n\n${markdownSummary}\n\n${MARKER_END}\n`;
  }
  
  // 4. 파일 쓰기
  fs.mkdirSync(path.dirname(absOutPath), { recursive: true });
  fs.writeFileSync(absOutPath, fileContent, "utf-8");
  console.log(`[Monthly Summary Sync] Updated ${relOutPath} with markdownSummary.`);

  // 5. GITHUB_OUTPUT 에 전달 (PR 생성용)
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `sync_file=${relOutPath}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `sync_gateKey=${gateKey}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `target_month=${targetMonth}\n`);
  }
}

main().catch((e) => {
  console.error("[Monthly Summary Sync] Failed:", e);
  process.exit(1);
});