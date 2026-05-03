import request from "supertest";
import express from "express";
import * as admin from "firebase-admin";
import { registerFunnelRoutes } from "../../routes/v1/funnel";

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  const firestoreMock = {
    collection: jest.fn(),
    runTransaction: jest.fn()
  };
  return {
    firestore: jest.fn(() => firestoreMock),
    app: jest.fn()
  };
});

describe("Funnel API", () => {
  let app: express.Express;
  let firestoreMock: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    firestoreMock = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockImplementation((id?: string) => ({
        id: id || "mock_doc_id",
        set: jest.fn().mockResolvedValue(true),
        get: jest.fn().mockResolvedValue({ 
          exists: true, 
          data: () => ({ 
            answers: {}, 
            scenarioKey: "corp_default",
            scenarioVersion: 1,
            status: "started", 
            preview: { minPrice: 150000, maxPrice: 300000, etaDays: 3, requiredDocs: [] } 
          }) 
        }),
        update: jest.fn().mockResolvedValue(true),
      })),
      set: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ answers: {}, status: "started" }) }),
      add: jest.fn().mockResolvedValue({ id: "event_id" }),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      runTransaction: jest.fn()
    };

    (admin.firestore as unknown as jest.Mock).mockReturnValue(firestoreMock);
    // Mock FieldValue.serverTimestamp
    admin.firestore.FieldValue = {
      serverTimestamp: jest.fn().mockReturnValue("mock_timestamp"),
      increment: jest.fn(),
      arrayUnion: jest.fn(),
      arrayRemove: jest.fn(),
      delete: jest.fn(),
    } as any;

    registerFunnelRoutes(app, admin);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("POST /v1/funnel/intent - should create a new session", async () => {
    const res = await request(app)
      .post("/v1/funnel/intent")
      .send({ intentText: "임원 변경" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.sessionId).toBeDefined();
    expect(res.body.data.nextQuestion).toBeDefined();
    expect(res.body.data.nextQuestion.id).toBe("q_officer_kind");

    expect(firestoreMock.add).toHaveBeenCalledWith(expect.objectContaining({
      type: "INTENT_SUBMITTED",
      payload: { intentText: "임원 변경" }
    }));
  });

  it("POST /v1/funnel/intent - should fail if intentText is missing", async () => {
    const res = await request(app)
      .post("/v1/funnel/intent")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it("POST /v1/funnel/sessions/:sessionId/answer - should update answers", async () => {
    firestoreMock.runTransaction.mockImplementation(async (callback: any) => {
      const transactionMock = {
        get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ answers: {}, status: "started" }) }),
        update: jest.fn(),
        set: jest.fn()
      };
      await callback(transactionMock);
    });

    const res = await request(app)
      .post("/v1/funnel/sessions/sess_123/answer")
      .send({ questionId: "q_registry_type", answer: "법인 설립" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.nextQuestion.id).toBe("q_corp_type");
    expect(res.body.data.isCompleted).toBe(false);
    expect(res.body.data.preview).toBeDefined();
  });

  it("GET /v1/funnel/sessions/:sessionId/results - should return ranked partners", async () => {
    // Mock partners snapshot
    const mockPartners = [
      { id: "p1", data: () => ({ name: "Partner A", rating: 4.5, price: 100000, etaHours: 24, slaComplianceRate: 90, isSponsored: false }) },
      { id: "p2", data: () => ({ name: "Partner B", rating: 4.8, price: 150000, etaHours: 12, slaComplianceRate: 95, isSponsored: true }) },
      { id: "p3", data: () => ({ name: "Partner C", rating: 3.5, price: 50000, etaHours: 48, slaComplianceRate: 80, isSponsored: false }) }
    ];
    
    // We already mocked doc().get() in beforeEach to return { status: "started" }, let's override for this test
    firestoreMock.collection = jest.fn().mockImplementation((path: string) => {
      if (path === "funnel_sessions") {
        return {
          doc: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ status: "completed" }) })
          }),
          add: firestoreMock.add
        };
      } else if (path === "partners") {
        return {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ docs: mockPartners })
        };
      } else if (path === "funnel_events") {
        return {
          add: firestoreMock.add
        };
      }
      return firestoreMock;
    });

    const res = await request(app).get("/v1/funnel/sessions/sess_123/results");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.sponsored.length).toBe(1);
    expect(res.body.data.sponsored[0].name).toBe("Partner B");
    expect(res.body.data.sponsored[0].disclosure).toBe("Sponsored Partner");
    
    expect(res.body.data.recommended).toBeDefined();
    expect(res.body.data.compareTop3).toBeDefined();

    expect(firestoreMock.add).toHaveBeenCalledWith(expect.objectContaining({
      type: "RESULTS_VIEWED"
    }));
  });
});
