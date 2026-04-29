import { Express } from "express";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { requireAuth, isOpsAdmin } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerPartnerRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 파트너 목록 조회 (운영자 전용 또는 유저 매칭 시 사용)
  // GET /v1/partners
  app.get("/v1/partners", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";

    if (isOpsAdmin((req as any).user)) {
      try {
        const snapshot = await db.collection("partners")
          .select("bizName", "bizRegNo", "status", "createdAt")
          .orderBy("bizName")
          .get();

        const partners = snapshot.docs.map((doc) => ({
          id: doc.id,
          bizName: doc.data().bizName || "",
          bizRegNo: doc.data().bizRegNo || "",
          status: doc.data().status || "",
        }));

        return ok(res, { partners }, requestId);
      } catch (e: unknown) {
        logError({ endpoint: "GET /v1/partners", code: "INTERNAL", messageKo: "파트너 목록 조회 실패", err: e });
        return fail(res, 500, "INTERNAL", "파트너 목록 조회에 실패했습니다.", { requestId });
      }
    }
    
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

  // 5. 파트너 API 키 생성 (POST /v1/partner/api-keys)
  app.post("/v1/partner/api-keys", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    try {
      const secret = crypto.randomBytes(32).toString("hex");
      const prefix = secret.slice(0, 8);
      const keyHash = crypto.createHash("sha256").update(secret).digest("hex");
      const docRef = db.collection("api_keys").doc();

      await docRef.set({
        partnerId,
        prefix,
        keyHash,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "active"
      });

      return ok(res, { apiKey: `ar_${prefix}.${secret}`, keyId: docRef.id, prefix }, requestId);
    } catch (error: any) {
      logError({ endpoint: "POST /v1/partner/api-keys", code: "INTERNAL", messageKo: "API 키 생성 실패", err: error });
      return fail(res, 500, "INTERNAL", "API 키 생성에 실패했습니다.", { error: error.message, requestId });
    }
  });

  app.get("/v1/partner/api-keys", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    try {
      const snap = await db.collection("api_keys")
        .where("partnerId", "==", partnerId)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();

      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          prefix: data.prefix,
          status: data.status,
          createdAt: data.createdAt || null,
          revokedAt: data.revokedAt || null,
          lastUsedAt: data.lastUsedAt || null
        };
      });

      return ok(res, { items }, requestId);
    } catch (error: any) {
      logError({ endpoint: "GET /v1/partner/api-keys", code: "INTERNAL", messageKo: "API 키 목록 조회 실패", err: error });
      return fail(res, 500, "INTERNAL", "API 키 목록 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  app.post("/v1/partner/api-keys/:keyId/revoke", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;
    const keyId = String(req.params.keyId);

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    try {
      const ref = db.collection("api_keys").doc(keyId);
      const snap = await ref.get();
      if (!snap.exists) {
        return fail(res, 404, "NOT_FOUND", "API 키를 찾을 수 없습니다.", { requestId });
      }
      const data = snap.data() as any;
      if (data.partnerId !== partnerId) {
        return fail(res, 403, "FORBIDDEN", "API 키 접근 권한이 없습니다.", { requestId });
      }

      await ref.update({
        status: "revoked",
        revokedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return ok(res, { keyId, status: "revoked" }, requestId);
    } catch (error: any) {
      logError({ endpoint: "POST /v1/partner/api-keys/:keyId/revoke", code: "INTERNAL", messageKo: "API 키 회수 실패", err: error });
      return fail(res, 500, "INTERNAL", "API 키 회수에 실패했습니다.", { error: error.message, requestId });
    }
  });

  app.post("/v1/partner/api-keys/rotate", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;
    const revokeAll = req.body?.revokeAll === true;

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    try {
      if (revokeAll) {
        const snap = await db.collection("api_keys")
          .where("partnerId", "==", partnerId)
          .where("status", "==", "active")
          .limit(200)
          .get();

        const batch = db.batch();
        for (const d of snap.docs) {
          batch.update(d.ref, {
            status: "revoked",
            revokedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        await batch.commit();
      }

      const secret = crypto.randomBytes(32).toString("hex");
      const prefix = secret.slice(0, 8);
      const keyHash = crypto.createHash("sha256").update(secret).digest("hex");
      const docRef = db.collection("api_keys").doc();

      await docRef.set({
        partnerId,
        prefix,
        keyHash,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "active"
      });

      return ok(res, { apiKey: `ar_${prefix}.${secret}`, keyId: docRef.id, prefix }, requestId);
    } catch (error: any) {
      logError({ endpoint: "POST /v1/partner/api-keys/rotate", code: "INTERNAL", messageKo: "API 키 회전 실패", err: error });
      return fail(res, 500, "INTERNAL", "API 키 회전에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 6. 파트너 웹훅 설정 조회 (GET /v1/partner/webhooks)
  app.get("/v1/partner/webhooks", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    try {
      const snap = await db.collection("partner_webhooks")
        .where("partnerId", "==", partnerId)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();

      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          url: data.url,
          events: data.events || [],
          status: data.status,
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        };
      });

      return ok(res, { items }, requestId);
    } catch (error: any) {
      logError({ endpoint: "GET /v1/partner/webhooks", code: "INTERNAL", messageKo: "웹훅 목록 조회 실패", err: error });
      return fail(res, 500, "INTERNAL", "웹훅 목록 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 7. 파트너 웹훅 등록 (POST /v1/partner/webhooks)
  app.post("/v1/partner/webhooks", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;
    const { url, events } = req.body;

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return fail(res, 400, "INVALID_ARGUMENT", "유효한 웹훅 URL이 필요합니다.", { requestId });
    }

    try {
      // Create a secure random secret for this webhook
      const secret = crypto.randomBytes(32).toString("hex");
      const docRef = db.collection("partner_webhooks").doc();

      await docRef.set({
        partnerId,
        url,
        events: events || ["*"],
        secret,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return ok(res, { 
        id: docRef.id, 
        url, 
        events: events || ["*"], 
        secret, // Secret is returned only once upon creation
        status: "active" 
      }, requestId);
    } catch (error: any) {
      logError({ endpoint: "POST /v1/partner/webhooks", code: "INTERNAL", messageKo: "웹훅 등록 실패", err: error });
      return fail(res, 500, "INTERNAL", "웹훅 등록에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 8. 파트너 웹훅 수정 (PUT /v1/partner/webhooks/:webhookId)
  app.put("/v1/partner/webhooks/:webhookId", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;
    const webhookId = String(req.params.webhookId);
    const { url, events, status } = req.body;

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    try {
      const ref = db.collection("partner_webhooks").doc(webhookId);
      const snap = await ref.get();
      if (!snap.exists) {
        return fail(res, 404, "NOT_FOUND", "웹훅을 찾을 수 없습니다.", { requestId });
      }
      const data = snap.data() as any;
      if (data.partnerId !== partnerId) {
        return fail(res, 403, "FORBIDDEN", "웹훅 접근 권한이 없습니다.", { requestId });
      }

      const updates: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (url && typeof url === "string" && url.startsWith("http")) updates.url = url;
      if (events && Array.isArray(events)) updates.events = events;
      if (status && ["active", "inactive"].includes(status)) updates.status = status;

      await ref.update(updates);

      return ok(res, { webhookId, ...updates, updatedAt: undefined }, requestId);
    } catch (error: any) {
      logError({ endpoint: "PUT /v1/partner/webhooks/:webhookId", code: "INTERNAL", messageKo: "웹훅 수정 실패", err: error });
      return fail(res, 500, "INTERNAL", "웹훅 수정에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 9. 파트너 웹훅 삭제 (DELETE /v1/partner/webhooks/:webhookId)
  app.delete("/v1/partner/webhooks/:webhookId", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;
    const webhookId = String(req.params.webhookId);

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    try {
      const ref = db.collection("partner_webhooks").doc(webhookId);
      const snap = await ref.get();
      if (!snap.exists) {
        return fail(res, 404, "NOT_FOUND", "웹훅을 찾을 수 없습니다.", { requestId });
      }
      const data = snap.data() as any;
      if (data.partnerId !== partnerId) {
        return fail(res, 403, "FORBIDDEN", "웹훅 접근 권한이 없습니다.", { requestId });
      }

      await ref.delete();

      return ok(res, { webhookId, deleted: true }, requestId);
    } catch (error: any) {
      logError({ endpoint: "DELETE /v1/partner/webhooks/:webhookId", code: "INTERNAL", messageKo: "웹훅 삭제 실패", err: error });
      return fail(res, 500, "INTERNAL", "웹훅 삭제에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 10. 조직 생성 (POST /v1/partner/organizations)
  app.post("/v1/partner/organizations", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const uid = (req as any).user.uid;
    const { name } = req.body;

    if (!name) {
      return fail(res, 400, "INVALID_ARGUMENT", "조직 이름(name)이 필요합니다.", { requestId });
    }

    try {
      const docRef = db.collection("organizations").doc();
      const now = admin.firestore.FieldValue.serverTimestamp();
      await docRef.set({
        name,
        ownerId: uid,
        createdAt: now,
        updatedAt: now,
      });

      return ok(res, { id: docRef.id, name, ownerId: uid }, requestId);
    } catch (error: any) {
      logError({ endpoint: "POST /v1/partner/organizations", code: "INTERNAL", messageKo: "조직 생성 실패", err: error });
      return fail(res, 500, "INTERNAL", "조직 생성에 실패했습니다.", { error: error.message, requestId });
    }
  });

  app.get("/v1/partner/organizations", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const uid = (req as any).user.uid;

    try {
      const snap = await db.collection("organizations").where("ownerId", "==", uid).orderBy("createdAt", "desc").limit(200).get();
      const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return ok(res, { items }, requestId);
    } catch (error: any) {
      logError({ endpoint: "GET /v1/partner/organizations", code: "INTERNAL", messageKo: "조직 조회 실패", err: error });
      return fail(res, 500, "INTERNAL", "조직 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 11. 워크스페이스 생성 (POST /v1/partner/workspaces)
  app.post("/v1/partner/workspaces", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const { name, organizationId } = req.body;

    if (!name || !organizationId) {
      return fail(res, 400, "INVALID_ARGUMENT", "워크스페이스 이름(name)과 조직 ID(organizationId)가 필요합니다.", { requestId });
    }

    try {
      const docRef = db.collection("workspaces").doc();
      const now = admin.firestore.FieldValue.serverTimestamp();
      await docRef.set({
        name,
        organizationId,
        createdAt: now,
        updatedAt: now,
      });

      return ok(res, { id: docRef.id, name, organizationId }, requestId);
    } catch (error: any) {
      logError({ endpoint: "POST /v1/partner/workspaces", code: "INTERNAL", messageKo: "워크스페이스 생성 실패", err: error });
      return fail(res, 500, "INTERNAL", "워크스페이스 생성에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 12. 케이스 특정 멤버 할당 (POST /v1/partner/cases/:caseId/assign)
  app.post("/v1/partner/cases/:caseId/assign", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const caseId = String(req.params.caseId);
    const { memberId } = req.body;

    if (!memberId) {
      return fail(res, 400, "INVALID_ARGUMENT", "할당할 멤버 ID(memberId)가 필요합니다.", { requestId });
    }

    try {
      const caseRef = db.collection("cases").doc(caseId);
      const caseDoc = await caseRef.get();
      if (!caseDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 케이스를 찾을 수 없습니다.", { requestId });
      }

      await caseRef.update({
        assignedMemberId: memberId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return ok(res, { caseId, assignedMemberId: memberId }, requestId);
    } catch (error: any) {
      logError({ endpoint: "POST /v1/partner/cases/:caseId/assign", code: "INTERNAL", messageKo: "케이스 멤버 할당 실패", err: error });
      return fail(res, 500, "INTERNAL", "케이스 멤버 할당에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 13. 파트너 템플릿 생성 (POST /v1/partner/templates)
  app.post("/v1/partner/templates", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;
    const { name, schema, uiSchema, description } = req.body;

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    if (!name || !schema) {
      return fail(res, 400, "INVALID_ARGUMENT", "템플릿 이름(name)과 스키마(schema)가 필요합니다.", { requestId });
    }

    try {
      const docRef = db.collection("partner_templates").doc();
      const now = admin.firestore.FieldValue.serverTimestamp();
      await docRef.set({
        partnerId,
        name,
        description: description || "",
        schema,
        uiSchema: uiSchema || {},
        createdAt: now,
        updatedAt: now,
      });

      return ok(res, { id: docRef.id, name, description, schema, uiSchema }, requestId);
    } catch (error: any) {
      logError({ endpoint: "POST /v1/partner/templates", code: "INTERNAL", messageKo: "템플릿 생성 실패", err: error });
      return fail(res, 500, "INTERNAL", "템플릿 생성에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 14. 파트너 템플릿 목록 조회 (GET /v1/partner/templates)
  app.get("/v1/partner/templates", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    try {
      const snap = await db.collection("partner_templates")
        .where("partnerId", "==", partnerId)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();

      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name,
          description: data.description,
          schema: data.schema,
          uiSchema: data.uiSchema,
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        };
      });

      return ok(res, { items }, requestId);
    } catch (error: any) {
      logError({ endpoint: "GET /v1/partner/templates", code: "INTERNAL", messageKo: "템플릿 목록 조회 실패", err: error });
      return fail(res, 500, "INTERNAL", "템플릿 목록 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 15. 파트너 템플릿 단건 조회 (GET /v1/partner/templates/:templateId)
  app.get("/v1/partner/templates/:templateId", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;
    const templateId = String(req.params.templateId);

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    try {
      const docRef = db.collection("partner_templates").doc(templateId);
      const snap = await docRef.get();

      if (!snap.exists) {
        return fail(res, 404, "NOT_FOUND", "템플릿을 찾을 수 없습니다.", { requestId });
      }

      const data = snap.data() as any;
      if (data.partnerId !== partnerId) {
        return fail(res, 403, "FORBIDDEN", "템플릿 접근 권한이 없습니다.", { requestId });
      }

      return ok(res, {
        id: snap.id,
        name: data.name,
        description: data.description,
        schema: data.schema,
        uiSchema: data.uiSchema,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
      }, requestId);
    } catch (error: any) {
      logError({ endpoint: "GET /v1/partner/templates/:templateId", code: "INTERNAL", messageKo: "템플릿 조회 실패", err: error });
      return fail(res, 500, "INTERNAL", "템플릿 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 16. 파트너 템플릿 수정 (PUT /v1/partner/templates/:templateId)
  app.put("/v1/partner/templates/:templateId", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;
    const templateId = String(req.params.templateId);
    const { name, schema, uiSchema, description } = req.body;

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    try {
      const ref = db.collection("partner_templates").doc(templateId);
      const snap = await ref.get();
      if (!snap.exists) {
        return fail(res, 404, "NOT_FOUND", "템플릿을 찾을 수 없습니다.", { requestId });
      }
      const data = snap.data() as any;
      if (data.partnerId !== partnerId) {
        return fail(res, 403, "FORBIDDEN", "템플릿 접근 권한이 없습니다.", { requestId });
      }

      const updates: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (name) updates.name = name;
      if (schema) updates.schema = schema;
      if (uiSchema) updates.uiSchema = uiSchema;
      if (description !== undefined) updates.description = description;

      await ref.update(updates);

      return ok(res, { templateId, ...updates, updatedAt: undefined }, requestId);
    } catch (error: any) {
      logError({ endpoint: "PUT /v1/partner/templates/:templateId", code: "INTERNAL", messageKo: "템플릿 수정 실패", err: error });
      return fail(res, 500, "INTERNAL", "템플릿 수정에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 17. 파트너 템플릿 삭제 (DELETE /v1/partner/templates/:templateId)
  app.delete("/v1/partner/templates/:templateId", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;
    const templateId = String(req.params.templateId);

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    try {
      const ref = db.collection("partner_templates").doc(templateId);
      const snap = await ref.get();
      if (!snap.exists) {
        return fail(res, 404, "NOT_FOUND", "템플릿을 찾을 수 없습니다.", { requestId });
      }
      const data = snap.data() as any;
      if (data.partnerId !== partnerId) {
        return fail(res, 403, "FORBIDDEN", "템플릿 접근 권한이 없습니다.", { requestId });
      }

      await ref.delete();

      return ok(res, { templateId, deleted: true }, requestId);
    } catch (error: any) {
      logError({ endpoint: "DELETE /v1/partner/templates/:templateId", code: "INTERNAL", messageKo: "템플릿 삭제 실패", err: error });
      return fail(res, 500, "INTERNAL", "템플릿 삭제에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 18. 파트너 통계 조회 (GET /v1/partner/analytics)
  app.get("/v1/partner/analytics", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const partnerId = (req as any).user.partnerId;

    if (!partnerId) {
      return fail(res, 403, "FORBIDDEN", "파트너 권한이 없습니다.", { requestId });
    }

    try {
      // MVP 용 가짜 데이터 생성 (향후 실제 케이스 데이터 집계로 교체)
      const today = new Date();
      const dailyStats = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dailyStats.push({
          date: d.toISOString().split("T")[0],
          casesCompleted: Math.floor(Math.random() * 10) + 1,
          revenue: Math.floor(Math.random() * 500000) + 100000,
          slaViolations: Math.floor(Math.random() * 2)
        });
      }

      const weeklyStats = [];
      for (let i = 3; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i * 7);
        weeklyStats.push({
          week: `Week of ${d.toISOString().split("T")[0]}`,
          casesCompleted: Math.floor(Math.random() * 50) + 10,
          revenue: Math.floor(Math.random() * 3000000) + 500000,
          slaViolations: Math.floor(Math.random() * 5)
        });
      }

      return ok(res, { daily: dailyStats, weekly: weeklyStats }, requestId);
    } catch (error: any) {
      logError({ endpoint: "GET /v1/partner/analytics", code: "INTERNAL", messageKo: "파트너 통계 조회 실패", err: error });
      return fail(res, 500, "INTERNAL", "파트너 통계 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  app.post("/v1/partners/applications", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const auth = (req as any).user;
    const uid = String(auth.uid);
    const email = auth.email ? String(auth.email) : "";
    const { bizName, bizRegNo, contactName, contactPhone, note } = req.body || {};

    if (!bizName || !contactName) {
      return fail(res, 400, "INVALID_ARGUMENT", "bizName, contactName은 필수입니다.", { requestId });
    }

    try {
      const ref = db.collection("partner_applications").doc(uid);
      const snap = await ref.get();
      const currentStatus = snap.exists ? String(snap.data()?.status || "") : "";
      if (currentStatus === "approved") {
        return fail(res, 409, "ALREADY_EXISTS", "이미 승인된 신청입니다.", { requestId });
      }

      if (!snap.exists) {
        await ref.set({
          uid,
          email,
          bizName: String(bizName),
          bizRegNo: bizRegNo ? String(bizRegNo) : "",
          contactName: String(contactName),
          contactPhone: contactPhone ? String(contactPhone) : "",
          note: note ? String(note) : "",
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await ref.update({
          email,
          bizName: String(bizName),
          bizRegNo: bizRegNo ? String(bizRegNo) : "",
          contactName: String(contactName),
          contactPhone: contactPhone ? String(contactPhone) : "",
          note: note ? String(note) : "",
          status: "pending",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return ok(res, { uid, status: "pending" }, requestId);
    } catch (error: any) {
      logError({ endpoint: "POST /v1/partners/applications", code: "INTERNAL", messageKo: "파트너 신청 실패", err: error });
      return fail(res, 500, "INTERNAL", "파트너 신청에 실패했습니다.", { error: error.message, requestId });
    }
  });

  app.get("/v1/partners/applications/me", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const auth = (req as any).user;
    const uid = String(auth.uid);

    try {
      const snap = await db.collection("partner_applications").doc(uid).get();
      if (!snap.exists) return ok(res, { application: null }, requestId);
      return ok(res, { application: { id: snap.id, ...snap.data() } }, requestId);
    } catch (error: any) {
      logError({ endpoint: "GET /v1/partners/applications/me", code: "INTERNAL", messageKo: "파트너 신청 상태 조회 실패", err: error });
      return fail(res, 500, "INTERNAL", "파트너 신청 상태 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
