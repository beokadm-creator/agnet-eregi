import { Express } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { aiAgentWorker } from "../../lib/ai_agent_worker";
import { ChatSession } from "../../lib/chatbot_models";

export function registerChatbotRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 새 채팅 세션 생성
  app.post("/v1/chatbot/sessions", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    try {
      const userId = (req as any).user.uid;
      const { title = "새로운 대화" } = req.body;
      
      const sessionRef = db.collection("chatSessions").doc();
      const newSession: Partial<ChatSession> = {
        id: sessionRef.id,
        userId,
        title,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
      };
      
      await sessionRef.set(newSession);
      return ok(res, newSession, requestId);
    } catch (error: any) {
      logError({ endpoint: "POST /v1/chatbot/sessions", code: "INTERNAL", messageKo: "채팅 세션 생성 실패", err: error });
      return fail(res, 500, "INTERNAL", "채팅 세션 생성에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. 내 채팅 세션 목록 조회
  app.get("/v1/chatbot/sessions", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    try {
      const userId = (req as any).user.uid;
      
      const snapshot = await db.collection("chatSessions")
        .where("userId", "==", userId)
        .where("status", "==", "active")
        .orderBy("updatedAt", "desc")
        .get();
        
      const sessions = snapshot.docs.map(doc => doc.data());
      return ok(res, sessions, requestId);
    } catch (error: any) {
      logError({ endpoint: "GET /v1/chatbot/sessions", code: "INTERNAL", messageKo: "세션 목록 조회 실패", err: error });
      return fail(res, 500, "INTERNAL", "세션 목록 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 3. 메시지 전송 및 AI 응답 받기
  app.post("/v1/chatbot/sessions/:sessionId/messages", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    try {
      const userId = (req as any).user.uid;
      const sessionId = String(req.params.sessionId);
      const { content } = req.body;

      if (!content) {
        return fail(res, 400, "INVALID_ARGUMENT", "메시지 내용(content)은 필수입니다.", { requestId });
      }

      // 세션 소유권 확인
      const sessionDoc = await db.collection("chatSessions").doc(sessionId).get();
      if (!sessionDoc.exists || sessionDoc.data()?.userId !== userId) {
        return fail(res, 404, "NOT_FOUND", "채팅 세션을 찾을 수 없거나 권한이 없습니다.", { requestId });
      }

      // AI 워커를 통해 사용자 메시지 처리 및 모델 응답 생성
      const aiResponse = await aiAgentWorker.processUserMessage(adminApp, sessionId, userId, content);
      
      return ok(res, aiResponse, requestId);
    } catch (error: any) {
      logError({ endpoint: "POST /v1/chatbot/sessions/:sessionId/messages", code: "INTERNAL", messageKo: "메시지 처리 실패", err: error });
      return fail(res, 500, "INTERNAL", "메시지 처리에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 4. 특정 세션의 채팅 기록 조회
  app.get("/v1/chatbot/sessions/:sessionId/messages", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    try {
      const userId = (req as any).user.uid;
      const sessionId = String(req.params.sessionId);

      // 세션 소유권 확인
      const sessionDoc = await db.collection("chatSessions").doc(sessionId).get();
      if (!sessionDoc.exists || sessionDoc.data()?.userId !== userId) {
        return fail(res, 404, "NOT_FOUND", "채팅 세션을 찾을 수 없거나 권한이 없습니다.", { requestId });
      }

      const snapshot = await db.collection("chatSessions")
        .doc(sessionId)
        .collection("messages")
        .orderBy("createdAt", "asc")
        .get();
        
      const messages = snapshot.docs.map(doc => doc.data());
      return ok(res, messages, requestId);
    } catch (error: any) {
      logError({ endpoint: "GET /v1/chatbot/sessions/:sessionId/messages", code: "INTERNAL", messageKo: "메시지 기록 조회 실패", err: error });
      return fail(res, 500, "INTERNAL", "메시지 기록 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });
}