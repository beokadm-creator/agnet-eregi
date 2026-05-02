import * as admin from "firebase-admin";
import { ChatMessage } from "./chatbot_models";
import { llmChatComplete } from "./llm_engine";

export class AIAgentWorker {
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

    let aiText = "";
    let tokensUsed = 0;

    try {
      const system = {
        role: "system" as const,
        content:
          "당신은 agentregi 서비스의 사용자 지원 AI입니다. 사용자의 자연어 질문에 간결하고 정확하게 답하고, 가능한 경우 항상 다음 단계(CTA)를 1~3개 제안합니다. " +
          "CTA는 다음 중에서 선택해 안내합니다: (1) 퍼널 진단 시작: /funnel, (2) 제출/진행 확인: / 또는 /submissions/{id}, (3) 파트너 선택 및 제출 진행은 퍼널 결과에서 진행. " +
          "확실하지 않으면 질문 1~2개로 정보를 확인한 뒤 CTA를 제안합니다. 개인/결제/계정 정보는 요구하지 마세요.",
      };

      const messages = [
        system,
        ...history.map((msg) => ({
          role: (msg.role === "model" ? "assistant" : "user") as "assistant" | "user",
          content: msg.content,
        })),
      ];
      const out = await llmChatComplete(adminApp, messages, { temperature: 0.4, maxTokens: 2048 });
      aiText = out.text || "죄송합니다. 응답을 생성하지 못했습니다.";
      tokensUsed = out.usage?.totalTokens || 0;
    } catch (e: any) {
      console.error("[AIAgentWorker] LLM 호출 실패:", e instanceof Error ? e.message : String(e));
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
