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

  // 4) POST /v1/partner/cases/:caseId/evidences
  app.post("/v1/partner/cases/:caseId/evidences", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      
      const partnerId = partnerIdOf(auth);
      if (!partnerId) return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.");

      const caseId = String(req.params.caseId);
      const { type, fileUrl } = req.body;

      if (!type || !fileUrl) {
        return fail(res, 400, "INVALID_ARGUMENT", "type과 fileUrl이 필요합니다.");
      }

      const db = adminApp.firestore();
      const caseSnap = await db.collection("cases").doc(caseId).get();
      if (!caseSnap.exists || caseSnap.data()?.partnerId !== partnerId) {
        return fail(res, 404, "NOT_FOUND", "접근할 수 없는 케이스입니다.");
      }

      const evidenceRef = db.collection("evidences").doc();
      const newEvidence: CaseEvidence = {
        caseId,
        partnerId,
        type,
        fileUrl,
        status: "uploaded",
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

      return ok(res, { evidence: { id: evidenceRef.id, ...newEvidence } });
    } catch (err: any) {
      logError({ endpoint: "partner/evidences/create", code: "INTERNAL", messageKo: "증거 업로드 실패", err });
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