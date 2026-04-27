import { Express } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerPayablesRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 유저의 케이스 결제 요청 (청구서 생성) (POST /v1/cases/:caseId/payables)
  app.post("/v1/cases/:caseId/payables", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const uid = (req as any).user.uid;
    const isPartner = (req as any).user.partnerId != null;
    const caseId = String(req.params.caseId);
    // req.body에서 결제 수단(PG사 등)을 받을 수도 있음

    if (isPartner) {
      return fail(res, 403, "PERMISSION_DENIED", "결제 청구 생성은 유저만 가능합니다.", { requestId });
    }

    try {
      const caseRef = db.collection("cases").doc(caseId);
      const caseDoc = await caseRef.get();

      if (!caseDoc.exists || caseDoc.data()?.userId !== uid) {
        return fail(res, 404, "NOT_FOUND", "해당 케이스를 찾을 수 없거나 권한이 없습니다.", { requestId });
      }

      const caseData = caseDoc.data() as any;

      if (!caseData.acceptedQuoteId || !caseData.agreedAmount) {
        return fail(res, 400, "FAILED_PRECONDITION", "수락된 견적이 없어 결제를 진행할 수 없습니다.", { requestId });
      }

      // 이미 생성된 pending 상태의 payable이 있는지 확인 (중복 결제 방지)
      const existingPayables = await db.collection("payables")
        .where("caseId", "==", caseId)
        .where("status", "==", "pending")
        .get();

      if (!existingPayables.empty) {
        return fail(res, 400, "ALREADY_EXISTS", "이미 진행 중인 결제 요청이 있습니다.", { requestId });
      }

      // 새 청구서(Payable) 생성
      const payableRef = db.collection("payables").doc();
      const newPayable = {
        id: payableRef.id,
        caseId,
        userId: uid,
        partnerId: caseData.partnerId,
        amount: caseData.agreedAmount,
        status: "pending", // pending -> paid | failed | canceled
        pgProvider: "tosspayments", // 기본값 예시, 클라이언트에서 받아올 수도 있음
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await payableRef.set(newPayable);

      // 감사 로그 기록
      await logOpsEvent(db, "PAYABLE_CREATED", "SUCCESS", uid, requestId, caseId, {
        payableId: payableRef.id,
        amount: caseData.agreedAmount,
      });

      return ok(res, newPayable, requestId);
    } catch (error: any) {
      logError("POST /v1/cases/:caseId/payables", caseId, "INTERNAL", "청구서 생성 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "청구서 생성에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. 케이스의 청구서 내역 조회 (GET /v1/cases/:caseId/payables)
  app.get("/v1/cases/:caseId/payables", requireAuth, async (req, res) => {
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
        return fail(res, 403, "PERMISSION_DENIED", "권한이 없습니다.", { requestId });
      }
      if (!isPartner && caseData.userId !== uid) {
        return fail(res, 403, "PERMISSION_DENIED", "권한이 없습니다.", { requestId });
      }

      const snapshot = await db.collection("payables")
        .where("caseId", "==", caseId)
        .orderBy("createdAt", "desc")
        .get();

      const payables = snapshot.docs.map(doc => doc.data());

      return ok(res, { payables }, requestId);
    } catch (error: any) {
      logError("GET /v1/cases/:caseId/payables", caseId, "INTERNAL", "청구서 내역 조회 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "청구서 내역 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
