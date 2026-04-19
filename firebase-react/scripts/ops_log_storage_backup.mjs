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
  const targetMonth = requireEnv("TARGET_MONTH");
  const syncFile = requireEnv("SYNC_FILE");

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_STORAGE;
  if (!saJson) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON_STORAGE");
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(saJson);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON_STORAGE is not valid JSON.");
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
      storageBucket: `${serviceAccount.project_id}.appspot.com`, // 기본 버킷 추정
    });
  }

  const bucket = admin.storage().bucket();
  const filePath = path.join(repoRoot, syncFile);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Storage 경로 규칙: ops-logs/{gateKey}/{YYYY-MM}/pilot-ops-log.md
  // pilot-gate든 아니든 파일명은 pilot-ops-log.md 로 고정 (스펙 문서 요구사항)
  const destPath = `ops-logs/${gateKey}/${targetMonth}/pilot-ops-log.md`;
  
  console.log(`[Storage Backup] Uploading ${syncFile} to gs://${bucket.name}/${destPath}`);

  await bucket.upload(filePath, {
    destination: destPath,
    metadata: {
      contentType: "text/markdown",
      metadata: {
        gateKey,
        targetMonth,
        generatedAt: new Date().toISOString(),
        source: "ops-log-storage-backup",
      }
    }
  });

  console.log("[Storage Backup] Upload complete.");
}

main().catch((e) => {
  console.error("[Storage Backup] Failed:", e);
  process.exit(1);
});