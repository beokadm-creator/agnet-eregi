import { Express } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";
import { getExchangeRate, convertCurrency } from "../../lib/exchange_rate";

export function registerQuoteRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 견적서 목록 조회 (GET /v1/cases/:caseId/quotes)
  app.get("/v1/cases/:caseId/quotes", requireAuth, async (req, res) => {
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
        return fail(res, 403, "PERMISSION_DENIED", "이 케이스의 견적을 조회할 권한이 없습니다.", { requestId });
      }
      if (!isPartner && caseData.userId !== uid) {
        return fail(res, 403, "PERMISSION_DENIED", "이 케이스의 견적을 조회할 권한이 없습니다.", { requestId });
      }

      const snapshot = await db.collection("cases").doc(caseId).collection("quotes").orderBy("createdAt", "desc").get();
      const quotes = snapshot.docs.map(doc => doc.data());

      return ok(res, { quotes }, requestId);
    } catch (error: any) {
      logError("GET /v1/cases/:caseId/quotes", caseId, "INTERNAL", "견적 목록 조회 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "견적 목록 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. 견적 제안 (Draft) - 파트너 전용
  app.post("/v1/partner/cases/:caseId/quotes/draft", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const uid = (req as any).user.uid;
    const isPartner = (req as any).user.partnerId != null;
    const reqPartnerId = (req as any).user.partnerId;
    const caseId = String(req.params.caseId);
    const { priceMin, priceMax, etaMinHours, etaMaxHours, currency = "KRW", targetCurrency = "USD" } = req.body;

    if (!isPartner) {
      return fail(res, 403, "PERMISSION_DENIED", "견적 제출은 파트너만 가능합니다.", { requestId });
    }

    if (!priceMin || !priceMax || priceMin <= 0 || priceMax < priceMin) {
      return fail(res, 400, "INVALID_ARGUMENT", "유효한 견적 금액 범위가 필요합니다.", { requestId });
    }

    try {
      const caseRef = db.collection("cases").doc(caseId);
      const caseDoc = await caseRef.get();

      if (!caseDoc.exists || caseDoc.data()?.partnerId !== reqPartnerId) {
        return fail(res, 403, "PERMISSION_DENIED", "자신에게 할당된 케이스에만 견적을 제출할 수 있습니다.", { requestId });
      }

      // EP-15-02 실시간 환율 기반 변환
      const exchangeRate = await getExchangeRate(currency, targetCurrency);
      const targetPriceMin = await convertCurrency(priceMin, currency, targetCurrency);
      const targetPriceMax = await convertCurrency(priceMax, currency, targetCurrency);

      const quoteRef = caseRef.collection("quotes").doc();
      const newQuote = {
        id: quoteRef.id,
        caseId,
        status: "draft",
        priceMin,
        priceMax,
        currency,
        targetCurrency,
        targetPriceMin,
        targetPriceMax,
        exchangeRate,
        etaMinHours: etaMinHours || 24,
        etaMaxHours: etaMaxHours || 72,
        finalPrice: null,
        assumptionsKo: [],
        createdBy: reqPartnerId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await quoteRef.set(newQuote);
      await logOpsEvent(db, "QUOTE_DRAFT_CREATED", "SUCCESS", uid, requestId, caseId, { quoteId: quoteRef.id });

      return ok(res, { quoteId: quoteRef.id, status: "draft" }, requestId);
    } catch (error: any) {
      logError("POST /v1/partner/cases/:caseId/quotes/draft", caseId, "INTERNAL", "견적 제안 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "견적 제안에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 3. 견적 확정 (Finalize) - 파트너 전용
  app.post("/v1/partner/cases/:caseId/quotes/:quoteId/finalize", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const uid = (req as any).user.uid;
    const isPartner = (req as any).user.partnerId != null;
    const reqPartnerId = (req as any).user.partnerId;
    const caseId = String(req.params.caseId);
    const quoteId = String(req.params.quoteId);
    const { finalPrice, assumptionsKo, targetCurrency } = req.body;

    if (!isPartner) {
      return fail(res, 403, "PERMISSION_DENIED", "견적 확정은 파트너만 가능합니다.", { requestId });
    }
    if (!finalPrice || finalPrice <= 0) {
      return fail(res, 400, "INVALID_ARGUMENT", "유효한 최종 견적 금액(finalPrice)이 필요합니다.", { requestId });
    }

    try {
      const caseRef = db.collection("cases").doc(caseId);
      const caseDoc = await caseRef.get();

      if (!caseDoc.exists || caseDoc.data()?.partnerId !== reqPartnerId) {
        return fail(res, 403, "PERMISSION_DENIED", "권한이 없습니다.", { requestId });
      }

      const quoteRef = caseRef.collection("quotes").doc(quoteId);
      const quoteDoc = await quoteRef.get();

      if (!quoteDoc.exists || quoteDoc.data()?.status !== "draft") {
        return fail(res, 400, "FAILED_PRECONDITION", "draft 상태의 견적만 확정할 수 있습니다.", { requestId });
      }

      const quoteData = quoteDoc.data() as any;
      const baseCurrency = quoteData.currency || "KRW";
      const targetCurr = targetCurrency || quoteData.targetCurrency || "USD";

      // EP-15-02 실시간 환율 적용 및 다국어 통화 견적 확정
      const exchangeRate = await getExchangeRate(baseCurrency, targetCurr);
      const targetFinalPrice = await convertCurrency(finalPrice, baseCurrency, targetCurr);

      // 수동 검토 (Ops Approval) 로직 (원화 기준으로 통일하여 비교)
      const finalPriceInKRW = await convertCurrency(finalPrice, baseCurrency, "KRW");
      const maxPriceInKRW = await convertCurrency(quoteData.priceMax, quoteData.currency || "KRW", "KRW");

      // 예: 최종 견적이 원화 기준 1,000,000원 초과이거나 제안된 Max보다 1.5배 이상 높은 경우
      if (finalPriceInKRW > 1000000 || finalPriceInKRW > maxPriceInKRW * 1.5) {
        // 수동 검토 큐에 적재
        const approvalRef = db.collection("ops_approvals").doc();
        await approvalRef.set({
          id: approvalRef.id,
          status: "pending",
          gate: "quote_approve",
          actionType: "quote_approve", // for worker
          caseId,
          requiredRole: "ops_operator",
          requestedBy: uid,
          payload: {
            caseId,
            quoteId,
            finalPrice,
            targetFinalPrice,
            currency: baseCurrency,
            targetCurrency: targetCurr,
            assumptionsKo: assumptionsKo || [],
          },
          context: {
            priceMaxKRW: maxPriceInKRW,
            finalPriceKRW: finalPriceInKRW,
            reason: "고액 견적 또는 예상 한도 대폭 초과로 인한 수동 검토 필요",
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(412).json({
          ok: false,
          error: {
            code: "APPROVAL_REQUIRED",
            message: "고액 견적으로 인해 운영자 승인이 필요합니다.",
            approvalId: approvalRef.id
          }
        });
      }

      await quoteRef.update({
        status: "finalized",
        finalPrice,
        targetFinalPrice,
        targetCurrency: targetCurr,
        exchangeRate,
        assumptionsKo: assumptionsKo || [],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logOpsEvent(db, "QUOTE_FINALIZED", "SUCCESS", uid, requestId, caseId, { quoteId, finalPrice });

      return ok(res, { status: "finalized" }, requestId);
    } catch (error: any) {
      logError("POST /v1/partner/cases/:caseId/quotes/:quoteId/finalize", caseId, "INTERNAL", "견적 확정 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "견적 확정에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 4. 견적 동의 (Accept) - 유저 전용
  app.post("/v1/user/cases/:caseId/quotes/:quoteId/accept", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const uid = (req as any).user.uid;
    const isPartner = (req as any).user.partnerId != null;
    const caseId = String(req.params.caseId);
    const quoteId = String(req.params.quoteId);

    // 멱등키 확인 (Header: Idempotency-Key)
    const idempotencyKey = req.headers["idempotency-key"];
    if (!idempotencyKey) {
      return fail(res, 400, "INVALID_ARGUMENT", "Idempotency-Key 헤더가 필요합니다.", { requestId });
    }

    if (isPartner) {
      return fail(res, 403, "PERMISSION_DENIED", "견적 동의는 유저만 가능합니다.", { requestId });
    }

    try {
      const caseRef = db.collection("cases").doc(caseId);
      const caseDoc = await caseRef.get();

      if (!caseDoc.exists || caseDoc.data()?.userId !== uid) {
        return fail(res, 403, "PERMISSION_DENIED", "권한이 없습니다.", { requestId });
      }

      const quoteRef = caseRef.collection("quotes").doc(quoteId);
      
      await db.runTransaction(async (transaction) => {
        const quoteDoc = await transaction.get(quoteRef);
        if (!quoteDoc.exists) {
          throw new Error("NOT_FOUND");
        }

        const quoteData = quoteDoc.data() as any;
        if (quoteData.status !== "finalized") {
          if (quoteData.status === "accepted") {
             // 멱등성: 이미 수락된 상태면 그냥 성공 처리
             return;
          }
          throw new Error("FAILED_PRECONDITION");
        }

        transaction.update(quoteRef, {
          status: "accepted",
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          idempotencyKey,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        transaction.update(caseRef, {
          acceptedQuoteId: quoteId,
          agreedAmount: quoteData.finalPrice,
          status: "payment_pending", // 견적 수락 후 결제 대기 상태로 이동
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // 만약 트랜잭션에서 오류가 발생했다면 catch로 빠짐
      await logOpsEvent(db, "QUOTE_ACCEPTED", "SUCCESS", uid, requestId, caseId, { quoteId });

      return ok(res, { status: "accepted" }, requestId);
    } catch (error: any) {
      if (error.message === "NOT_FOUND") {
        return fail(res, 404, "NOT_FOUND", "해당 견적서를 찾을 수 없습니다.", { requestId });
      }
      if (error.message === "FAILED_PRECONDITION") {
        return fail(res, 400, "FAILED_PRECONDITION", "finalized 상태의 견적만 동의할 수 있습니다.", { requestId });
      }
      logError("POST /v1/user/cases/:caseId/quotes/:quoteId/accept", caseId, "INTERNAL", "견적 동의 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "견적 동의에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
