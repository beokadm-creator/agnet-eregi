import * as admin from "firebase-admin";

export type ChatSessionStatus = "active" | "archived" | "deleted";

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  status: ChatSessionStatus;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  metadata?: Record<string, any>;
}

export type ChatRole = "user" | "model" | "system";

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  role: ChatRole;
  content: string;
  createdAt: admin.firestore.Timestamp;
  metadata?: {
    tokensUsed?: number;
    intent?: string;
    [key: string]: any;
  };
}