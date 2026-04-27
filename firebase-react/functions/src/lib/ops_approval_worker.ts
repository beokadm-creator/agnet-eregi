import * as admin from "firebase-admin";
import { executeRefund } from "./refund_executor";
import { getPayoutProvider } from "./payout_provider";
import { logOpsEvent } from "./ops_audit";

export async function processApprovalAction(db: admin.firestore.Firestore, approvalData: any, opsUid: string): Promise<void> {
  const { actionType, payload } = approvalData;

  if (actionType === "refund_execute") {
    // 환불 실행 로직
    if (payload?.refundId) {
      await executeRefund(db, payload.refundId, opsUid);
    } else {
      throw new Error("INVALID_ARGUMENT: 환불 실행을 위한 refundId가 페이로드에 없습니다.");
    }
  } else if (actionType === "settlement_pay") {
    // 정산 지급 트리거
    if (payload?.settlementId) {
      const settlementRef = db.collection("settlements").doc(payload.settlementId);
      
      await db.runTransaction(async (transaction) => {
        const settlementDoc = await transaction.get(settlementRef);
        if (!settlementDoc.exists) {
          throw new Error("NOT_FOUND: 해당 정산 건을 찾을 수 없습니다.");
        }
        const settlementData = settlementDoc.data() as any;
        
        if (settlementData.status !== "payable" && settlementData.status !== "pay_failed") {
          throw new Error(`FAILED_PRECONDITION: 현재 상태(${settlementData.status})에서는 지급 처리를 할 수 없습니다.`);
        }
        if (settlementData.isPaying) {
          throw new Error("FAILED_PRECONDITION: 이미 지급 처리가 진행 중입니다.");
        }
        
        transaction.update(settlementRef, {
          isPaying: true,
          lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
          approvedForPay: true,
          approvedBy: opsUid,
          approvedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      
      // 트랜잭션 외부에서 프로바이더 호출
      const settlementDoc = await settlementRef.get();
      const settlementData = settlementDoc.data() as any;
      
      const providerType = process.env.PAYOUT_PROVIDER || "manual";
      const provider = getPayoutProvider(providerType);
      
      const payoutResult = await provider.pay(payload.settlementId, settlementData.partnerPayable, settlementData.accountInfo || {});
      
      const attemptRef = db.collection("settlement_payout_attempts").doc(payoutResult.payoutAttemptId);
      await attemptRef.set({
        settlementId: payload.settlementId,
        provider: providerType,
        amount: settlementData.partnerPayable,
        success: payoutResult.success,
        error: payoutResult.error || null,
        providerRef: payoutResult.providerRef || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUid: opsUid,
      });

      if (!payoutResult.success) {
        await settlementRef.update({
          isPaying: false,
          status: "pay_failed",
          lastError: payoutResult.error || null,
        });

        await logOpsEvent(db, "SETTLEMENT_PAY_FAILED", "FAIL", opsUid, "approval-worker", settlementData.caseId, {
          settlementId: payload.settlementId,
          error: payoutResult.error || null,
          attemptId: payoutResult.payoutAttemptId,
        });

        throw new Error(`지급 실패: ${payoutResult.error}`);
      }

      const nextStatus = providerType === "manual" ? "manual_pending" : "paid";

      await settlementRef.update({
        isPaying: false,
        status: nextStatus,
        paidAt: nextStatus === "paid" ? admin.firestore.FieldValue.serverTimestamp() : null,
        paidByOpsUid: opsUid,
        providerRef: payoutResult.providerRef || null,
      });

      await logOpsEvent(db, "SETTLEMENT_MARKED_PAID", "SUCCESS", opsUid, "approval-worker", settlementData.caseId, {
        settlementId: payload.settlementId,
        partnerId: settlementData.partnerId,
        amount: settlementData.partnerPayable,
        providerRef: payoutResult.providerRef || null,
        status: nextStatus,
      });

    } else {
      throw new Error("INVALID_ARGUMENT: 정산 지급을 위한 settlementId가 페이로드에 없습니다.");
    }
  } else if (actionType === "quote_approve") {
    // 견적 초과 승인
    if (payload?.caseId && payload?.quoteId) {
      const quoteRef = db.collection("cases").doc(payload.caseId).collection("quotes").doc(payload.quoteId);
      const quoteDoc = await quoteRef.get();
      
      if (quoteDoc.exists && quoteDoc.data()?.status === "draft") {
        await quoteRef.update({
          status: "finalized",
          finalPrice: payload.finalPrice,
          assumptionsKo: payload.assumptionsKo || [],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          approvedByOps: opsUid
        });
      }
    }
  } else if (actionType === "partner_reassign") {
    // 파트너 재배정
    if (payload?.caseId && payload?.newPartnerId) {
      const caseRef = db.collection("cases").doc(payload.caseId);
      await caseRef.update({
        partnerId: payload.newPartnerId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }
}
