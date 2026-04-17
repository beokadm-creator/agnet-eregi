import process from "node:process";
import JSZip from "jszip";
import admin from "firebase-admin";
 
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "project-dev";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const STORAGE_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199";
const FUNCTIONS_BASE =
  process.env.FUNCTIONS_BASE || `http://127.0.0.1:5001/${PROJECT_ID}/asia-northeast3/api`;
 
function envAssert(name, value) {
  if (!value) throw new Error(`missing env: ${name}`);
  return value;
}
 
async function signUpAnonymously() {
  const url = `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`;
  const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!resp.ok) throw new Error(`auth signUp failed: ${resp.status} ${await resp.text()}`);
  const json = await resp.json();
  return { idToken: json.idToken, uid: json.localId };
}
 
async function downloadZip(caseId, idToken) {
  const url = `${FUNCTIONS_BASE}/v1/cases/${caseId}/packages/submission.zip`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!resp.ok) throw new Error(`zip download failed: ${resp.status} ${await resp.text()}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  return buf;
}

async function validatePackage(caseId, idToken) {
  const url = `${FUNCTIONS_BASE}/v1/cases/${caseId}/packages/validate`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!resp.ok) throw new Error(`validate API failed: ${resp.status} ${await resp.text()}`);
  return await resp.json();
}
 
async function main() {
  envAssert("FIREBASE_AUTH_EMULATOR_HOST", AUTH_HOST);
  envAssert("FIRESTORE_EMULATOR_HOST", FIRESTORE_HOST);
  envAssert("FIREBASE_STORAGE_EMULATOR_HOST", STORAGE_HOST);
 
  const { idToken, uid } = await signUpAnonymously();
 
  admin.initializeApp({ projectId: PROJECT_ID });
  admin.firestore().settings({ host: FIRESTORE_HOST, ssl: false });
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = STORAGE_HOST;
 
  const caseId = `case_${crypto.randomUUID()}`;
  const now = new Date();
 
  await admin.firestore().doc(`cases/${caseId}`).set({
    ownerUid: uid,
    partnerId: "p_demo_01",
    casePackId: "corp_officer_change_v1",
    status: "completed",
    createdAt: now,
    updatedAt: now,
    summary: { lastEventKo: "zip signed check", sessionId: null }
  });
 
  const signedSlots = [
    "slot_minutes_signed",
    "slot_power_of_attorney_signed",
    "slot_registration_application_signed",
    "slot_acceptance_letter_signed"
  ];
 
  const bucket = admin.storage().bucket();
  for (const slotId of signedSlots) {
    const documentId = `doc_${slotId}_${crypto.randomUUID()}`;
    const versionId = `dv_${crypto.randomUUID()}`;
    const storagePath = `cases/${caseId}/documents/${documentId}/${versionId}`;
    const fileName = `${slotId}.txt`;
 
    await bucket.file(storagePath).save(Buffer.from(`signed file content for ${slotId}`, "utf-8"), {
      contentType: "text/plain"
    });
 
    await admin.firestore().doc(`cases/${caseId}/documents/${documentId}`).set({
      caseId,
      documentId,
      ownerUid: uid,
      partnerId: "p_demo_01",
      slotId,
      status: "ok",
      latestVersionId: versionId,
      versions: {
        [versionId]: {
          versionId,
          fileName,
          mimeType: "text/plain",
          storagePath,
          sizeBytes: 123,
          createdAt: now
        }
      },
      updatedAt: now,
      review: { decision: "ok", issueCodes: [], issueSummariesKo: [] }
    });
  }

  // 접수증(filing_receipt) 추가
  const receiptId = `doc_slot_filing_receipt_${crypto.randomUUID()}`;
  const receiptVid = `dv_${crypto.randomUUID()}`;
  const receiptPath = `cases/${caseId}/documents/${receiptId}/${receiptVid}`;
  await bucket.file(receiptPath).save(Buffer.from(`receipt content`, "utf-8"), { contentType: "text/plain" });
  await admin.firestore().doc(`cases/${caseId}/documents/${receiptId}`).set({
    caseId,
    documentId: receiptId,
    ownerUid: uid,
    partnerId: "p_demo_01",
    slotId: "slot_filing_receipt",
    status: "ok",
    latestVersionId: receiptVid,
    versions: {
      [receiptVid]: { versionId: receiptVid, fileName: "receipt.txt", storagePath: receiptPath, createdAt: now }
    },
    updatedAt: now
  });

  const zipBuf = await downloadZip(caseId, idToken);
  const zip = await JSZip.loadAsync(zipBuf);
  const signedEntries = Object.keys(zip.files).filter((p) => p.startsWith("signed/"));
  const missingEntries = signedEntries.filter((p) => p.endsWith("_missing.txt") || p.endsWith("_download_failed.txt"));
 
  const presentFiles = signedEntries.filter((p) => !p.endsWith(".txt") || p.endsWith(".txt"));
  const contentChecks = [];
  for (const p of signedEntries.filter((p) => p.endsWith(".txt") && !p.includes("_missing") && !p.includes("_download_failed"))) {
    const content = await zip.file(p).async("string");
    contentChecks.push({ path: p, ok: content.includes("signed file content") });
  }

  const validateResult = await validatePackage(caseId, idToken);
  const evidenceId = validateResult.data?.evidenceId;
  
  if (evidenceId) {
    const evDoc = await admin.firestore().collection("pilot_gate_evidence").doc(evidenceId).get();
    if (!evDoc.exists) throw new Error(`Evidence document ${evidenceId} not found in Firestore`);
  } else {
    throw new Error(`validate API did not return evidenceId. Result: ${JSON.stringify(validateResult)}`);
  }

  const ok =
    validateResult.data?.ok === true &&
    missingEntries.length === 0 &&
    signedEntries.length >= signedSlots.length &&
    contentChecks.every((c) => c.ok);

  console.log(`\n[RESULT] caseId=${caseId}, evidenceId=${evidenceId}, status=${ok ? '✅' : '❌'}, missingCount=${validateResult.data?.missing?.length || 0}`);

  if (!ok) process.exit(2);
}
 
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
