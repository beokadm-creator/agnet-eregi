import * as express from "express";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { ok, fail } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";
import { enqueueB2bWebhook } from "../../lib/b2b_webhook_worker";

function getJwtSecret(): string {
  const jwtSecret = process.env.B2B_JWT_SECRET
    || (process.env.FUNCTIONS_EMULATOR === "true" ? "dev-b2b-secret" : "");
  if (!jwtSecret) {
    throw new Error("B2B_JWT_SECRET is not configured");
  }
  return jwtSecret;
}

// JWT 발급 (HMAC SHA-256)
function signJwt(payload: any, expiresInSec: number, jwtSecret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const data = { ...payload, iat: now, exp: now + expiresInSec };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedData = Buffer.from(JSON.stringify(data)).toString("base64url");
  
  const signature = crypto.createHmac("sha256", jwtSecret)
    .update(`${encodedHeader}.${encodedData}`)
    .digest("base64url");
    
  return `${encodedHeader}.${encodedData}.${signature}`;
}

// JWT 검증
function verifyJwt(token: string, jwtSecret: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");
  
  const [encodedHeader, encodedData, signature] = parts;
  const expectedSignature = crypto.createHmac("sha256", jwtSecret)
    .update(`${encodedHeader}.${encodedData}`)
    .digest("base64url");
    
  if (signature !== expectedSignature) throw new Error("Invalid signature");
  
  const payload = JSON.parse(Buffer.from(encodedData, "base64url").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error("Token expired");
  
  return payload;
}

// B2B 인증 미들웨어
async function requireB2bAuth(adminApp: typeof admin, req: express.Request, res: express.Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    fail(res, 401, "UNAUTHENTICATED", "인증 토큰이 필요합니다.");
    return null;
  }
  
  const token = authHeader.split("Bearer ")[1];
  try {
    const payload = verifyJwt(token, getJwtSecret());
    return payload; // { clientId, companyName, ... }
  } catch (err: any) {
    if (err?.message === "B2B_JWT_SECRET is not configured") {
      fail(res, 500, "FAILED_PRECONDITION", "B2B 인증 설정이 완료되지 않았습니다. B2B_JWT_SECRET 환경변수가 필요합니다.");
      return null;
    }
    fail(res, 401, "UNAUTHENTICATED", "유효하지 않거나 만료된 토큰입니다.");
    return null;
  }
}

export function registerB2bRoutes(app: express.Application, adminApp: typeof admin) {
  // 5.1 인증 (Authentication)
  app.post("/v1/b2b/auth/token", async (req: express.Request, res: express.Response) => {
    try {
      const jwtSecret = getJwtSecret();
      const { clientId, clientSecret } = req.body;
      if (!clientId || !clientSecret) {
        return fail(res, 400, "INVALID_ARGUMENT", "clientId 및 clientSecret이 필요합니다.");
      }

      const db = adminApp.firestore();
      const clientDoc = await db.collection("b2b_api_clients").doc(clientId).get();

      if (!clientDoc.exists) {
        return fail(res, 401, "UNAUTHENTICATED", "유효하지 않은 clientId입니다.");
      }

      const clientData = clientDoc.data();
      if (clientData?.status !== "active") {
        return fail(res, 403, "FORBIDDEN", "사용이 중지된 계정입니다.");
      }

      // 평문 저장 금지 원칙에 따라 SHA-256 해시 비교 (MVP 단계에서는 평문도 임시 허용)
      const hashedSecret = crypto.createHash("sha256").update(clientSecret).digest("hex");
      if (clientData?.hashedSecret !== hashedSecret && clientData?.hashedSecret !== clientSecret) {
        return fail(res, 401, "UNAUTHENTICATED", "유효하지 않은 clientSecret입니다.");
      }

      const expiresIn = 3600; // 1시간
      const accessToken = signJwt({ clientId, companyName: clientData.companyName }, expiresIn, jwtSecret);

      return ok(res, { accessToken, expiresIn });
    } catch (err: any) {
      if (err?.message === "B2B_JWT_SECRET is not configured") {
        return fail(res, 500, "FAILED_PRECONDITION", "B2B 인증 설정이 완료되지 않았습니다. B2B_JWT_SECRET 환경변수가 필요합니다.");
      }
      return fail(res, 500, "INTERNAL", "토큰 발급에 실패했습니다.");
    }
  });

  // 5.2 케이스 관리 (Case Management) - 생성
  app.post("/v1/b2b/cases", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireB2bAuth(adminApp, req, res);
      if (!auth) return;

      const { caseType, customerInfo, metadata } = req.body;
      if (!caseType || !customerInfo) {
        return fail(res, 400, "INVALID_ARGUMENT", "caseType과 customerInfo는 필수입니다.");
      }

      const db = adminApp.firestore();
      const caseRef = db.collection("cases").doc();
      
      await caseRef.set({
        caseType,
        customerInfo,
        metadata: metadata || {},
        b2bClientId: auth.clientId,
        status: "pending",
        source: "b2b_api",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logOpsEvent(db, "b2b.case.created", "SUCCESS", auth.clientId, caseRef.id, "b2b", { caseType });

      // [EP-14] B2B Webhook Trigger
      await enqueueB2bWebhook(adminApp, auth.clientId, "case.created", {
        caseId: caseRef.id,
        caseType,
        status: "pending",
        metadata: metadata || {}
      });

      return ok(res, { caseId: caseRef.id, status: "pending" });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 5.2 케이스 관리 (Case Management) - 조회
  app.get("/v1/b2b/cases/:caseId", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireB2bAuth(adminApp, req, res);
      if (!auth) return;

      const caseId = String(req.params.caseId);
      const db = adminApp.firestore();

      const caseSnap = await db.collection("cases").doc(caseId).get();

      if (!caseSnap.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 케이스를 찾을 수 없습니다.");
      }

      const caseData = caseSnap.data()!;
      if (caseData.b2bClientId !== auth.clientId) {
        return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
      }

      return ok(res, { 
        caseId: caseSnap.id, 
        status: caseData.status,
        eta: caseData.eta || null,
        partnerId: caseData.partnerId || null
      });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 5.3 문서 및 증빙 (Documents & Evidence) - 서류 업로드 URL 발급
  app.post("/v1/b2b/cases/:caseId/documents", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireB2bAuth(adminApp, req, res);
      if (!auth) return;
      const clientId = auth.clientId;

      const caseId = String(req.params.caseId);
      const { type, filename, contentType, sizeBytes } = req.body;

      if (!type || !filename || !contentType) {
        return fail(res, 400, "INVALID_ARGUMENT", "type, filename, contentType은 필수입니다.");
      }

      const db = adminApp.firestore();
      const caseDoc = await db.collection("cases").doc(caseId).get();

      if (!caseDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
      }

      const caseData = caseDoc.data()!;
      if (caseData.b2bClientId !== clientId) {
        return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
      }

      const bucket = adminApp.storage().bucket();
      const docId = db.collection("documents").doc().id;
      const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const filePath = `cases/${caseId}/documents/${docId}_${safeFilename}`;

      const file = bucket.file(filePath);
      const [uploadUrl] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 15 * 60 * 1000, // 15분
        contentType,
      });

      const docRef = db.collection("cases").doc(caseId).collection("documents").doc(docId);
      await docRef.set({
        type,
        filename,
        contentType,
        sizeBytes: sizeBytes || 0,
        filePath,
        source: "b2b_api",
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logOpsEvent(db, "b2b.document.upload_url_generated", "SUCCESS", "system", caseId, "cases", {
        clientId,
        docId,
        type,
        filename
      });

      // [EP-14] B2B Webhook Trigger
      await enqueueB2bWebhook(adminApp, clientId, "document.upload_url_generated", {
        caseId,
        documentId: docId,
        type,
        filename
      });

      return ok(res, {
        documentId: docId,
        uploadUrl,
        expiresIn: 900
      });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 5.3 문서 및 증빙 (Documents & Evidence) - 결과물 다운로드 링크 조회
  app.get("/v1/b2b/cases/:caseId/documents", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireB2bAuth(adminApp, req, res);
      if (!auth) return;
      const clientId = auth.clientId;

      const caseId = String(req.params.caseId);
      const db = adminApp.firestore();
      
      const caseDoc = await db.collection("cases").doc(caseId).get();
      if (!caseDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
      }

      if (caseDoc.data()!.b2bClientId !== clientId) {
        return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
      }

      const docsSnap = await db.collection("cases").doc(caseId).collection("documents")
        .where("status", "in", ["validated", "ai_verified", "completed"])
        .get();

      const bucket = adminApp.storage().bucket();
      const documents = await Promise.all(docsSnap.docs.map(async (d) => {
        const data = d.data();
        let downloadUrl = null;

        try {
          if (data.filePath) {
            const file = bucket.file(data.filePath);
            const [url] = await file.getSignedUrl({
              version: "v4",
              action: "read",
              expires: Date.now() + 60 * 60 * 1000, // 1시간
            });
            downloadUrl = url;
          }
        } catch (e) {
          // Ignore
        }

        return {
          id: d.id,
          type: data.type,
          filename: data.filename,
          status: data.status,
          downloadUrl,
          createdAt: data.createdAt
        };
      }));

      return ok(res, { documents });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 5.4 Webhook 관리 - 등록
  app.post("/v1/b2b/webhooks", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireB2bAuth(adminApp, req, res);
      if (!auth) return;

      const { endpointUrl, subscribedEvents } = req.body;
      if (!endpointUrl || !Array.isArray(subscribedEvents)) {
        return fail(res, 400, "INVALID_ARGUMENT", "endpointUrl과 subscribedEvents(배열)가 필요합니다.");
      }

      const db = adminApp.firestore();
      const webhookRef = db.collection("b2b_webhooks").doc();
      const secretKey = crypto.randomBytes(32).toString("hex");

      await webhookRef.set({
        clientId: auth.clientId,
        endpointUrl,
        secretKey,
        subscribedEvents,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return ok(res, { webhookId: webhookRef.id, status: "active", secretKey });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 5.4 Webhook 관리 - 조회
  app.get("/v1/b2b/webhooks", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireB2bAuth(adminApp, req, res);
      if (!auth) return;

      const db = adminApp.firestore();
      const snap = await db.collection("b2b_webhooks")
        .where("clientId", "==", auth.clientId)
        .get();

      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return ok(res, { items });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });
}
