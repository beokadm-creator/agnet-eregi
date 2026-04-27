import request from "supertest";
import express from "express";
import * as admin from "firebase-admin";
import { registerPartnerRoutes } from "../../routes/v1/partner";

// Firebase-admin 초기화 모킹
jest.mock("firebase-admin", () => {
  const mockDoc = {
    id: "mock-partner-id",
    exists: true,
    data: () => ({
      id: "mock-partner-id",
      name: "Test Partner",
      rating: 4.5,
      isAvailable: true,
    }),
  };

  const mockQuery = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs: [mockDoc] }),
  };

  const mockCollection = {
    doc: jest.fn((id) => ({
      id: id || "mock-partner-id",
      set: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(mockDoc),
      update: jest.fn().mockResolvedValue(true),
    })),
    where: jest.fn().mockReturnValue(mockQuery),
  };

  const firestoreMock = jest.fn(() => ({
    collection: jest.fn(() => mockCollection),
  })) as any;

  firestoreMock.FieldValue = {
    serverTimestamp: jest.fn(() => "mock-timestamp"),
  };

  return {
    firestore: firestoreMock,
    app: {
      App: class {},
    },
  };
});

// requireAuth 미들웨어 모킹 (테스트용)
jest.mock("../../lib/auth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    // 테스트 목적: 'Bearer invalid' 헤더가 오면 실패 처리
    if (req.headers.authorization === "Bearer invalid") {
      return res.status(401).json({ ok: false, error: { code: "UNAUTHENTICATED" } });
    }

    // 파트너 ID 세팅
    req.user = { uid: "test-user-uid", partnerId: "test-partner-id", isOps: false };
    req.requestId = "test-req-id";
    next();
  },
}));

// ops_audit 모킹
jest.mock("../../lib/ops_audit", () => ({
  logOpsEvent: jest.fn().mockResolvedValue(true),
}));

describe("Partner Routes (API Keys)", () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    registerPartnerRoutes(app, admin as any);
  });

  it("POST /v1/partner/api-keys - API 키 성공적으로 생성", async () => {
    const res = await request(app)
      .post("/v1/partner/api-keys")
      .set("Authorization", "Bearer valid-token")
      .send();

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.apiKey).toBeDefined();
    expect(typeof res.body.data.apiKey).toBe("string");
    // 32 bytes hex string = 64 characters
    expect(res.body.data.apiKey.length).toBe(64);
  });
});
