import { Express } from "express";
import * as admin from "firebase-admin";
import { ok, fail, logError } from "../../lib/http";

export function registerDevRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. [개발 환경 전용] 테스트용 데이터(Dummy) 초기화 (POST /v1/dev/seed)
  app.post("/v1/dev/seed", async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    
    // 환경 변수 체크: 프로덕션 환경에서는 절대 실행되지 않도록 방어
    const env = process.env.NODE_ENV || "development";
    if (env === "production" || process.env.GCLOUD_PROJECT?.includes("prod")) {
      return fail(res, 403, "PERMISSION_DENIED", "프로덕션 환경에서는 사용할 수 없는 엔드포인트입니다.", { requestId });
    }

    const { target } = req.body; // 예: "partners", "cases", "all"

    try {
      if (target === "partners" || target === "all") {
        // 더미 파트너 생성
        const partnerRef = db.collection("partners").doc("dummy-partner-1");
        await partnerRef.set({
          id: partnerRef.id,
          name: "테스트 법무사",
          status: "active",
          specialties: ["법인 설립", "임원 변경"],
          rating: 4.9,
          reviewCount: 15,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (target === "cases" || target === "all") {
        // 더미 케이스 생성
        const caseRef = db.collection("cases").doc("dummy-case-1");
        await caseRef.set({
          id: caseRef.id,
          userId: "dummy-user-1",
          partnerId: "dummy-partner-1",
          status: "draft_filing",
          type: "corp_officer_change_v1",
          intentData: { note: "테스트 의도 데이터" },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return ok(res, { message: `Seed for ${target || "all"} completed.` }, requestId);
    } catch (error: any) {
      logError("POST /v1/dev/seed", "N/A", "INTERNAL", "더미 데이터 생성 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "더미 데이터 생성에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
