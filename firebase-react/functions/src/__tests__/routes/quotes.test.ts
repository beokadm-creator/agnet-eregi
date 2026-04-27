import request from "supertest";
import express from "express";
import * as admin from "firebase-admin";
import { registerQuoteRoutes } from "../../routes/v1/quotes";

jest.mock("firebase-admin", () => {
  const firestoreMock = {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  };
  return {
    firestore: jest.fn(() => firestoreMock),
    app: jest.fn(),
  };
});

jest.mock("../../lib/auth", () => ({
  requireAuth: jest.fn((req, res, next) => {
    // default user mock (User role)
    req.user = req.headers.authorization === "Bearer partner" 
      ? { uid: "p_123", partnerId: "p_123" }
      : { uid: "u_123" };
    next();
  })
}));

jest.mock("../../lib/ops_audit", () => ({
  logOpsEvent: jest.fn().mockResolvedValue(true)
}));

describe("Quotes API", () => {
  let app: express.Express;
  let firestoreMock: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    const docMock = (id?: string) => ({
      id: id || "mock_doc_id",
      set: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue({ 
        exists: true, 
        data: () => ({ 
          userId: "u_123", 
          partnerId: "p_123",
          status: "draft",
          priceMax: 300000,
          finalPrice: 200000
        }) 
      }),
      update: jest.fn().mockResolvedValue(true),
      collection: jest.fn().mockImplementation(() => ({
        doc: jest.fn().mockImplementation(docMock),
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ docs: [] })
      }))
    });

    firestoreMock = {
      collection: jest.fn().mockImplementation(() => ({
        doc: jest.fn().mockImplementation(docMock),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      })),
      runTransaction: jest.fn(),
    };

    (admin.firestore as unknown as jest.Mock).mockReturnValue(firestoreMock);
    admin.firestore.FieldValue = {
      serverTimestamp: jest.fn().mockReturnValue("mock_timestamp"),
    } as any;

    registerQuoteRoutes(app, admin);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("POST /v1/partner/cases/:caseId/quotes/draft - should create a draft quote", async () => {
    const res = await request(app)
      .post("/v1/partner/cases/c_123/quotes/draft")
      .set("Authorization", "Bearer partner")
      .send({ priceMin: 150000, priceMax: 200000 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("draft");
  });

  it("POST /v1/partner/cases/:caseId/quotes/draft - should fail for non-partners", async () => {
    const res = await request(app)
      .post("/v1/partner/cases/c_123/quotes/draft")
      .set("Authorization", "Bearer user")
      .send({ priceMin: 150000, priceMax: 200000 });

    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });

  it("POST /v1/partner/cases/:caseId/quotes/:quoteId/finalize - should finalize quote", async () => {
    const res = await request(app)
      .post("/v1/partner/cases/c_123/quotes/q_123/finalize")
      .set("Authorization", "Bearer partner")
      .send({ finalPrice: 180000, assumptionsKo: ["공과금 별도"] });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("finalized");
  });

  it("POST /v1/partner/cases/:caseId/quotes/:quoteId/finalize - should require approval if price exceeds max limit", async () => {
    const res = await request(app)
      .post("/v1/partner/cases/c_123/quotes/q_123/finalize")
      .set("Authorization", "Bearer partner")
      .send({ finalPrice: 2000000 }); // Exceeds 1,000,000 threshold

    expect(res.status).toBe(412); // APPROVAL_REQUIRED
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("APPROVAL_REQUIRED");
    expect(res.body.error.approvalId).toBeDefined();
  });

  it("POST /v1/user/cases/:caseId/quotes/:quoteId/accept - should accept quote", async () => {
    // Mock finalized status for the quote doc inside transaction
    firestoreMock.runTransaction.mockImplementation(async (callback: any) => {
      const transactionMock = {
        get: jest.fn().mockResolvedValue({ 
          exists: true, 
          data: () => ({ status: "finalized", finalPrice: 200000 }) 
        }),
        update: jest.fn(),
      };
      await callback(transactionMock);
    });

    const res = await request(app)
      .post("/v1/user/cases/c_123/quotes/q_123/accept")
      .set("Authorization", "Bearer user")
      .set("Idempotency-Key", "test_idem_key_1")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("accepted");
  });
});
