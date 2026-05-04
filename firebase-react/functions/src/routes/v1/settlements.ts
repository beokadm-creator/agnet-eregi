import { Express } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

import { getPayoutProvider } from "../../lib/payout_provider";
import { executeSettlementBatch } from "../../lib/settlement_batch_worker";

export function registerSettlementRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 파트너의 정산 내역 조회 (GET /v1/partners/:partnerId/settlements)
  app.get("/v1/partners/:partnerId/settlements", requireAuth, async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const reqPartnerId = req.user!.partnerId;
    const partnerId = String(req.params.partnerId);

    // 본인의 정산 내역만 조회 가능 (운영자는 별도 어드민 라우트 또는 권한 패스로 접근 가정)
    if (reqPartnerId !== partnerId) {
      return fail(res, 403, "PERMISSION_DENIED", "본인의 정산 내역만 조회할 수 있습니다.", { requestId });
    }

    try {
      const snapshot = await db.collection("settlements")
        .where("partnerId", "==", partnerId)
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

      const settlements = snapshot.docs.map(doc => doc.data());

      return ok(res, { settlements }, requestId);
    } catch (error: any) {
      logError("GET /v1/partners/:partnerId/settlements", "N/A", "INTERNAL", "정산 내역 조회 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "정산 내역 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. [운영자 전용] 정산 배치 실행 (POST /v1/ops/settlements/batch)
  app.post("/v1/ops/settlements/batch", requireAuth, async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const uid = req.user!.uid;
    const isOps = req.user!.isOps;
    const { periodEnd } = req.body; // e.g. "2026-05-31T23:59:59Z"

    if (!isOps) {
      return fail(res, 403, "PERMISSION_DENIED", "운영자만 접근 가능한 기능입니다.", { requestId });
    }

    if (!periodEnd) {
      return fail(res, 400, "INVALID_ARGUMENT", "periodEnd (ISO date string) 가 필요합니다.", { requestId });
    }

    try {
      const dateEnd = new Date(periodEnd);
      if (isNaN(dateEnd.getTime())) {
        return fail(res, 400, "INVALID_ARGUMENT", "유효한 날짜 형식이 아닙니다.", { requestId });
      }

      await executeSettlementBatch(db, dateEnd, uid);

      return ok(res, { message: "정산 배치가 완료되었습니다." }, requestId);
    } catch (error: any) {
      logError("POST /v1/ops/settlements/batch", "N/A", "INTERNAL", "정산 배치 실행 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "정산 배치 실행에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 3. [운영자 전용] 정산 상태 변경 (승인, 이체 완료 등) (POST /v1/ops/settlements/:settlementId/status)
  app.post("/v1/ops/settlements/:settlementId/status", requireAuth, async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const uid = req.user!.uid;
    const isOps = req.user!.isOps;
    const settlementId = String(req.params.settlementId);
    const { status, memoKo } = req.body;

    if (!isOps) {
      return fail(res, 403, "PERMISSION_DENIED", "운영자만 접근 가능한 기능입니다.", { requestId });
    }

    if (!["approved", "transferred"].includes(status)) {
      return fail(res, 400, "INVALID_ARGUMENT", "유효한 상태값이 아닙니다. (approved, transferred)", { requestId });
    }

    try {
      const stRef = db.collection("settlements").doc(settlementId);
      const stDoc = await stRef.get();

      if (!stDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 정산 건을 찾을 수 없습니다.", { requestId });
      }

      const data = stDoc.data() as any;

      if (status === "approved" && data.status !== "calculated") {
        return fail(res, 400, "FAILED_PRECONDITION", "calculated 상태에서만 approved로 변경 가능합니다.", { requestId });
      }

      if (status === "transferred" && data.status !== "approved") {
        return fail(res, 400, "FAILED_PRECONDITION", "approved 상태에서만 transferred로 변경 가능합니다.", { requestId });
      }

      await stRef.update({
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await logOpsEvent(db, "SETTLEMENT_STATUS_CHANGED", "SUCCESS", uid, requestId, "N/A", {
        settlementId,
        status,
        memoKo: memoKo || null
      });

      return ok(res, { id: settlementId, status }, requestId);
    } catch (error: any) {
      logError("POST /v1/ops/settlements/:settlementId/status", "N/A", "INTERNAL", "정산 상태 변경 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "정산 상태 변경에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 4. (기존 MVP 호환 유지) [운영자 전용] 특정 결제 건에 대한 정산금 확정 및 지급 처리 (POST /v1/ops/settlements/:settlementId/pay)
  // 실제 서비스에서는 케이스가 'completed' 상태가 된 후 워커가 자동으로 정산을 생성하고, 운영자가 승인하는 흐름을 가집니다.
  // 여기서는 MVP 형태로 결제/정산 정책(Clawback 등)을 다룰 수 있는 기반 엔드포인트를 제공합니다.
  app.post("/v1/ops/settlements/:settlementId/pay", requireAuth, async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const uid = req.user!.uid;
    const isOps = req.user!.isOps; // auth.ts에서 세팅된 운영자 플래그
    const settlementId = String(req.params.settlementId);

    if (!isOps) {
      return fail(res, 403, "PERMISSION_DENIED", "운영자만 접근 가능한 기능입니다.", { requestId });
    }

    try {
      const settlementRef = db.collection("settlements").doc(settlementId);
      const settlementDoc = await settlementRef.get();

      if (!settlementDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 정산 건을 찾을 수 없습니다.", { requestId });
      }

      const settlementData = settlementDoc.data() as any;

      if (settlementData.status !== "payable" && settlementData.status !== "pay_failed") {
        return fail(res, 400, "FAILED_PRECONDITION", `현재 상태(${settlementData.status})에서는 지급 처리를 할 수 없습니다.`, { requestId });
      }

      // 멱등성: 이미 지급 처리 중인지 확인
      if (settlementData.isPaying) {
        return fail(res, 400, "FAILED_PRECONDITION", "이미 지급 처리가 진행 중입니다.", { requestId });
      }

      await settlementRef.update({
        isPaying: true,
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 지급 프로바이더 초기화 (mock 또는 manual)
      const providerType = process.env.PAYOUT_PROVIDER || "manual";
      const provider = getPayoutProvider(providerType);
      
      const payoutResult = await provider.pay(settlementId, settlementData.partnerPayable, settlementData.accountInfo || {});

      // payout attempt 기록
      const attemptRef = db.collection("settlement_payout_attempts").doc(payoutResult.payoutAttemptId);
      await attemptRef.set({
        settlementId,
        provider: providerType,
        amount: settlementData.partnerPayable,
        success: payoutResult.success,
        error: payoutResult.error || null,
        providerRef: payoutResult.providerRef || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUid: uid,
      });

      if (!payoutResult.success) {
        await settlementRef.update({
          isPaying: false,
          status: "pay_failed",
          lastError: payoutResult.error,
        });

        await logOpsEvent(db, "SETTLEMENT_PAY_FAILED", "FAIL", uid, requestId, settlementData.caseId, {
          settlementId,
          error: payoutResult.error,
          attemptId: payoutResult.payoutAttemptId,
        });

        return fail(res, 500, "INTERNAL", "정산 지급 처리에 실패했습니다.", { error: payoutResult.error, requestId });
      }

      const nextStatus = providerType === "manual" ? "manual_pending" : "paid";

      await settlementRef.update({
        isPaying: false,
        status: nextStatus,
        paidAt: nextStatus === "paid" ? admin.firestore.FieldValue.serverTimestamp() : null,
        paidByOpsUid: uid,
        providerRef: payoutResult.providerRef,
      });

      await logOpsEvent(db, "SETTLEMENT_MARKED_PAID", "SUCCESS", uid, requestId, settlementData.caseId, {
        settlementId,
        partnerId: settlementData.partnerId,
        amount: settlementData.partnerPayable,
        providerRef: payoutResult.providerRef,
        status: nextStatus,
      });

      return ok(res, { id: settlementId, status: nextStatus }, requestId);
    } catch (error: any) {
      logError("POST /v1/ops/settlements/:settlementId/pay", "N/A", "INTERNAL", "정산 지급 처리 중 오류가 발생했습니다.", error, requestId);
      
      // 상태 복구 시도
      try {
        await db.collection("settlements").doc(settlementId).update({
          isPaying: false,
          status: "pay_failed",
          lastError: error.message,
        });
      } catch (e) {
        // ignore
      }

      return fail(res, 500, "INTERNAL", "정산 지급 처리에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
