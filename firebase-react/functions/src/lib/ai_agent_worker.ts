import * as admin from "firebase-admin";
import { VertexAI } from "@google-cloud/vertexai";
import { ChatMessage } from "./chatbot_models";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "agent-eregi";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "asia-northeast3";
const MODEL_NAME = "gemini-1.5-flash-preview-0514";

let vertexAiInstance: VertexAI | null = null;

export class AIAgentWorker {
  private generativeModel: any = null;

  private initModel() {
    if (!this.generativeModel) {
      if (!vertexAiInstance) {
        vertexAiInstance = new VertexAI({ project: PROJECT_ID, location: LOCATION });
      }
      this.generativeModel = vertexAiInstance.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      });
    }
    return this.generativeModel;
  }

  async processUserMessage(
    adminApp: typeof admin,
    sessionId: string,
    userId: string,
    userMessageContent: string
  ): Promise<ChatMessage> {
    const db = adminApp.firestore();
    const sessionRef = db.collection("chatSessions").doc(sessionId);
    const messagesRef = sessionRef.collection("messages");

    // 1. 사용자 메시지 DB 저장
    const userMessageRef = messagesRef.doc();
    const userMessage: Partial<ChatMessage> = {
      id: userMessageRef.id,
      sessionId,
      userId,
      role: "user",
      content: userMessageContent,
      createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
    };
    await userMessageRef.set(userMessage);

    // 2. 대화 기록(Context) 가져오기 (최근 20개)
    const history = await this.getChatHistory(db, sessionId);
    
    // 3. LLM Chat 세션 시작
    const model = this.initModel();
    const chat = model.startChat({
      history: history.map((msg) => ({
        role: msg.role === "system" ? "user" : msg.role, // Vertex AI는 'user'와 'model' 역할 사용
        parts: [{ text: msg.content }],
      })),
    });

    let aiText = "";
    let tokensUsed = 0;

    try {
      // 4. LLM 호출
      const responseStream = await chat.sendMessage([{ text: userMessageContent }]);
      const response = await responseStream.response;
      
      aiText = response.candidates?.[0]?.content?.parts?.[0]?.text || "죄송합니다. 응답을 생성하지 못했습니다.";
      tokensUsed = response.usageMetadata?.totalTokenCount || 0;
    } catch (e: any) {
      console.error("[AIAgentWorker] LLM 호출 실패:", e);
      aiText = "현재 시스템에 일시적인 장애가 있습니다. 잠시 후 다시 시도해주세요.";
    }

    // 5. AI 응답 DB 저장
    const aiMessageRef = messagesRef.doc();
    const aiMessage: Partial<ChatMessage> = {
      id: aiMessageRef.id,
      sessionId,
      userId,
      role: "model",
      content: aiText,
      createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
      metadata: { tokensUsed }
    };
    await aiMessageRef.set(aiMessage);

    // 6. 세션 updatedAt 갱신
    await sessionRef.update({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return aiMessage as ChatMessage;
  }

  private async getChatHistory(db: admin.firestore.Firestore, sessionId: string, limit: number = 20): Promise<ChatMessage[]> {
    const snapshot = await db.collection("chatSessions")
      .doc(sessionId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .limitToLast(limit)
      .get();

    return snapshot.docs.map(doc => doc.data() as ChatMessage);
  }
}

export const aiAgentWorker = new AIAgentWorker();