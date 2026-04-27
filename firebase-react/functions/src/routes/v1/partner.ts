import { Express } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerPartnerRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 파트너 목록 조회 (운영자 전용 또는 유저 매칭 시 사용)
  // GET /v1/partners
  app.get("/v1/partners", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    
    // 필터 파라미터 추출
    const region = req.query.region as string;
    const specialty = req.query.specialty as string;
    const availableOnly = req.query.available === "true";
    const sortBy = (req.query.sortBy as string) || "rating"; // rating, price, eta
    const limit = parseInt(req.query.limit as string) || 20;

    try {
      let query: admin.firestore.Query = db.collection("partners").where("status", "==", "active");

      if (region) {
        query = query.where("regions", "array-contains", region);
      }
      if (specialty) {
        query = query.where("specialties", "array-contains", specialty);
      }
      if (availableOnly) {
        query = query.where("isAvailable", "==", true);
      }

      // 복합 쿼리(색인 필요) 대신 애플리케이션 레벨 정렬을 위해 넉넉히 가져옴 (MVP용)
      const snapshot = await query.limit(100).get();
      
      let allPartners = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          profileImage: data.profileImage,
          specialties: data.specialties || [],
          regions: data.regions || [],
          rating: data.rating || 0,
          reviewCount: data.reviewCount || 0,
          price: data.price || 0,
          etaHours: data.etaHours || 24,
          slaComplianceRate: data.slaComplianceRate || 0,
          isAvailable: data.isAvailable !== false,
          isSponsored: data.isSponsored === true,
        };
      });

      // 최대/최소값 추출 (정규화를 위함)
      const maxPrice = Math.max(...allPartners.map(p => p.price), 1);
      const maxEta = Math.max(...allPartners.map(p => p.etaHours), 1);

      // 종합 랭킹 점수(rankingScore) 계산
      allPartners.forEach(p => {
        // Rating (0~5) -> 40점 만점
        const scoreRating = (p.rating / 5) * 40;
        // SLA (0~100) -> 30점 만점
        const scoreSla = (p.slaComplianceRate / 100) * 30;
        // Price -> 저렴할수록 높은 점수 (15점 만점)
        const scorePrice = (1 - (p.price / maxPrice)) * 15;
        // ETA -> 빠를수록 높은 점수 (15점 만점)
        const scoreEta = (1 - (p.etaHours / maxEta)) * 15;
        
        (p as any).rankingScore = scoreRating + scoreSla + scorePrice + scoreEta;
      });

      // 정렬 (rating, price, eta, ranking)
      allPartners.sort((a: any, b: any) => {
        if (sortBy === "price") return a.price - b.price;
        if (sortBy === "eta") return a.etaHours - b.etaHours;
        if (sortBy === "rating") return b.rating - a.rating;
        // default: ranking (desc)
        return b.rankingScore - a.rankingScore;
      });

      // 스폰서와 일반 파트너 분리
      const sponsored = allPartners.filter(p => p.isSponsored).slice(0, 3);
      // 스폰서에 노출된 파트너도 일반 목록에 포함될 수 있으나, 중복을 피하기 위해 제거
      const sponsoredIds = new Set(sponsored.map(p => p.id));
      const organic = allPartners.filter(p => !sponsoredIds.has(p.id)).slice(0, limit);

      // sponsored disclosure 명시
      const responseData = {
        sponsored: sponsored.map(p => ({ ...p, disclosure: "Sponsored Partner" })),
        organic,
      };

      return ok(res, responseData, requestId);
    } catch (error: any) {
      logError("GET /v1/partners", "N/A", "INTERNAL", "파트너 목록 조회 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "파트너 목록 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. 케이스에 파트너 할당 (POST /v1/cases/:caseId/assign-partner)
  // 대상: 운영자(Ops)가 수동 할당하거나, 시스템 워커가 자동 할당
  // 임시로 인증된 유저/운영자가 호출할 수 있게 허용 (실제 운영 환경에선 requireOpsRole 권장)
  app.post("/v1/cases/:caseId/assign-partner", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const uid = (req as any).user.uid;
    const caseId = String(req.params.caseId);
    const { partnerId } = req.body;

    if (!partnerId) {
      return fail(res, 400, "INVALID_ARGUMENT", "할당할 파트너 ID(partnerId)가 필요합니다.", { requestId });
    }

    try {
      // 1. 파트너 존재 여부 확인
      const partnerDoc = await db.collection("partners").doc(partnerId).get();
      if (!partnerDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 파트너를 찾을 수 없습니다.", { requestId });
      }

      // 2. 케이스 존재 여부 및 현재 상태 확인
      const caseRef = db.collection("cases").doc(caseId);
      const caseDoc = await caseRef.get();
      if (!caseDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 케이스를 찾을 수 없습니다.", { requestId });
      }

      const caseData = caseDoc.data() as any;

      // 이미 파트너가 할당된 경우 처리 (재할당 로직)
      const previousPartnerId = caseData.partnerId;
      if (previousPartnerId === partnerId) {
        return fail(res, 400, "FAILED_PRECONDITION", "이미 해당 파트너가 할당되어 있습니다.", { requestId });
      }

      // 3. 파트너 할당 업데이트
      await caseRef.update({
        partnerId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 4. 감사 로그 기록
      await logOpsEvent(db, "PARTNER_ASSIGNED", "SUCCESS", uid, requestId, caseId, {
        partnerId,
        previousPartnerId,
      });

      return ok(res, { caseId, partnerId }, requestId);
    } catch (error: any) {
      logError("POST /v1/cases/:caseId/assign-partner", caseId, "INTERNAL", "파트너 할당 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "파트너 할당에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 3. 파트너의 할당된 케이스 목록 조회 (GET /v1/partners/:partnerId/cases)
  app.get("/v1/partners/:partnerId/cases", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const reqPartnerId = (req as any).user.partnerId;
    const partnerId = String(req.params.partnerId);

    // 본인의 파트너 계정 정보만 조회 가능 (또는 운영자)
    if (reqPartnerId !== partnerId) {
      return fail(res, 403, "PERMISSION_DENIED", "자신의 파트너 계정 케이스만 조회할 수 있습니다.", { requestId });
    }

    try {
      const snapshot = await db.collection("cases")
        .where("partnerId", "==", partnerId)
        .orderBy("updatedAt", "desc")
        .limit(50)
        .get();

      const cases = snapshot.docs.map(doc => doc.data());

      return ok(res, { cases }, requestId);
    } catch (error: any) {
      logError("GET /v1/partners/:partnerId/cases", "N/A", "INTERNAL", "파트너 케이스 목록 조회 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "파트너 케이스 목록 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 4. 파트너 본인 프로필 및 품질 지표 조회 (GET /v1/partner/profile)
  app.get("/v1/partner/profile", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    try {
      const partnerDoc = await db.collection("partners").doc(partnerId).get();
      if (!partnerDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "파트너 정보를 찾을 수 없습니다.", { requestId });
      }

      const data = partnerDoc.data() as any;
      const profile = {
        id: partnerDoc.id,
        name: data.name,
        profileImage: data.profileImage,
        rating: data.rating || 0,
        reviewCount: data.reviewCount || 0,
        slaComplianceRate: data.slaComplianceRate || 0,
        rankingScore: data.rankingScore || 0,
        qualityTier: data.qualityTier || "Bronze",
        isSponsored: data.isSponsored === true,
        status: data.status
      };

      return ok(res, { profile }, requestId);
    } catch (error: any) {
      logError({ endpoint: "GET /v1/partner/profile", code: "INTERNAL", messageKo: "파트너 프로필 조회 실패", err: error });
      return fail(res, 500, "INTERNAL", "파트너 프로필 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
