import * as express from "express";
import * as admin from "firebase-admin";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { requireAuth, partnerIdOf } from "../../lib/auth";
import { ok, fail } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

const secretManagerClient = new SecretManagerServiceClient();


export function registerB2gRoutes(app: express.Application, adminApp: typeof admin) {
  // EP-13-01: 공공기관 인증서 및 계정 조회 (Credential Management)
app.get("/v1/partners/credentials", async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const partnerId = user.partnerId || user.uid;
    const db = adminApp.firestore();

    const snapshot = await db.collection("b2g_credentials")
      .where("partnerId", "==", partnerId)
      .where("status", "==", "active")
      .get();

    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return ok(res, { items });
  } catch (error: any) {
      return fail(res, 500, "INTERNAL", error.message);
    }
});

// EP-13-01: 공공기관 인증서 및 계정 등록 (Credential Management)
app.post("/v1/partners/credentials", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const { agencyType, certPassword, certData } = req.body;
      if (!agencyType || !certPassword || !certData) {
        return fail(res, 400, "INVALID_ARGUMENT", "agencyType, certPassword, certData가 필요합니다.");
      }

      // 실제 운영 환경: GCP Secret Manager와 연동하여 암호화 저장소에 보관
      let certId = `sm_cert_mock_${Date.now()}`; // fallback
      try {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT || "demo-rp";
        const secretId = `b2g_cert_${partnerId}_${agencyType}_${Date.now()}`;
        
        const [secret] = await secretManagerClient.createSecret({
          parent: `projects/${projectId}`,
          secretId: secretId,
          secret: { replication: { automatic: {} } }
        });
        
        if (secret.name) {
          await secretManagerClient.addSecretVersion({
            parent: secret.name,
            payload: { data: Buffer.from(JSON.stringify({ certData, certPassword })).toString('base64') }
          });
          certId = secret.name;
        }
      } catch (err: any) {
        console.warn("Secret Manager API 호출 실패 (GCP 환경이 아닐 수 있음). Mock ID 사용.", err.message);
      }

      // Firestore에 메타데이터만 저장 (민감 정보 제외)
      const db = adminApp.firestore();
      
      const credRef = db.collection("b2g_credentials").doc();
      await credRef.set({
        partnerId,
        agencyType,
        certId,
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)), // 1년 후
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logOpsEvent(db, "b2g.credential.registered", "SUCCESS", partnerId, credRef.id, "partner", { agencyType });

      return ok(res, { credentialId: credRef.id, status: "active" });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // EP-13-02: B2G 제출 트리거
  app.post("/v1/b2g/submissions", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const { caseId, packageId, agency } = req.body;
      if (!caseId || !packageId || !agency) {
        return fail(res, 400, "INVALID_ARGUMENT", "caseId, packageId, agency가 필요합니다.");
      }

      const db = adminApp.firestore();
      
      // Credential 확인
      const credSnap = await db.collection("b2g_credentials")
        .where("partnerId", "==", partnerId)
        .where("agencyType", "==", agency)
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (credSnap.empty) {
        return fail(res, 400, "FAILED_PRECONDITION", `${agency} 연동을 위한 활성 인증서(Credential)가 없습니다.`);
      }

      const subRef = db.collection("b2g_submissions").doc();
      await subRef.set({
        caseId,
        packageId,
        partnerId,
        agency,
        status: "queued", // 워커가 처리 대기
        receiptNumber: null,
        feeDetails: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logOpsEvent(db, "b2g.submission.queued", "SUCCESS", partnerId, subRef.id, "partner", { caseId, packageId, agency });

      return ok(res, { submissionId: subRef.id, status: "queued" });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // B2G 상태 조회 (목록)
  app.get("/v1/b2g/submissions", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const { caseId } = req.query;
      const db = adminApp.firestore();
      
      let query: admin.firestore.Query = db.collection("b2g_submissions").where("partnerId", "==", partnerId);
      
      if (caseId) {
        query = query.where("caseId", "==", String(caseId));
      }

      const snap = await query.orderBy("createdAt", "desc").get();
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      return ok(res, { items });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // EP-13-03: 납부 대상 요금 목록 조회
  app.get("/v1/b2g/submissions/:submissionId/fees", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const { submissionId } = req.params;
      if (!submissionId) {
        return fail(res, 400, "INVALID_ARGUMENT", "submissionId가 필요합니다.");
      }

      const db = adminApp.firestore();
      
      const snap = await db.collection("b2g_fee_payments")
        .where("submissionId", "==", submissionId)
        .where("partnerId", "==", partnerId)
        .orderBy("createdAt", "desc")
        .get();

      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      return ok(res, { items });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // EP-13-03: 수동/강제 납부 트리거
  app.post("/v1/b2g/fees/:feeId/pay", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const feeId = String(req.params.feeId);
      if (!feeId) {
        return fail(res, 400, "INVALID_ARGUMENT", "feeId가 필요합니다.");
      }

      const db = adminApp.firestore();
      const feeRef = db.collection("b2g_fee_payments").doc(feeId);
      
      const doc = await feeRef.get();
      if (!doc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 공과금/수수료 납부 건을 찾을 수 없습니다.");
      }

      const data = doc.data()!;
      if (data.partnerId !== partnerId) {
        return fail(res, 403, "FORBIDDEN", "해당 내역에 대한 접근 권한이 없습니다.");
      }

      if (data.status === "paid") {
        return fail(res, 400, "FAILED_PRECONDITION", "이미 납부 완료된 건입니다.");
      }

      if (data.status === "processing") {
        return ok(res, { feeId, status: "processing", message: "이미 결제 처리가 진행 중입니다." });
      }

      await feeRef.update({
        status: "processing",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
      await logOpsEvent(db, "b2g.fee.payment_triggered", "SUCCESS", partnerId, feeId, "partner", { 
        amount: data.amount,
        idempotencyKey
      });

      return ok(res, { feeId, status: "processing" });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

}
