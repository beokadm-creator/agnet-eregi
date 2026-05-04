const admin = require("firebase-admin");
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

admin.initializeApp({ projectId: "demo-rp" });
const db = admin.firestore();

async function run() {
  const docRef = db.collection("ops_daily_logs").doc("2026-04-19");
  try {
    await docRef.create({
      date: "2026-04-19",
      markdown: "test",
      metrics: { total: 0 },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("200 OK");
  } catch (e) {
    if (e.code === 6 || e.message.includes("ALREADY_EXISTS")) {
      console.log("409 CONFLICT");
    } else {
      console.error(e);
    }
  }
}
run();
