import { Express } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerFormRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 유저가 케이스 진행에 필요한 폼(동의서, 추가 정보 입력 등) 제출 (POST /v1/cases/:caseId/forms/:formType)
  app.post("/v1/cases/:caseId/forms/:formType", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const uid = (req as any).user.uid;
    const isPartner = (req as any).user.partnerId != null;
    const caseId = String(req.params.caseId);
    const formType = String(req.params.formType);
    const { formData } = req.body;

    if (isPartner) {
      return fail(res, 403, "PERMISSION_DENIED", "폼 제출은 유저만 가능합니다.", { requestId });
    }

    if (!formData || typeof formData !== "object") {
      return fail(res, 400, "INVALID_ARGUMENT", "유효한 폼 데이터(formData)가 필요합니다.", { requestId });
    }

    try {
      const caseRef = db.collection("cases").doc(caseId);
      const caseDoc = await caseRef.get();

      if (!caseDoc.exists || caseDoc.data()?.userId !== uid) {
        return fail(res, 404, "NOT_FOUND", "해당 케이스를 찾을 수 없거나 권한이 없습니다.", { requestId });
      }

      // 폼 데이터를 케이스 하위 컬렉션에 저장
      const formRef = caseRef.collection("forms").doc(formType);
      const newForm = {
        id: formRef.id,
        caseId,
        formType,
        formData,
        submittedBy: uid,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await formRef.set(newForm);

      // 감사 로그 기록
      await logOpsEvent(db, "FORM_SUBMITTED", "SUCCESS", uid, requestId, caseId, {
        formType,
      });

      return ok(res, newForm, requestId);
    } catch (error: any) {
      logError("POST /v1/cases/:caseId/forms/:formType", caseId, "INTERNAL", "폼 제출 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "폼 제출에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. 제출된 폼 내역 조회 (GET /v1/cases/:caseId/forms)
  app.get("/v1/cases/:caseId/forms", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const uid = (req as any).user.uid;
    const isPartner = (req as any).user.partnerId != null;
    const reqPartnerId = (req as any).user.partnerId;
    const caseId = String(req.params.caseId);

    try {
      const caseDoc = await db.collection("cases").doc(caseId).get();
      if (!caseDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 케이스를 찾을 수 없습니다.", { requestId });
      }

      const caseData = caseDoc.data() as any;

      if (isPartner && caseData.partnerId !== reqPartnerId) {
        return fail(res, 403, "PERMISSION_DENIED", "이 케이스의 폼을 조회할 권한이 없습니다.", { requestId });
      }
      if (!isPartner && caseData.userId !== uid) {
        return fail(res, 403, "PERMISSION_DENIED", "이 케이스의 폼을 조회할 권한이 없습니다.", { requestId });
      }

      const snapshot = await db.collection("cases").doc(caseId).collection("forms").get();
      const forms = snapshot.docs.map(doc => doc.data());

      return ok(res, { forms }, requestId);
    } catch (error: any) {
      logError("GET /v1/cases/:caseId/forms", caseId, "INTERNAL", "폼 내역 조회 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "폼 내역 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
