/**
 * Firestore(ops_daily_logs) → spec/00-index/YYYY-MM-pilot-ops-log.md 동기화 스크립트
 *
 * 사용:
 *   FIREBASE_SERVICE_ACCOUNT_JSON='{}' TARGET_MONTH='2026-04' node firebase-react/scripts/ops_log_sync.mjs
 *
 * GitHub Action에서 실행되는 것을 전제로 하며, SSOT는 Firestore입니다.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import admin from "firebase-admin";

const START_MARKER = "<!-- OPS_LOG_AUTO:START -->";
const END_MARKER = "<!-- OPS_LOG_AUTO:END -->";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function getKstNowParts() {
  // KST 기준 "YYYY-MM-DD", "YYYY-MM" 계산
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // "YYYY-MM-DD"

  return { ymd, ym: ymd.slice(0, 7) };
}

function nextMonth(ym) {
  // ym: "YYYY-MM" → 다음 달 "YYYY-MM"
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    throw new Error(`Invalid TARGET_MONTH: ${ym}`);
  }
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 7);
}

function ensureMarkers(existingText) {
  if (existingText.includes(START_MARKER) && existingText.includes(END_MARKER)) return existingText;

  // 기존 파일에 마커가 없다면 파일 하단에 추가 (최초 1회)
  const trimmed = existingText.trimEnd();
  return `${trimmed}\n\n${START_MARKER}\n${END_MARKER}\n`;
}

function replaceBetweenMarkers(text, generatedBlock) {
  const startIdx = text.indexOf(START_MARKER);
  const endIdx = text.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error("Markers not found or invalid order.");
  }

  const before = text.slice(0, startIdx + START_MARKER.length);
  const after = text.slice(endIdx); // includes END_MARKER
  return `${before}\n${generatedBlock.trimEnd()}\n${after}`;
}

async function main() {
  const repoRoot = process.env.REPO_ROOT ? path.resolve(process.env.REPO_ROOT) : process.cwd();
  const { ym: defaultYm } = getKstNowParts();
  const targetMonth = (process.env.TARGET_MONTH || defaultYm).trim();
  const gateKey = process.env.GATE_KEY;
  if (!gateKey) {
    throw new Error("GATE_KEY 환경변수가 누락되었습니다.");
  }

  const saJson = requireEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(saJson);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. (JSON 파싱 실패)");
  }

  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields: project_id, client_email, or private_key. (필수 필드 누락)");
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  const db = admin.firestore();

  const startId = gateKey === "pilot-gate" ? `${targetMonth}-01` : `${gateKey}:${targetMonth}-01`;
  const endId = gateKey === "pilot-gate" ? `${nextMonth(targetMonth)}-01` : `${gateKey}:${nextMonth(targetMonth)}-01`;

  let snap;
  try {
    snap = await db
      .collection("ops_daily_logs")
      .orderBy(admin.firestore.FieldPath.documentId())
      .startAt(startId)
      .endBefore(endId)
      .get();
  } catch (e) {
    if (e.code === 7 || (e.message && e.message.includes("PERMISSION_DENIED"))) {
      throw new Error(`Firestore 조회 실패 (PERMISSION_DENIED). 서비스 계정 권한 확인(Cloud Datastore/Firestore Viewer)이 필요합니다. 상세: ${e.message}`);
    }
    throw e;
  }

  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));

  const generatedAt = new Date().toISOString();
  const blockLines = [];
  blockLines.push(`<!-- generatedAt: ${generatedAt} -->`);
  blockLines.push(`<!-- source: Firestore collection ops_daily_logs, range [${startId}, ${endId}) -->`);
  blockLines.push("");

  if (docs.length === 0) {
    blockLines.push(`(자동 동기화) ${targetMonth}에 생성된 일일 로그 문서가 없습니다.`);
  } else {
    for (const { id, data } of docs) {
      const markdown = typeof data.markdown === "string" ? data.markdown.trim() : "";
      if (!markdown) {
        blockLines.push(`---`);
        blockLines.push("");
        blockLines.push(`<!-- ${id} -->`);
        blockLines.push("");
        blockLines.push(`(자동 동기화) ops_daily_logs/${id} 문서에 markdown 필드가 없습니다.`);
        blockLines.push("");
        continue;
      }

      blockLines.push(`---`);
      blockLines.push("");
      blockLines.push(`<!-- ${id} -->`);
      
      // 날짜 헤더(## YYYY-MM-DD) 강제
      const dateHeader = `## ${id}`;
      if (!markdown.startsWith(dateHeader)) {
        blockLines.push(dateHeader);
      }
      
      blockLines.push(markdown);
      blockLines.push("");
    }
  }

  const fileName = gateKey === "pilot-gate" ? `${targetMonth}-pilot-ops-log.md` : `${targetMonth}-${gateKey}-ops-log.md`;
  const relOutPath = path.join("spec", "00-index", fileName);
  const outPath = path.join(repoRoot, relOutPath);

  let existing = "";
  if (fs.existsSync(outPath)) {
    existing = fs.readFileSync(outPath, "utf-8");
  } else {
    // 신규 파일 생성 시 최소 헤더만 넣고 마커로 감싼다.
    existing = [
      `# 파일럿 일일 운영 로그`,
      ``,
      `목적: 파일럿 중 품질/흐름/저장/오류/처리시간을 매일 1회 고정 포맷으로 기록하고, Top3 이슈를 누적하여 에스컬레이션/백로그로 연결한다.`,
      ``,
      START_MARKER,
      END_MARKER,
      ``,
    ].join("\n");
  }

  const withMarkers = ensureMarkers(existing);
  const updated = replaceBetweenMarkers(withMarkers, blockLines.join("\n"));

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, updated, "utf-8");

  // 로그(액션 확인용) 및 GITHUB_OUTPUT 전달용
  // eslint-disable-next-line no-console
  console.log(`[ops_log_sync] Wrote: ${relOutPath} (days=${docs.length})`);
  
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `sync_days=${docs.length}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `sync_file=${relOutPath}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `sync_gateKey=${gateKey}\n`);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[ops_log_sync] Failed:", e);
  process.exit(1);
});

