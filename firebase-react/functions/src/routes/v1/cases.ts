import { Express, Request, Response } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerCaseRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 신규 케이스 생성 (POST /v1/cases)
  app.post("/v1/cases", requireAuth, async (req: Request, res: Response) => {
    const requestId = req.requestId || "req-unknown";
    const uid = req.user!.uid;
    const { casePackId, type, intentData, selectedPartnerId } = req.body;

    // casePackId (신규 구조) 또는 type (기존 구조 호환)이 필요함
    if (!casePackId && !type) {
      return fail(res, 400, "INVALID_ARGUMENT", "casePackId 또는 type이 필요합니다.", { requestId });
    }
    if (casePackId && typeof casePackId !== "string") {
      return fail(res, 400, "INVALID_ARGUMENT", "casePackId는 문자열이어야 합니다.", { requestId });
    }
    if (selectedPartnerId && typeof selectedPartnerId !== "string") {
      return fail(res, 400, "INVALID_ARGUMENT", "selectedPartnerId는 문자열이어야 합니다.", { requestId });
    }

    try {
      const caseRef = db.collection("cases").doc();
      const newCase = {
        id: caseRef.id,
        userId: uid,
        partnerId: selectedPartnerId || null,
        casePackId: casePackId || type, // 신규 구조를 우선시하며, 없으면 기존 type을 casePackId로 사용
        status: "waiting_partner", // 초기 상태를 좀 더 범용적으로
        type: type || casePackId, // 하위 호환성 유지
        intentData: intentData || {}, // 유저가 입력한 초기 의도/데이터
        dynamicData: {}, // 신규 동적 폼 데이터 저장소
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await caseRef.set(newCase);

      await logOpsEvent(admin, {
        action: "CASE_CREATED",
        status: "success",
        actorUid: uid,
        requestId,
        summary: `케이스(${caseRef.id}) 생성됨`,
        target: { type: type || casePackId, caseId: caseRef.id }
      });

      return ok(res, newCase);
    } catch (error: any) {
      logError({
        endpoint: "POST /v1/cases",
        code: "INTERNAL",
        messageKo: "케이스 생성 중 오류가 발생했습니다.",
        err: error
      });
      return fail(res, 500, "INTERNAL", "케이스 생성에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. 내 케이스 목록 조회 (GET /v1/cases)
  app.get("/v1/cases", requireAuth, async (req: Request, res: Response) => {
    const requestId = req.requestId || "req-unknown";
    const uid = req.user!.uid;
    const isPartner = req.user!.partnerId != null; // 파트너 여부 판별 로직
    const partnerId = req.user!.partnerId;

    try {
      let query: admin.firestore.Query = db.collection("cases");

      if (isPartner) {
        query = query.where("partnerId", "==", partnerId);
      } else {
        query = query.where("userId", "==", uid);
      }

      query = query.orderBy("createdAt", "desc").limit(50);

      const snapshot = await query.get();
      const cases = snapshot.docs.map((doc) => doc.data());

      return ok(res, { cases });
    } catch (error: any) {
      logError({
        endpoint: "GET /v1/cases",
        code: "INTERNAL",
        messageKo: "케이스 목록 조회 중 오류가 발생했습니다.",
        err: error
      });
      return fail(res, 500, "INTERNAL", "케이스 목록 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 3. 단건 케이스 상세 조회 (GET /v1/cases/:caseId)
  app.get("/v1/cases/:caseId", requireAuth, async (req: Request, res: Response) => {
    const requestId = req.requestId || "req-unknown";
    const uid = req.user!.uid;
    const isPartner = req.user!.partnerId != null;
    const partnerId = req.user!.partnerId;
    const caseId = req.params.caseId as string;

    try {
      const doc = await db.collection("cases").doc(caseId).get();

      if (!doc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 케이스를 찾을 수 없습니다.", { requestId });
      }

      const caseData = doc.data() as any;

      // 권한 검사 (소유권)
      if (isPartner) {
        if (caseData.partnerId !== partnerId) {
          return fail(res, 403, "FORBIDDEN", "이 케이스에 접근할 권한이 없습니다.", { requestId });
        }
      } else {
        if (caseData.userId !== uid) {
          return fail(res, 403, "FORBIDDEN", "이 케이스에 접근할 권한이 없습니다.", { requestId });
        }
      }

      return ok(res, caseData);
    } catch (error: any) {
      logError({
        endpoint: "GET /v1/cases/:caseId",
        caseId,
        code: "INTERNAL",
        messageKo: "케이스 상세 조회 중 오류가 발생했습니다.",
        err: error
      });
      return fail(res, 500, "INTERNAL", "케이스 상세 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 4. 동적 폼 데이터 제출 (POST /v1/cases/:caseId/forms/dynamic) - Phase 4 확장
  app.post("/v1/cases/:caseId/forms/dynamic", requireAuth, async (req: Request, res: Response) => {
    const requestId = req.requestId || "req-unknown";
    const uid = req.user!.uid;
    const caseId = req.params.caseId as string;
    const { dynamicData } = req.body;

    if (!dynamicData || typeof dynamicData !== "object") {
      return fail(res, 400, "INVALID_ARGUMENT", "dynamicData 객체가 필요합니다.", { requestId });
    }

    try {
      const caseRef = db.collection("cases").doc(caseId);
      
      await db.runTransaction(async (transaction) => {
        const caseDoc = await transaction.get(caseRef);
        if (!caseDoc.exists) {
          throw new Error("NOT_FOUND");
        }
        
        const caseData = caseDoc.data() as any;
        if (caseData.userId !== uid) {
          throw new Error("FORBIDDEN");
        }

        // 실제 프로덕션 환경에서는 caseData.casePackId를 바탕으로 case_packs 컬렉션을 조회하여
        // formSchema(JSON Schema)를 기반으로 ajv 등을 활용한 서버사이드 데이터 유효성 검사(Validation)를 수행해야 합니다.

        const updatedData = {
          ...(caseData.dynamicData || {}),
          ...dynamicData
        };

        transaction.update(caseRef, {
          dynamicData: updatedData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      return ok(res, { message: "동적 폼 데이터가 저장되었습니다." }, requestId);
    } catch (error: any) {
      if (error.message === "NOT_FOUND") {
        return fail(res, 404, "NOT_FOUND", "해당 케이스를 찾을 수 없습니다.", { requestId });
      }
      if (error.message === "FORBIDDEN") {
        return fail(res, 403, "FORBIDDEN", "권한이 없습니다.", { requestId });
      }
      logError({
        endpoint: "POST /v1/cases/:caseId/forms/dynamic",
        caseId,
        code: "INTERNAL",
        messageKo: "동적 폼 데이터 제출 중 오류가 발생했습니다.",
        err: error
      });
      return fail(res, 500, "INTERNAL", "데이터 제출에 실패했습니다.", { error: error.message, requestId });
    }
  });
}

