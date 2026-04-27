import { Express } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerFilingRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 파트너가 등기/관공서 접수 완료 후 증거 자료(영수증/접수증 등) 제출 (POST /v1/cases/:caseId/filing)
  app.post("/v1/cases/:caseId/filing", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const uid = (req as any).user.uid;
    const isPartner = (req as any).user.partnerId != null;
    const reqPartnerId = (req as any).user.partnerId;
    const caseId = String(req.params.caseId);
    const { evidenceType, receiptNumber, fileUrl } = req.body;

    if (!isPartner) {
      return fail(res, 403, "PERMISSION_DENIED", "등기 접수 내역 제출은 파트너만 가능합니다.", { requestId });
    }

    try {
      const caseRef = db.collection("cases").doc(caseId);
      const caseDoc = await caseRef.get();

      if (!caseDoc.exists || caseDoc.data()?.partnerId !== reqPartnerId) {
        return fail(res, 404, "NOT_FOUND", "해당 케이스를 찾을 수 없거나 접근 권한이 없습니다.", { requestId });
      }

      const caseData = caseDoc.data() as any;

      // 접수 단계 진입 조건 확인 (예: 결제 완료 이후)
      if (caseData.status !== "awaiting_payment" && caseData.status !== "filing_submitted") {
        return fail(res, 400, "FAILED_PRECONDITION", "현재 케이스 상태에서는 등기 접수 내역을 제출할 수 없습니다.", { requestId, currentStatus: caseData.status });
      }

      // 접수 기록 저장 (하위 컬렉션 또는 메인 문서 업데이트)
      const filingRef = caseRef.collection("filings").doc();
      const newFiling = {
        id: filingRef.id,
        caseId,
        partnerId: reqPartnerId,
        evidenceType: evidenceType || "receipt", // 영수증, 접수증 등
        receiptNumber: receiptNumber || null,
        fileUrl: fileUrl || null,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await filingRef.set(newFiling);

      // (선택) workflow.ts의 "COMPLETE_FILING" 이벤트를 트리거하거나, 직접 상태 변경
      // 여기서는 접수 이력만 남기고, 상태 전이는 workflow 라우트를 호출하도록 가이드할 수 있습니다.
      
      await logOpsEvent(db, "FILING_EVIDENCE_SUBMITTED", "SUCCESS", uid, requestId, caseId, { filingId: filingRef.id });

      return ok(res, newFiling, requestId);
    } catch (error: any) {
      logError("POST /v1/cases/:caseId/filing", caseId, "INTERNAL", "접수 내역 제출 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "접수 내역 제출에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
