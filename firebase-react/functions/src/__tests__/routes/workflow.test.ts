import request from "supertest";
import express from "express";
import * as admin from "firebase-admin";
import { registerWorkflowRoutes } from "../../routes/v1/workflow";

// Firebase-admin 모킹
jest.mock("firebase-admin", () => {
  const mockDocData = {
    id: "mock-case-id",
    userId: "test-user-uid",
    partnerId: "test-partner-uid",
    status: "draft_filing",
  };

  const mockDocRef = {
    id: "mock-case-id",
    exists: true,
    data: jest.fn(() => mockDocData),
    update: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => mockDocData,
      ref: {
        update: jest.fn().mockResolvedValue(true)
      }
    }),
  };

  const mockCollection = {
    doc: jest.fn(() => mockDocRef),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs: [mockDocRef] }),
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

// requireAuth 미들웨어 모킹
jest.mock("../../lib/auth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    // 테스트에서 헤더를 통해 파트너 여부 설정
    const isPartner = req.headers["x-is-partner"] === "true";
    req.user = { 
      uid: isPartner ? "test-partner-uid" : "test-user-uid", 
      partnerId: isPartner ? "test-partner-uid" : null, 
      isOps: false 
    };
    req.requestId = "test-req-id";
    next();
  },
}));

// ops_audit 모킹
jest.mock("../../lib/ops_audit", () => ({
  logOpsEvent: jest.fn().mockResolvedValue(true),
}));

describe("Workflow Routes (MVP)", () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    registerWorkflowRoutes(app, admin as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("POST /v1/cases/:caseId/events - 유저가 서류 제출(SUBMIT_DOCS) 성공", async () => {
    const res = await request(app)
      .post("/v1/cases/mock-case-id/events")
      .send({ event: "SUBMIT_DOCS" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.event).toBe("SUBMIT_DOCS");
    expect(res.body.data.status).toBe("under_review"); // 상태가 변경되어야 함
  });

  it("POST /v1/cases/:caseId/events - 파트너가 SUBMIT_DOCS 시도 시 403 실패", async () => {
    const res = await request(app)
      .post("/v1/cases/mock-case-id/events")
      .set("x-is-partner", "true") // 파트너로 요청
      .send({ event: "SUBMIT_DOCS" });

    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("GET /v1/cases/:caseId/transitions - 가능한 이벤트 목록 조회", async () => {
    const res = await request(app)
      .get("/v1/cases/mock-case-id/transitions");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.currentStatus).toBe("draft_filing");
    // 유저이고 draft_filing 상태이므로 SUBMIT_DOCS 가 가능해야 함
    expect(res.body.data.allowedEvents).toContain("SUBMIT_DOCS");
  });
});
