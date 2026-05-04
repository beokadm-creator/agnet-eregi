import request from "supertest";
import express from "express";
import * as admin from "firebase-admin";
import { registerCaseRoutes } from "../../routes/v1/cases";

// Firebase-admin 초기화 모킹
jest.mock("firebase-admin", () => {
  const mockDoc = {
    id: "mock-case-id",
    exists: true,
    data: () => ({
      id: "mock-case-id",
      userId: "test-user-uid",
      partnerId: null,
      status: "draft_filing",
      type: "corp_officer_change_v1",
      intentData: { note: "test" },
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
      id: id || "mock-case-id",
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

    // 기본적으로 'test-user-uid' 로 인증된 것으로 취급
    req.user = { uid: "test-user-uid", partnerId: null, isOps: false };
    req.requestId = "test-req-id";
    next();
  },
}));

// ops_audit 모킹
jest.mock("../../lib/ops_audit", () => ({
  logOpsEvent: jest.fn().mockResolvedValue(true),
}));

describe("Cases Routes (MVP)", () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // 라우트 등록 시 모킹된 admin 전달
    registerCaseRoutes(app, admin as any);
  });

  it("POST /v1/cases - 성공적으로 케이스 생성", async () => {
    const res = await request(app)
      .post("/v1/cases")
      .set("Authorization", "Bearer valid-token")
      .send({ type: "corp_officer_change_v1", intentData: { note: "test" } });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.type).toBe("corp_officer_change_v1");
    expect(res.body.data.status).toBe("waiting_partner");
    expect(res.body.data.userId).toBe("test-user-uid");
  });

  it("POST /v1/cases - type 파라미터 누락 시 400 실패", async () => {
    const res = await request(app)
      .post("/v1/cases")
      .set("Authorization", "Bearer valid-token")
      .send({ intentData: {} });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("INVALID_ARGUMENT");
  });

  it("GET /v1/cases - 내 케이스 목록 조회", async () => {
    const res = await request(app)
      .get("/v1/cases")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.cases).toBeInstanceOf(Array);
    expect(res.body.data.cases[0].id).toBe("mock-case-id");
  });

  it("GET /v1/cases/:caseId - 상세 조회 성공", async () => {
    const res = await request(app)
      .get("/v1/cases/mock-case-id")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe("mock-case-id");
  });

  it("GET /v1/cases/:caseId - 인증 실패 시 401", async () => {
    const res = await request(app)
      .get("/v1/cases/mock-case-id")
      .set("Authorization", "Bearer invalid"); // 모킹된 실패 조건

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
