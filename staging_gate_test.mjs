import process from "node:process";
import admin from "firebase-admin";

const PROJECT_ID = "agent-eregi";
const API_KEY = "AIzaSyAaVp-7itlHDgHlLvkZAb5k8ZXh-GiRaMo";
const FUNCTIONS_BASE = "https://asia-northeast3-agent-eregi.cloudfunctions.net/api";

admin.initializeApp({ projectId: PROJECT_ID });

async function getEmailPasswordIdToken() {
  const email = `test_${Date.now()}@example.com`;
  const password = "password123";
  
  const userRecord = await admin.auth().createUser({
    email,
    password,
  });

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  if (!resp.ok) throw new Error(`auth sign in failed: ${resp.status} ${await resp.text()}`);
  const json = await resp.json();
  return { idToken: json.idToken, uid: userRecord.uid };
}

async function validatePackage(caseId, idToken) {
  const url = `${FUNCTIONS_BASE}/v1/cases/${caseId}/packages/validate`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!resp.ok) throw new Error(`validate API failed: ${resp.status} ${await resp.text()}`);
  return await resp.json();
}

async function main() {
  const { idToken, uid } = await getEmailPasswordIdToken();

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

  const bucket = admin.storage().bucket(`${PROJECT_ID}.firebasestorage.app`);
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

  const validateResult = await validatePackage(caseId, idToken);
  const evidenceId = validateResult.data?.evidenceId;
  
  if (evidenceId) {
    const evDoc = await admin.firestore().collection("pilot_gate_evidence").doc(evidenceId).get();
    if (!evDoc.exists) throw new Error(`Evidence document ${evidenceId} not found in Firestore`);
  } else {
    throw new Error(`validate API did not return evidenceId. Result: ${JSON.stringify(validateResult)}`);
  }

  const ok = validateResult.data?.ok === true && (validateResult.data?.missing?.length || 0) === 0;

  console.log(`[Pilot Gate] caseId: ${caseId} | evidenceId: ${evidenceId} | status: ${ok ? '✅' : '❌'} | missing: ${validateResult.data?.missing?.length || 0}`);

  if (!ok) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
