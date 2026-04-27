import { Express, Request, Response } from "express";
import * as admin from "firebase-admin";
import { VertexAI } from "@google-cloud/vertexai";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { fetchRealExchangeRates } from "../../lib/exchange_rate";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "agent-eregi";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "asia-northeast3";
const MODEL_NAME = "gemini-1.5-flash-preview-0514";

export function registerTranslationRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 실시간 메시지/코멘트 번역 (EP-15)
  // POST /v1/cases/{caseId}/translate
  app.post("/v1/cases/:caseId/translate", async (req: Request, res: Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const { caseId } = req.params;
      const { text, targetLang } = req.body;

      if (!text || !targetLang) {
        return fail(res, 400, "INVALID_ARGUMENT", "text와 targetLang은 필수입니다.");
      }

      // Vertex AI (Gemini) 연동 번역
      const vertexAi = new VertexAI({ project: PROJECT_ID, location: LOCATION });
      const model = vertexAi.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });

      const prompt = `
당신은 전문 번역가입니다. 제공된 텍스트를 ${targetLang} 언어로 자연스럽게 번역해주세요.
오직 유효한 JSON 형식으로만 응답해야 합니다. 마크다운 백틱(\`\`\`)은 제외하세요.

[원문]
${text}

[출력 형식]
{
  "translatedText": "번역된 결과물"
}
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let translatedTextResponse = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      
      let translatedData;
      try {
        translatedData = JSON.parse(translatedTextResponse);
      } catch (e) {
        translatedTextResponse = translatedTextResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
        translatedData = JSON.parse(translatedTextResponse);
      }

      const translatedText = translatedData.translatedText || `[Translation Failed] ${text}`;

      // 번역본 캐싱 저장 (API 호출 비용 절감 및 히스토리용)
      const translationRef = db.collection("case_translations").doc();
      await translationRef.set({
        caseId,
        sourceText: text,
        sourceLang: "ko", 
        targetLang,
        translatedText,
        provider: "vertex_ai",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return ok(res, { translatedText, translationId: translationRef.id });
    } catch (error: any) {
      logError({
        endpoint: "POST /v1/cases/:caseId/translate",
        code: "INTERNAL",
        messageKo: "번역 요청 실패",
        err: error
      });
      return fail(res, 500, "INTERNAL", "번역 처리 중 오류가 발생했습니다.");
    }
  });

  // 2. 다국어 템플릿 및 메타데이터 조회
  // GET /v1/meta/locales/{locale}/templates
  app.get("/v1/meta/locales/:locale/templates", async (req: Request, res: Response) => {
    const locale = String(req.params.locale || 'en-US');

    try {
      // MVP: 하드코딩된 기본 다국어 템플릿 제공
      const templates: Record<string, any> = {
        "en-US": {
          greeting: "Hello, welcome to AgentRegi.",
          document_request: "Please upload the required documents.",
          status_pending: "Pending",
          status_completed: "Completed"
        },
        "ja-JP": {
          greeting: "こんにちは、AgentRegiへようこそ。",
          document_request: "必要な書類をアップロードしてください。",
          status_pending: "保留中",
          status_completed: "完了"
        },
        "zh-CN": {
          greeting: "你好，欢迎来到AgentRegi。",
          document_request: "请上传所需文件。",
          status_pending: "待处理",
          status_completed: "已完成"
        }
      };
      
      const localeTemplates = templates[locale] || templates["en-US"];
      return ok(res, { locale, templates: localeTemplates });
    } catch (error: any) {
      return fail(res, 500, "INTERNAL", "다국어 템플릿 조회 중 오류가 발생했습니다.");
    }
  });

  // 3. 환율 기반 견적 변환 (Quote Currency Conversion)
  // GET /v1/cases/{caseId}/quote?currency=USD
  app.get("/v1/cases/:caseId/quote", async (req: Request, res: Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const { caseId } = req.params;
      const { currency } = req.query;

      if (!currency) {
        return fail(res, 400, "INVALID_ARGUMENT", "currency 파라미터가 필요합니다. (예: USD)");
      }

      // 실제 caseId로 원화(KRW) 기준 견적(quotes) 가져오기
      const quotesSnap = await db.collection("quotes")
        .where("caseId", "==", caseId)
        .where("status", "==", "finalized")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      let originalAmountKRW = 100000; // Fallback default
      if (!quotesSnap.empty) {
        originalAmountKRW = quotesSnap.docs[0].data().finalPrice || 100000;
      }

      // 외부 환율 API를 통한 변환
      const targetCurrency = String(currency).toUpperCase();
      let exchangeRate = 1;
      let convertedAmount = originalAmountKRW;

      if (targetCurrency !== "KRW") {
        const rates = await fetchRealExchangeRates();
        exchangeRate = rates[targetCurrency] || 1; // 1 USD = ? KRW
        // 원화 / 환율 = 달러
        convertedAmount = originalAmountKRW / exchangeRate;
      }

      const quote = {
        caseId,
        originalCurrency: "KRW",
        originalAmount: originalAmountKRW,
        targetCurrency,
        convertedAmount: Number(convertedAmount.toFixed(2)),
        exchangeRate,
      };

      return ok(res, { quote });
    } catch (error: any) {
      logError({
        endpoint: "GET /v1/cases/:caseId/quote",
        code: "INTERNAL",
        messageKo: "견적 환율 변환 실패",
        err: error
      });
      return fail(res, 500, "INTERNAL", "견적 환율 변환 중 오류가 발생했습니다.");
    }
  });
}