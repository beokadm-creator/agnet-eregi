import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function envInt(name, fallback) {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || "demo-rp";
  const firestorePort = envInt("FIRESTORE_EMULATOR_PORT", 8080);
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || `127.0.0.1:${firestorePort}`;

  const rulesPath = path.resolve(__dirname, "..", "firestore.rules");
  const firestoreRules = await fs.readFile(rulesPath, "utf-8");

  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: firestoreHost.split(":")[0],
      port: Number(firestoreHost.split(":")[1]),
      rules: firestoreRules
    }
  });

  // seed: rules 우회로 데이터 생성
  const caseA = "caseA";
  const caseB = "caseB";
  const partnerP1 = "p1";
  const partnerP2 = "p2";
  const uidA = "userA";
  const uidB = "userB";

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`cases/${caseA}`).set({
      ownerUid: uidA,
      partnerId: partnerP1,
      casePackId: "corp_officer_change_v1",
      status: "in_progress",
      updatedAt: new Date()
    });
    await db.doc(`cases/${caseB}`).set({
      ownerUid: uidB,
      partnerId: partnerP2,
      casePackId: "corp_officer_change_v1",
      status: "in_progress",
      updatedAt: new Date()
    });

    // documents (collectionGroup query 대상)
    await db.doc(`cases/${caseA}/documents/docA1`).set({
      caseId: caseA,
      documentId: "docA1",
      ownerUid: uidA,
      partnerId: partnerP1,
      slotId: "slot_id_card",
      status: "uploaded",
      updatedAt: new Date()
    });
    await db.doc(`cases/${caseB}/documents/docB1`).set({
      caseId: caseB,
      documentId: "docB1",
      ownerUid: uidB,
      partnerId: partnerP2,
      slotId: "slot_id_card",
      status: "uploaded",
      updatedAt: new Date()
    });

    // quote/payment/refund (case 하위 read 확인용)
    await db.doc(`cases/${caseA}/quotes/q1`).set({ caseId: caseA, status: "draft", updatedAt: new Date() });
    await db.doc(`cases/${caseA}/payments/p1`).set({ caseId: caseA, status: "created", updatedAt: new Date() });
    await db.doc(`cases/${caseA}/refunds/r1`).set({ caseId: caseA, status: "requested", updatedAt: new Date() });
    await db.doc(`cases/${caseA}/payments/p1/events/evt1`).set({ pgEventId: "evt1", type: "PAYMENT_CAPTURED", receivedAt: new Date() });


    // approvals + idempotencyKeys
    await db.doc("approvals/appr2").set({
      gate: "quote_finalize",
      status: "pending",
      createdAt: new Date(),
      target: { type: "quote", caseId: caseA, quoteId: "q1" },
      requiredRole: "ops_approver",
      summaryKo: "견적 확정 승인 요청"
    });
    await db.doc("idempotencyKeys/cases.create:demo").set({
      scope: "cases.create",
      key: "demo",
      requestHash: "hash",
      status: "done",
      response: { caseId: "x" },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // sessions + events
    await db.doc("sessions/s1").set({
      ownerUid: uidA,
      locale: "ko",
      step: 0,
      answers: {},
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await db.doc("sessions/s1/events/e1").set({ type: "DEBUG", createdAt: new Date() });

    // settlements + receivables
    await db.doc("settlements/set1").set({
      partnerId: partnerP1,
      status: "created",
      period: { from: "2026-01-01", to: "2026-01-31" },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await db.doc(`partners/${partnerP1}/receivables/rec1`).set({
      partnerId: partnerP1,
      status: "open",
      amount: { amount: 5000, currency: "KRW" },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await db.doc(`partners/${partnerP1}/receivables/rec1/offsets/o1`).set({
      offsetId: "o1",
      settlementId: "set1",
      appliedAmount: { amount: 1000, currency: "KRW" },
      createdAt: new Date()
    });
    await db.doc(`partners/${partnerP1}/payables/summary`).set({
      partnerId: partnerP1,
      carryOverAmount: { amount: 7000, currency: "KRW" },
      updatedAt: new Date()
    });

    // filing info (case 하위)
    await db.doc(`cases/${caseA}/filing/main`).set({
      caseId: caseA,
      partnerId: partnerP1,
      receiptNo: "2026-12345",
      jurisdictionKo: "서울중앙지방법원",
      submittedDate: "2026-01-12",
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  const userA = testEnv.authenticatedContext(uidA, { role: "user" });
  const userB = testEnv.authenticatedContext(uidB, { role: "user" });
  const partner1 = testEnv.authenticatedContext("partnerUser1", { role: "partner", partnerId: partnerP1 });
  const partner2 = testEnv.authenticatedContext("partnerUser2", { role: "partner", partnerId: partnerP2 });
  const opsAgent = testEnv.authenticatedContext("ops1", { role: "ops_agent" });
  const opsApprover = testEnv.authenticatedContext("ops2", { role: "ops_approver" });

  // ===== tests =====
  // user A can read caseA
  await assert.doesNotReject(userA.firestore().doc(`cases/${caseA}`).get());
  // user A cannot read caseB
  await assert.rejects(userA.firestore().doc(`cases/${caseB}`).get());

  // partner1 can read caseA (assigned)
  await assert.doesNotReject(partner1.firestore().doc(`cases/${caseA}`).get());
  // partner1 cannot read caseB
  await assert.rejects(partner1.firestore().doc(`cases/${caseB}`).get());

  // ops can read all
  await assert.doesNotReject(opsAgent.firestore().doc(`cases/${caseA}`).get());
  await assert.doesNotReject(opsAgent.firestore().doc(`cases/${caseB}`).get());

  // approvals: read ops only
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("approvals/appr1").set({
      gate: "refund_approve",
      status: "pending",
      createdAt: new Date()
    });
  });
  await assert.doesNotReject(opsAgent.firestore().doc("approvals/appr1").get());
  await assert.rejects(userB.firestore().doc("approvals/appr1").get());
  await assert.rejects(partner2.firestore().doc("approvals/appr1").get());

  // approvals decision: ops_agent cannot update, ops_approver can update
  await assert.rejects(
    opsAgent.firestore().doc("approvals/appr1").update({ status: "approved" })
  );
  await assert.doesNotReject(
    opsApprover.firestore().doc("approvals/appr1").update({ status: "approved" })
  );

  // timeline: user cannot write
  await assert.rejects(
    userA.firestore().doc(`cases/${caseA}/timeline/t1`).set({
      type: "CASE_STATUS_CHANGED",
      occurredAt: new Date(),
      summaryKo: "테스트",
      actor: { type: "user", uid: uidA }
    })
  );

  // cases update: user cannot update (server-only)
  await assert.rejects(
    userA.firestore().doc(`cases/${caseA}`).update({ status: "completed" })
  );
  await assert.rejects(
    partner1.firestore().doc(`cases/${caseA}`).update({ status: "completed" })
  );

  // documents read: userA can read doc under caseA
  await assert.doesNotReject(userA.firestore().doc(`cases/${caseA}/documents/docA1`).get());
  // documents read: userA cannot read doc under caseB
  await assert.rejects(userA.firestore().doc(`cases/${caseB}/documents/docB1`).get());

  // partner collectionGroup documents query: partner1 can query its docs
  await assert.doesNotReject(
    partner1.firestore().collectionGroup("documents").where("partnerId", "==", partnerP1).get()
  );
  // user cannot collectionGroup query other partner docs (should fail due to rule)
  await assert.rejects(
    userB.firestore().collectionGroup("documents").where("partnerId", "==", partnerP1).get()
  );

  // quote/payment/refund read: userA/partner1/opsAgent can read under caseA, userB cannot
  await assert.doesNotReject(userA.firestore().doc(`cases/${caseA}/quotes/q1`).get());
  await assert.doesNotReject(partner1.firestore().doc(`cases/${caseA}/quotes/q1`).get());
  await assert.doesNotReject(opsAgent.firestore().doc(`cases/${caseA}/quotes/q1`).get());
  await assert.rejects(userB.firestore().doc(`cases/${caseA}/quotes/q1`).get());

  await assert.doesNotReject(userA.firestore().doc(`cases/${caseA}/payments/p1`).get());
  await assert.rejects(userB.firestore().doc(`cases/${caseA}/payments/p1`).get());
  await assert.doesNotReject(userA.firestore().doc(`cases/${caseA}/payments/p1/events/evt1`).get());
  await assert.rejects(userB.firestore().doc(`cases/${caseA}/payments/p1/events/evt1`).get());

  await assert.doesNotReject(userA.firestore().doc(`cases/${caseA}/refunds/r1`).get());
  await assert.rejects(userB.firestore().doc(`cases/${caseA}/refunds/r1`).get());

  // approvals read: ops only
  await assert.doesNotReject(opsAgent.firestore().doc("approvals/appr2").get());
  await assert.rejects(userA.firestore().doc("approvals/appr2").get());
  await assert.rejects(partner1.firestore().doc("approvals/appr2").get());

  // idempotencyKeys read/write: ops only
  await assert.doesNotReject(opsAgent.firestore().doc("idempotencyKeys/cases.create:demo").get());
  await assert.rejects(userA.firestore().doc("idempotencyKeys/cases.create:demo").get());
  await assert.rejects(partner1.firestore().doc("idempotencyKeys/cases.create:demo").get());
  await assert.rejects(userA.firestore().doc("idempotencyKeys/x").set({ a: 1 }));
  await assert.doesNotReject(opsAgent.firestore().doc("idempotencyKeys/x").set({ a: 1 }));

  // sessions/events: owner만 접근 가능
  await assert.doesNotReject(userA.firestore().doc("sessions/s1").get());
  await assert.rejects(userB.firestore().doc("sessions/s1").get());
  await assert.doesNotReject(userA.firestore().doc("sessions/s1/events/e2").set({ type: "DEBUG", createdAt: new Date() }));
  await assert.rejects(userB.firestore().doc("sessions/s1/events/e3").set({ type: "DEBUG", createdAt: new Date() }));

  // settlements: ops can read, partner can read own
  await assert.doesNotReject(opsAgent.firestore().doc("settlements/set1").get());
  await assert.doesNotReject(partner1.firestore().doc("settlements/set1").get());
  await assert.rejects(userA.firestore().doc("settlements/set1").get());
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("settlements/set1/items/i1").set({ type: "payment", createdAt: new Date() });
    await db.doc("settlements/set1/payouts/p1").set({ status: "succeeded", createdAt: new Date() });
  });
  await assert.doesNotReject(partner1.firestore().doc("settlements/set1/items/i1").get());
  await assert.rejects(userA.firestore().doc("settlements/set1/items/i1").get());

  // receivables: ops or that partner can read
  await assert.doesNotReject(opsAgent.firestore().doc(`partners/${partnerP1}/receivables/rec1`).get());
  await assert.doesNotReject(partner1.firestore().doc(`partners/${partnerP1}/receivables/rec1`).get());
  await assert.rejects(userA.firestore().doc(`partners/${partnerP1}/receivables/rec1`).get());

  // payables summary: ops or that partner can read
  await assert.doesNotReject(opsAgent.firestore().doc(`partners/${partnerP1}/payables/summary`).get());
  await assert.doesNotReject(partner1.firestore().doc(`partners/${partnerP1}/payables/summary`).get());
  await assert.rejects(userA.firestore().doc(`partners/${partnerP1}/payables/summary`).get());

  // settlement items: ops or that partner can read
  await assert.doesNotReject(opsAgent.firestore().doc("settlements/set1/items/i1").get());
  await assert.doesNotReject(partner1.firestore().doc("settlements/set1/items/i1").get());
  await assert.rejects(userA.firestore().doc("settlements/set1/items/i1").get());

  // settlement payouts: ops or that partner can read
  await assert.doesNotReject(opsAgent.firestore().doc("settlements/set1/payouts/p1").get());
  await assert.doesNotReject(partner1.firestore().doc("settlements/set1/payouts/p1").get());
  await assert.rejects(userA.firestore().doc("settlements/set1/payouts/p1").get());

  // filing info: participant can read, userB cannot
  await assert.doesNotReject(userA.firestore().doc(`cases/${caseA}/filing/main`).get());
  await assert.doesNotReject(partner1.firestore().doc(`cases/${caseA}/filing/main`).get());
  await assert.rejects(userB.firestore().doc(`cases/${caseA}/filing/main`).get());

  // receivable offsets: ops or that partner can read
  await assert.doesNotReject(opsAgent.firestore().doc(`partners/${partnerP1}/receivables/rec1/offsets/o1`).get());
  await assert.doesNotReject(partner1.firestore().doc(`partners/${partnerP1}/receivables/rec1/offsets/o1`).get());
  await assert.rejects(userA.firestore().doc(`partners/${partnerP1}/receivables/rec1/offsets/o1`).get());

  console.log("ok: rules smoke tests passed");

  await testEnv.cleanup();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
