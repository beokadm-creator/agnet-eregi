import { Express } from "express";
import * as admin from "firebase-admin";
import { ok, fail, logError } from "../../lib/http";
import { CasePack } from "../../lib/case_pack_models";

export function registerCasePackRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. [유저/파트너 공통] 활성화된 사건팩 목록 조회
  app.get("/v1/case-packs", async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    
    try {
      const snap = await db.collection("case_packs").where("active", "==", true).get();
      const packs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CasePack));
      
      return ok(res, { packs }, requestId);
    } catch (error: any) {
      logError("GET /v1/case-packs", "N/A", "INTERNAL", "사건팩 목록 조회 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "사건팩 목록 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. [유저/파트너 공통] 특정 사건팩 상세 스키마 조회
  app.get("/v1/case-packs/:casePackId", async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const casePackId = String(req.params.casePackId);

    if (!casePackId) {
      return fail(res, 400, "INVALID_ARGUMENT", "casePackId가 필요합니다.", { requestId });
    }

    try {
      const doc = await db.collection("case_packs").doc(casePackId).get();
      if (!doc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 사건팩을 찾을 수 없습니다.", { requestId });
      }

      const pack = { id: doc.id, ...doc.data() } as CasePack;
      return ok(res, { pack }, requestId);
    } catch (error: any) {
      logError("GET /v1/case-packs/:casePackId", "N/A", "INTERNAL", "사건팩 상세 조회 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "사건팩 상세 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
