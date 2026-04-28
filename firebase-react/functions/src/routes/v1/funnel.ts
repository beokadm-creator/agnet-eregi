import { Express } from "express";
import * as admin from "firebase-admin";
import { ok, fail, logError } from "../../lib/http";

// 더미 질문 데이터 (SDUI 구조 예시)
const QUESTIONS: Record<string, any> = {
  q_corp_type: {
    id: "q_corp_type",
    type: "single_choice",
    text: "어떤 형태의 법인인가요?",
    options: ["주식회사", "유한회사", "기타"],
    next: "q_officer_type"
  },
  q_officer_type: {
    id: "q_officer_type",
    type: "single_choice",
    text: "어떤 임원 변경인가요?",
    options: ["취임", "사임", "중임", "퇴임"],
    next: "q_officer_count"
  },
  q_officer_count: {
    id: "q_officer_count",
    type: "number",
    text: "몇 명의 임원이 변경되나요?",
    next: null // null이면 진단 완료
  }
};

function getNextQuestion(currentQuestionId: string | null): any {
  if (!currentQuestionId) return QUESTIONS["q_corp_type"];
  const current = QUESTIONS[currentQuestionId];
  if (current && current.next) {
    return QUESTIONS[current.next];
  }
  return null;
}

function calculatePreview(answers: any) {
  let minPrice = 150000;
  let maxPrice = 300000;
  let etaDays = 3;
  let requiredDocs = ["법인인감증명서", "법인등기부등본"];

  if (answers["q_corp_type"] === "주식회사") {
    requiredDocs.push("주주명부");
  }
  
  const count = parseInt(answers["q_officer_count"]) || 1;
  if (count > 1) {
    minPrice += (count - 1) * 30000;
    maxPrice += (count - 1) * 50000;
    etaDays += 1;
  }

  return { minPrice, maxPrice, etaDays, requiredDocs };
}

export function registerFunnelRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 의도 제출 및 세션 시작 (EP-01-01)
  app.post("/v1/funnel/intent", async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const { intentText } = req.body;
    
    // (Optional) auth middleware is not strictly required here, but we could check req.user if logged in
    const userId = (req as any).user?.uid || null;

    if (!intentText) {
      return fail(res, 400, "INVALID_ARGUMENT", "intentText가 필요합니다.", { requestId });
    }

    try {
      const sessionRef = db.collection("funnel_sessions").doc();
      const sessionId = sessionRef.id;

      const initialPreview = calculatePreview({});

      await sessionRef.set({
        id: sessionId,
        userId,
        intent: intentText,
        status: "started",
        answers: {},
        preview: initialPreview,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection("funnel_events").add({
        sessionId,
        type: "INTENT_SUBMITTED",
        payload: { intentText },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return ok(res, {
        sessionId,
        nextQuestion: getNextQuestion(null)
      }, requestId);
    } catch (error: any) {
      logError("POST /v1/funnel/intent", "N/A", "INTERNAL", "의도 제출 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "의도 제출에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. 진단 답변 제출 (EP-01-02, EP-01-03)
  app.post("/v1/funnel/sessions/:sessionId/answer", async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const sessionId = String(req.params.sessionId);
    const { questionId, answer } = req.body;

    if (!questionId || answer === undefined) {
      return fail(res, 400, "INVALID_ARGUMENT", "questionId와 answer가 필요합니다.", { requestId });
    }

    try {
      const sessionRef = db.collection("funnel_sessions").doc(sessionId);
      
      await db.runTransaction(async (transaction) => {
        const sessionDoc = await transaction.get(sessionRef);
        if (!sessionDoc.exists) {
          throw new Error("NOT_FOUND");
        }
        
        const data = sessionDoc.data() as any;
        const newAnswers = { ...data.answers, [questionId]: answer };
        const nextQuestion = getNextQuestion(questionId);
        const isCompleted = nextQuestion === null;
        const status = isCompleted ? "completed" : "diagnosing";
        const preview = calculatePreview(newAnswers);

        transaction.update(sessionRef, {
          answers: newAnswers,
          status,
          preview,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const eventRef = db.collection("funnel_events").doc();
        transaction.set(eventRef, {
          sessionId,
          type: "DIAGNOSIS_ANSWERED",
          payload: { questionId, answer, isCompleted },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Fetch the updated doc to return
      const updatedDoc = await sessionRef.get();
      const updatedData = updatedDoc.data() as any;
      const nextQuestion = getNextQuestion(questionId);

      return ok(res, {
        isCompleted: nextQuestion === null,
        nextQuestion,
        preview: updatedData.preview
      }, requestId);

    } catch (error: any) {
      if (error.message === "NOT_FOUND") {
        return fail(res, 404, "NOT_FOUND", "해당 진단 세션을 찾을 수 없습니다.", { requestId });
      }
      logError("POST /v1/funnel/sessions/:sessionId/answer", "N/A", "INTERNAL", "답변 제출 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "답변 제출에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 3. 매칭 결과 조회 (EP-01-04, EP-02-01~03)
  app.get("/v1/funnel/sessions/:sessionId/results", async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const sessionId = String(req.params.sessionId);

    try {
      const sessionDoc = await db.collection("funnel_sessions").doc(sessionId).get();
      if (!sessionDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 진단 세션을 찾을 수 없습니다.", { requestId });
      }
      
      const sessionData = sessionDoc.data() as any;
      if (sessionData.status !== "completed") {
        // 완벽하게 막을 수도 있지만 유연성을 위해 경고만 줄 수도 있음. 여기서는 그냥 진행 허용.
      }

      // 파트너 필터링 및 랭킹 (워커가 계산해둔 rankingScore를 기반으로 즉시 정렬하여 로드)
      // [EP-12-02] isOverloaded == true 인 파트너는 노출에서 제외
      const snapshot = await db.collection("partners")
        .where("status", "==", "active")
        .where("isOverloaded", "!=", true) // isOverloaded가 true인 문서 제외
        .orderBy("isOverloaded") // Firestore requires ordering by the field used in inequality filter first
        .orderBy("rankingScore", "desc")
        .limit(100)
        .get();
      
      let allPartners = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          partnerId: doc.id,
          name: data.name,
          profileImage: data.profileImage,
          rating: data.rating || 0,
          reviewCount: data.reviewCount || 0,
          price: data.price || 0,
          etaHours: data.etaHours || 24,
          slaComplianceRate: data.slaComplianceRate || 0,
          isSponsored: data.isSponsored === true,
          rankingScore: data.rankingScore || 0,
          qualityTier: data.qualityTier || "Bronze"
        };
      });

      // 스폰서(광고)와 일반 추천 분리
      const sponsoredPartners = allPartners
        .filter(p => p.isSponsored)
        .slice(0, 3)
        .map(p => ({
          ...p,
          disclosure: "Sponsored Partner"
        }));

      const sponsoredIds = new Set(sponsoredPartners.map(p => p.partnerId));
      const organicPartners = allPartners.filter(p => !sponsoredIds.has(p.partnerId));

      const recommended = organicPartners.length > 0 ? organicPartners[0] : null;
      const compareTop3 = organicPartners.slice(1, 4);

      await db.collection("funnel_events").add({
        sessionId,
        type: "RESULTS_VIEWED",
        payload: {
          recommendedPartnerId: recommended?.partnerId || "none",
          comparePartnerIds: compareTop3.map(p => p.partnerId),
          sponsoredPartnerIds: sponsoredPartners.map(p => p.partnerId)
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return ok(res, {
        recommended,
        compareTop3,
        sponsored: sponsoredPartners
      }, requestId);

    } catch (error: any) {
      logError("GET /v1/funnel/sessions/:sessionId/results", "N/A", "INTERNAL", "매칭 결과 조회 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "매칭 결과 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
