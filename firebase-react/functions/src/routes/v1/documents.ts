import { Express, Request, Response } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerDocumentRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();
  const bucket = adminApp.storage().bucket();

  /**
   * 내부 헬퍼 함수: 케이스 접근 권한(소유권 및 할당 여부) 검증
   */
  async function checkCaseAccess(caseId: string, req: any, res: any, requestId: string) {
    const uid = req.user!.uid;
    const isPartner = req.user!.partnerId != null;
    const partnerId = req.user!.partnerId;

    const doc = await db.collection("cases").doc(caseId).get();
    if (!doc.exists) {
      return { allowed: false, response: fail(res, 404, "NOT_FOUND", "해당 케이스를 찾을 수 없습니다.", { requestId }) };
    }

    const caseData = doc.data() as any;
    if (isPartner) {
      if (caseData.partnerId !== partnerId) {
        return { allowed: false, response: fail(res, 403, "FORBIDDEN", "이 케이스에 접근할 권한이 없습니다.", { requestId }) };
      }
    } else {
      if (caseData.userId !== uid) {
        return { allowed: false, response: fail(res, 403, "FORBIDDEN", "이 케이스에 접근할 권한이 없습니다.", { requestId }) };
      }
    }

    return { allowed: true, caseData };
  }

  // 1. 특정 케이스의 문서 목록(슬롯) 조회 (GET /v1/cases/:caseId/documents)
  app.get("/v1/cases/:caseId/documents", requireAuth, async (req: Request, res: Response) => {
    const requestId = req.requestId || "req-unknown";
    const caseId = req.params.caseId as string;

    try {
      const access = await checkCaseAccess(caseId, req, res, requestId);
      if (!access.allowed) return access.response;

      const snapshot = await db.collection("cases").doc(caseId).collection("documents").get();
      const documents = snapshot.docs.map(doc => doc.data());

      return ok(res, { documents });
    } catch (error: any) {
      logError({
        endpoint: "GET /v1/cases/:caseId/documents",
        caseId,
        code: "INTERNAL",
        messageKo: "문서 목록 조회 중 오류가 발생했습니다.",
        err: error
      });
      return fail(res, 500, "INTERNAL", "문서 목록 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. 문서 업로드용 Presigned URL 발급 (POST /v1/cases/:caseId/documents/upload-url)
  app.post("/v1/cases/:caseId/documents/upload-url", requireAuth, async (req: Request, res: Response) => {
    const requestId = req.requestId || "req-unknown";
    const uid = req.user!.uid;
    const caseId = req.params.caseId as string;
    const { docType, fileName, contentType } = req.body;

    if (!docType || !fileName) {
      return fail(res, 400, "INVALID_ARGUMENT", "문서 타입(docType)과 파일명(fileName)이 필요합니다.", { requestId });
    }

    try {
      const access = await checkCaseAccess(caseId, req, res, requestId);
      if (!access.allowed) return access.response;

      const timestamp = Date.now();
      const filePath = `cases/${caseId}/${docType}_${timestamp}_${fileName}`;
      const file = bucket.file(filePath);

      const [uploadUrl] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 15 * 60 * 1000,
        contentType: contentType || "application/octet-stream",
      });

      const docRef = db.collection("cases").doc(caseId).collection("documents").doc();
      const newDocument = {
        id: docRef.id,
        caseId,
        docType,
        fileName,
        filePath,
        status: "uploaded",
        uploadedBy: uid,
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await docRef.set(newDocument);

      await logOpsEvent(admin, {
        action: "DOCUMENT_UPLOAD_URL_GENERATED",
        status: "success",
        actorUid: uid,
        requestId,
        summary: `문서 업로드 URL 발급됨 (${docType})`,
        target: { caseId, docId: docRef.id, docType }
      });

      return ok(res, { uploadUrl, document: newDocument });
    } catch (error: any) {
      logError({
        endpoint: "POST /v1/cases/:caseId/documents/upload-url",
        caseId,
        code: "INTERNAL",
        messageKo: "업로드 URL 발급 중 오류가 발생했습니다.",
        err: error
      });
      return fail(res, 500, "INTERNAL", "업로드 URL 발급에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 3. 문서 상태 변경 (승인 / 반려) (PATCH /v1/cases/:caseId/documents/:docId/status)
  app.patch("/v1/cases/:caseId/documents/:docId/status", requireAuth, async (req: Request, res: Response) => {
    const requestId = req.requestId || "req-unknown";
    const uid = req.user!.uid;
    const isPartner = req.user!.partnerId != null;
    const caseId = req.params.caseId as string;
    const docId = req.params.docId as string;
    const { status, rejectReason } = req.body;

    if (!isPartner) {
      return fail(res, 403, "FORBIDDEN", "문서 상태를 변경할 권한이 없습니다 (파트너 전용).", { requestId });
    }

    if (!["approved", "rejected"].includes(status)) {
      return fail(res, 400, "INVALID_ARGUMENT", "올바르지 않은 상태값입니다 (approved 또는 rejected).", { requestId });
    }

    if (status === "rejected" && !rejectReason) {
      return fail(res, 400, "INVALID_ARGUMENT", "반려 시 사유(rejectReason)가 필요합니다.", { requestId });
    }

    try {
      const access = await checkCaseAccess(caseId, req, res, requestId);
      if (!access.allowed) return access.response;

      const docRef = db.collection("cases").doc(caseId).collection("documents").doc(docId);
      const docSnapshot = await docRef.get();

      if (!docSnapshot.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 문서를 찾을 수 없습니다.", { requestId });
      }

      const updateData: any = {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedBy: uid,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (status === "rejected") {
        updateData.rejectReason = rejectReason;
        const currentRejectCount = docSnapshot.data()?.rejectCount || 0;
        updateData.rejectCount = currentRejectCount + 1;
      }

      await docRef.update(updateData);

      const auditEventName = status === "approved" ? "DOCUMENT_APPROVED" : "DOCUMENT_REJECTED";
      await logOpsEvent(admin, {
        action: auditEventName,
        status: "success",
        actorUid: uid,
        requestId,
        summary: `문서 ${status === "approved" ? "승인됨" : "반려됨"}`,
        target: { caseId, docId, rejectReason }
      });

      return ok(res, { id: docId, status });
    } catch (error: any) {
      logError({
        endpoint: "PATCH /v1/cases/:caseId/documents/:docId/status",
        caseId,
        code: "INTERNAL",
        messageKo: "문서 상태 변경 중 오류가 발생했습니다.",
        err: error
      });
      return fail(res, 500, "INTERNAL", "문서 상태 변경에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
