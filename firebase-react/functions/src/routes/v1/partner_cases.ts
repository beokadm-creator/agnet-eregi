import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, partnerIdOf } from "../../lib/auth";
import { fail, ok, logError } from "../../lib/http";
import { PartnerCase, CaseEvidence, CasePackage } from "../../lib/partner_models";

export function registerPartnerCaseRoutes(app: express.Application, adminApp: typeof admin) {

  // 1) POST /v1/partner/cases
  app.post("/v1/partner/cases", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const { title } = req.body;
      if (!title) return fail(res, 400, "INVALID_ARGUMENT", "title이 필요합니다.");

      const db = adminApp.firestore();
      const docRef = db.collection("cases").doc();
      
      const newCase: PartnerCase = {
        partnerId,
        title,
        status: "draft",
        createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      await docRef.set(newCase);
      
      return ok(res, { case: { id: docRef.id, ...newCase } });
    } catch (err: any) {
      logError({ endpoint: "partner/cases/create", code: "INTERNAL", messageKo: "케이스 생성 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 2) GET /v1/partner/cases
  app.get("/v1/partner/cases", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const db = adminApp.firestore();
      const snap = await db.collection("cases")
        .where("partnerId", "==", partnerId)
        .orderBy("updatedAt", "desc")
        .get();

      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "partner/cases/list", code: "INTERNAL", messageKo: "케이스 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 3) GET /v1/partner/cases/:caseId
  app.get("/v1/partner/cases/:caseId", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const caseId = String(req.params.caseId);
      const docSnap = await adminApp.firestore().collection("cases").doc(caseId).get();
      
      if (!docSnap.exists) {
        return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
      }
      
      const data = docSnap.data() as PartnerCase;
      if (data.partnerId !== partnerId) {
        return fail(res, 403, "FORBIDDEN", "본인의 케이스만 조회할 수 있습니다.");
      }

      return ok(res, { case: { id: docSnap.id, ...data } });
    } catch (err: any) {
      logError({ endpoint: "partner/cases/get", code: "INTERNAL", messageKo: "케이스 상세 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 4) POST /v1/partner/cases/:caseId/evidences/upload-url
  app.post("/v1/partner/cases/:caseId/evidences/upload-url", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const caseId = String(req.params.caseId);
      const { filename, contentType, sizeBytes, type } = req.body;

      if (!filename || !contentType || !sizeBytes || !type) {
        return fail(res, 400, "INVALID_ARGUMENT", "filename, contentType, sizeBytes, type이 필요합니다.");
      }

      // 검증
      if (sizeBytes > 25 * 1024 * 1024) {
        return fail(res, 400, "INVALID_ARGUMENT", "파일 크기는 25MB 이하여야 합니다.");
      }
      
      const allowedMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
      if (!allowedMimeTypes.includes(contentType)) {
        return fail(res, 400, "INVALID_ARGUMENT", "허용되지 않는 파일 형식입니다. (pdf, png, jpg 허용)");
      }

      // filename sanitize (간단한 영문/숫자/확장자만 남기기)
      const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, "_");

      const db = adminApp.firestore();
      const caseSnap = await db.collection("cases").doc(caseId).get();
      if (!caseSnap.exists || caseSnap.data()?.partnerId !== partnerId) {
        return fail(res, 404, "NOT_FOUND", "접근할 수 없는 케이스입니다.");
      }

      const evidenceRef = db.collection("evidences").doc();
      const storagePath = `evidence/${partnerId}/${caseId}/${evidenceRef.id}/${safeFilename}`;

      const newEvidence: CaseEvidence = {
        caseId,
        partnerId,
        type,
        fileUrl: safeFilename, // 아직 업로드 안 됨
        storagePath,
        status: "pending",
        filename: safeFilename,
        contentType,
        sizeBytes,
        createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      await evidenceRef.set(newEvidence);
      
      // Update case status to collecting if it was draft
      if (caseSnap.data()?.status === "draft") {
        await caseSnap.ref.update({
          status: "collecting",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // 서명된 URL 발급 (MVP 모사: 실제로는 Cloud Storage Signed URL 발급 필요)
      // Node.js 환경에서는 storage().bucket().file(path).getSignedUrl({ action: 'write', expires: ... }) 활용
      const bucket = adminApp.storage().bucket();
      const file = bucket.file(storagePath);
      
      const [uploadUrl] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 15 * 60 * 1000, // 15분
        contentType
      });

      return ok(res, { 
        uploadUrl, 
        evidenceId: evidenceRef.id, 
        storagePath 
      });
    } catch (err: any) {
      logError({ endpoint: "partner/evidences/upload-url", code: "INTERNAL", messageKo: "업로드 URL 발급 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 4-1) POST /v1/partner/cases/:caseId/evidences/:evidenceId/complete
  app.post("/v1/partner/cases/:caseId/evidences/:evidenceId/complete", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const { caseId, evidenceId } = req.params;
      const cId = String(caseId);
      const eId = String(evidenceId);

      const db = adminApp.firestore();
      const evidenceRef = db.collection("evidences").doc(eId);
      const snap = await evidenceRef.get();

      if (!snap.exists || snap.data()?.partnerId !== partnerId || snap.data()?.caseId !== cId) {
        return fail(res, 404, "NOT_FOUND", "접근할 수 없는 증거물입니다.");
      }

      const evData = snap.data() as CaseEvidence;

      // 파일 메타데이터 확인
      const bucket = adminApp.storage().bucket();
      if (!evData.storagePath) {
        return fail(res, 400, "FAILED_PRECONDITION", "Storage 경로가 지정되지 않았습니다.");
      }

      const file = bucket.file(evData.storagePath);
      const [exists] = await file.exists();
      
      if (!exists) {
        // 업로드 실패/누락 처리
        await evidenceRef.update({
          status: "failed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return fail(res, 404, "NOT_FOUND", "스토리지에 파일이 업로드되지 않았습니다.");
      }

      // 업로드 성공 확정
      await evidenceRef.update({
        status: "uploaded",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return ok(res, { message: "업로드 완료 확정됨", status: "uploaded" });
    } catch (err: any) {
      logError({ endpoint: "partner/evidences/complete", code: "INTERNAL", messageKo: "업로드 완료 처리 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 4-2) POST /v1/partner/cases/:caseId/evidences/:evidenceId/download-url
  app.post("/v1/partner/cases/:caseId/evidences/:evidenceId/download-url", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const { caseId, evidenceId } = req.params;
      const cId = String(caseId);
      const eId = String(evidenceId);

      const db = adminApp.firestore();
      const evidenceRef = db.collection("evidences").doc(eId);
      const snap = await evidenceRef.get();

      if (!snap.exists || snap.data()?.partnerId !== partnerId || snap.data()?.caseId !== cId) {
        return fail(res, 404, "NOT_FOUND", "접근할 수 없는 증거물입니다.");
      }

      const evData = snap.data() as CaseEvidence;
      if (!evData.storagePath) {
        return fail(res, 404, "NOT_FOUND", "스토리지 경로가 없습니다.");
      }

      const bucket = adminApp.storage().bucket();
      const file = bucket.file(evData.storagePath);
      const [exists] = await file.exists();
      
      if (!exists) {
        return fail(res, 404, "NOT_FOUND", "파일이 삭제되었거나 존재하지 않습니다.");
      }

      const [downloadUrl] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 15 * 60 * 1000 // 15분
      });

      return ok(res, { downloadUrl });
    } catch (err: any) {
      logError({ endpoint: "partner/evidences/download-url", code: "INTERNAL", messageKo: "다운로드 URL 발급 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 5) GET /v1/partner/cases/:caseId/evidences
  app.get("/v1/partner/cases/:caseId/evidences", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const caseId = String(req.params.caseId);
      const db = adminApp.firestore();

      // Scope checking is done by matching both caseId and partnerId in the query
      const snap = await db.collection("evidences")
        .where("caseId", "==", caseId)
        .where("partnerId", "==", partnerId)
        .orderBy("createdAt", "desc")
        .get();

      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "partner/evidences/list", code: "INTERNAL", messageKo: "증거 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 6) POST /v1/partner/cases/:caseId/packages
  app.post("/v1/partner/cases/:caseId/packages", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const caseId = String(req.params.caseId);
      const db = adminApp.firestore();
      
      const caseRef = db.collection("cases").doc(caseId);
      const caseSnap = await caseRef.get();
      
      if (!caseSnap.exists || caseSnap.data()?.partnerId !== partnerId) {
        return fail(res, 404, "NOT_FOUND", "접근할 수 없는 케이스입니다.");
      }

      // Check if there's at least one validated evidence
      const evSnap = await db.collection("evidences")
        .where("caseId", "==", caseId)
        .where("status", "==", "validated")
        .limit(1)
        .get();

      if (evSnap.empty) {
        return fail(res, 400, "FAILED_PRECONDITION", "패키지를 생성하려면 최소 1개 이상의 검증된(validated) 증거물이 필요합니다.");
      }

      const pkgRef = db.collection("packages").doc();
      const newPackage: CasePackage = {
        caseId,
        partnerId,
        status: "queued",
        createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      const batch = db.batch();
      batch.set(pkgRef, newPackage);
      batch.update(caseRef, {
        status: "packaging",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      return ok(res, { package: { id: pkgRef.id, ...newPackage } });
    } catch (err: any) {
      logError({ endpoint: "partner/packages/create", code: "INTERNAL", messageKo: "패키지 생성 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 7) POST /v1/partner/cases/:caseId/packages/:packageId/regenerate
  app.post("/v1/partner/cases/:caseId/packages/:packageId/regenerate", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const { caseId, packageId } = req.params;
      const cId = String(caseId);
      const pId = String(packageId);
      const db = adminApp.firestore();
      
      const pkgRef = db.collection("packages").doc(pId);
      const pkgSnap = await pkgRef.get();
      
      if (!pkgSnap.exists || pkgSnap.data()?.partnerId !== partnerId || pkgSnap.data()?.caseId !== cId) {
        return fail(res, 404, "NOT_FOUND", "접근할 수 없는 패키지입니다.");
      }

      await pkgRef.update({
        status: "queued",
        error: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return ok(res, { message: "재생성 요청 큐에 추가됨" });
    } catch (err: any) {
      logError({ endpoint: "partner/packages/regenerate", code: "INTERNAL", messageKo: "패키지 재생성 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 8) POST /v1/partner/cases/:caseId/packages/:packageId/download-url
  app.post("/v1/partner/cases/:caseId/packages/:packageId/download-url", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const { caseId, packageId } = req.params;
      const cId = String(caseId);
      const pId = String(packageId);

      const db = adminApp.firestore();
      const pkgSnap = await db.collection("packages").doc(pId).get();

      if (!pkgSnap.exists || pkgSnap.data()?.partnerId !== partnerId || pkgSnap.data()?.caseId !== cId) {
        return fail(res, 404, "NOT_FOUND", "접근할 수 없는 패키지입니다.");
      }

      const pkg = pkgSnap.data() as any;
      if (pkg.status !== "ready") {
        return fail(res, 400, "FAILED_PRECONDITION", "ready 상태의 패키지만 다운로드할 수 있습니다.");
      }

      if (!pkg.artifactPath || !pkg.checksumSha256) {
        return fail(res, 500, "INTERNAL", "artifactPath 또는 checksumSha256 누락");
      }

      const bucket = adminApp.storage().bucket();
      const file = bucket.file(pkg.artifactPath);
      const [exists] = await file.exists();

      if (!exists) {
        return fail(res, 404, "NOT_FOUND", "아티팩트 파일이 존재하지 않습니다.");
      }

      const [downloadUrl] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 15 * 60 * 1000
      });

      return ok(res, { downloadUrl, checksumSha256: pkg.checksumSha256 });
    } catch (err: any) {
      logError({ endpoint: "partner/packages/download-url", code: "INTERNAL", messageKo: "패키지 다운로드 URL 발급 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 8) GET /v1/partner/cases/:caseId/packages
  app.get("/v1/partner/cases/:caseId/packages", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const caseId = String(req.params.caseId);
      const db = adminApp.firestore();

      const snap = await db.collection("packages")
        .where("caseId", "==", caseId)
        .where("partnerId", "==", partnerId)
        .orderBy("createdAt", "desc")
        .get();

      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "partner/packages/list", code: "INTERNAL", messageKo: "패키지 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

}
