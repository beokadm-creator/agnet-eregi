import { Express, Request, Response } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerApostilleRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 헬퍼: 접근 권한 확인
  async function checkCaseAccess(caseId: string, req: any, res: any) {
    const uid = req.user.uid;
    const isPartner = req.user.partnerId != null;
    const partnerId = req.user.partnerId;

    const doc = await db.collection("cases").doc(caseId).get();
    if (!doc.exists) {
      return { allowed: false, response: fail(res, 404, "NOT_FOUND", "해당 케이스를 찾을 수 없습니다.") };
    }

    const caseData = doc.data() as any;
    if (isPartner) {
      if (caseData.partnerId !== partnerId) {
        return { allowed: false, response: fail(res, 403, "FORBIDDEN", "이 케이스에 접근할 권한이 없습니다.") };
      }
    } else {
      if (caseData.userId !== uid) {
        return { allowed: false, response: fail(res, 403, "FORBIDDEN", "이 케이스에 접근할 권한이 없습니다.") };
      }
    }

    return { allowed: true, caseData };
  }

  // 1. 아포스티유 AI 감지 여부 조회 (EP-15)
  // GET /v1/cases/:caseId/documents/:docId/apostille
  app.get("/v1/cases/:caseId/documents/:docId/apostille", async (req: Request, res: Response) => {
    const caseId = String(req.params.caseId);
    const docId = String(req.params.docId);

    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const access = await checkCaseAccess(caseId, req, res);
      if (!access.allowed) return access.response;

      const docRef = db.collection("cases").doc(caseId).collection("documents").doc(docId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 문서를 찾을 수 없습니다.");
      }

      const docData = docSnap.data();
      const apostilleDetected = docData?.aiExtraction?.apostille_detected?.value || false;

      return ok(res, { 
        documentId: docId, 
        apostilleDetected,
        status: docData?.status || "unknown"
      });
    } catch (error: any) {
      return fail(res, 500, "INTERNAL", "아포스티유 정보 조회에 실패했습니다.");
    }
  });

  // 2. 아포스티유 수동 검수 결과 제출 (EP-15)
  // POST /v1/cases/:caseId/documents/:docId/apostille/verify
  app.post("/v1/cases/:caseId/documents/:docId/apostille/verify", async (req: Request, res: Response) => {
    const caseId = String(req.params.caseId);
    const docId = String(req.params.docId);
    const { verified, reason } = req.body;

    if (verified === undefined) {
      return fail(res, 400, "INVALID_ARGUMENT", "verified 필드가 필요합니다.");
    }

    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const access = await checkCaseAccess(caseId, req, res);
      if (!access.allowed) return access.response;

      const docRef = db.collection("cases").doc(caseId).collection("documents").doc(docId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 문서를 찾을 수 없습니다.");
      }

      // EP-15: 매뉴얼 리뷰 결과에 따른 상태 머신 전이
      const newStatus = verified ? "verified" : "rejected";
      const userUid = (req as any).user.uid;
      
      await docRef.update({
        "manualVerification.apostille": {
          verified,
          reason: reason || "",
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          verifiedBy: userUid
        },
        status: newStatus
      });

      await logOpsEvent(db, "APOSTILLE_MANUAL_VERIFIED", "SUCCESS", userUid, docId, "cases", {
        caseId,
        verified,
        reason
      });

      return ok(res, { success: true, status: newStatus });
    } catch (error: any) {
      return fail(res, 500, "INTERNAL", "아포스티유 리뷰 처리에 실패했습니다.");
    }
  });
}
