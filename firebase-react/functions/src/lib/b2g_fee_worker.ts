import * as admin from "firebase-admin";
import { logOpsEvent } from "./ops_audit";
import { enqueueNotification } from "./notify_trigger";
import { getTossPaymentsSettings, tossBillingPayment } from "./tosspayments";

/**
 * [EP-13-03] B2G Fee Parsing Worker
 * B2G 제출 건이 진행 중이거나 보정명령 상태일 때 부과된 세금/수수료 내역을 파싱하여
 * 시스템 내 결제 대기열(b2g_fee_payments)에 등록합니다.
 */
export async function processB2gFeeParsing(adminApp: typeof admin) {
  const db = adminApp.firestore();

  // "submitted" 또는 "action_required" 상태인 제출 건을 주기적으로 스캔하여 납부 항목 파싱
  const snap = await db.collection("b2g_submissions")
    .where("status", "in", ["submitted", "action_required"])
    .limit(20)
    .get();

  for (const doc of snap.docs) {
    const submission = doc.data();
    
    // MVP Mock: 30% 확률로 세금/수수료 납부 고지 발생
    if (Math.random() < 0.3) {
      // 이미 해당 제출 건에 대해 생성된 pending 요금이 있는지 확인 (멱등성)
      const existingFeeSnap = await db.collection("b2g_fee_payments")
        .where("submissionId", "==", doc.id)
        .where("status", "in", ["pending", "processing", "paid"])
        .get();

      if (existingFeeSnap.empty) {
        // 임의의 금액과 납부 번호 생성
        const amount = Math.floor(Math.random() * 200000) + 50000; 
        const paymentNumber = `0123-4567-${Date.now().toString().slice(-4)}`;

        const feeRef = db.collection("b2g_fee_payments").doc();
        await feeRef.set({
          submissionId: doc.id,
          caseId: submission.caseId,
          partnerId: submission.partnerId,
          feeType: "tax",
          agency: submission.agency,
          paymentNumber,
          amount,
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 타임라인용 이벤트 로깅
        await logOpsEvent(db, "b2g.fee.issued", "SUCCESS", "system", feeRef.id, "system", { 
          submissionId: doc.id, 
          amount, 
          paymentNumber 
        });

        // 파트너에게 공과금 납부 필요 알림 발송 (선택사항)
        // await enqueueNotification(...)
      }
    }
  }
}

/**
 * [EP-13-03] B2G Fee Payment Worker
 * 파트너의 등록된 결제 수단을 활용해 대기 중인 세금/공과금을 자동 납부합니다.
 */
export async function processB2gFeePayments(adminApp: typeof admin) {
  const db = adminApp.firestore();

  // pending 이거나 수동으로 트리거된 processing 상태의 결제 건을 스캔
  const snap = await db.collection("b2g_fee_payments")
    .where("status", "in", ["pending", "processing"])
    .limit(10)
    .get();

  for (const doc of snap.docs) {
    const feeData = doc.data();
    
    // 진행 중 상태로 변경하여 중복 결제 방지
    if (feeData.status === "pending") {
      await doc.ref.update({
        status: "processing",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    try {
      // 실제 PG사 결제 요청 로직 (TossPayments Billing API)
      const partnerRef = db.collection("partners").doc(feeData.partnerId);
      const partnerDoc = await partnerRef.get();
      const partnerData = partnerDoc.data() || {};
      
      const billingKey = partnerData.billingKey;
      const customerKey = partnerData.customerKey || `cust_${feeData.partnerId}`;

      let isSuccess = false;
      let receiptUrl = "";
      let errorMessage = "";

      if (!billingKey) {
        errorMessage = "등록된 결제수단(빌링키)이 없습니다.";
      } else {
        const settings = await getTossPaymentsSettings();
        if (!settings || !settings.secretKey || !settings.enabled) {
          throw new Error("결제 모듈이 비활성화되어 있거나 시크릿 키가 설정되지 않았습니다.");
        }

        try {
          const idempotencyKey = feeData.idempotencyKey || `b2g_fee_${doc.id}`;
          const result = await tossBillingPayment({
            secretKey: settings.secretKey,
            billingKey,
            customerKey,
            orderId: `fee_${doc.id}_${Date.now()}`,
            orderName: `B2G ${feeData.feeType.toUpperCase()} - ${feeData.paymentNumber}`,
            amount: feeData.amount,
            idempotencyKey,
          });
          
          isSuccess = true;
          receiptUrl = result.receipt?.url || "";
        } catch (paymentErr: any) {
          isSuccess = false;
          errorMessage = paymentErr.message || "결제 요청 실패";
        }
      }

      if (isSuccess) {
        // 결제 성공
        await doc.ref.update({
          status: "paid",
          receiptUrl,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await logOpsEvent(db, "b2g.fee.paid", "SUCCESS", "system", doc.id, "system", { amount: feeData.amount });

        // 증빙 슬롯 자동 승인 (해당 케이스의 증빙 목록 중 요금 영수증 항목이 있다면 승인 처리 로직 추가 가능)

      } else {
        // 결제 실패
        errorMessage = "잔액 부족 또는 카드 한도 초과";
        await doc.ref.update({
          status: "failed",
          errorMessage,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await logOpsEvent(db, "b2g.fee.failed", "FAIL", "system", doc.id, "system", { error: errorMessage });

        // 결제 실패 시 파트너에게 긴급 알림 에스컬레이션
        await enqueueNotification(adminApp, { partnerId: feeData.partnerId }, "b2g.fee_payment_failed" as any, {
          feeId: doc.id,
          amount: feeData.amount,
          error: errorMessage,
        });
      }
    } catch (err: any) {
      // 시스템 오류
      await doc.ref.update({
        status: "failed",
        errorMessage: err.message || "Unknown error",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
}
