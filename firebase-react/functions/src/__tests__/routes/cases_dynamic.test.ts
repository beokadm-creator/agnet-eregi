import request from "supertest";
import express from "express";
import * as admin from "firebase-admin";
import { registerCaseRoutes } from "../../routes/v1/cases";
import { registerWorkflowRoutes } from "../../routes/v1/workflow";

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
    req.user = { uid: "u_123" };
    next();
  }),
}));

jest.mock("../../lib/ops_audit", () => ({
  logOpsEvent: jest.fn().mockResolvedValue(true)
}));

describe("Cases Dynamic Form API", () => {
  let app: express.Express;
  let firestoreMock: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    firestoreMock = {
      collection: jest.fn().mockImplementation((col) => {
        if (col === "cases") {
          return {
            doc: jest.fn().mockImplementation((id: string) => ({
              get: jest.fn().mockResolvedValue({
                exists: true,
                id: id || "c_123",
                data: () => ({
                  userId: "u_123",
                  casePackId: "real_estate_transfer_v1",
                  status: "waiting_partner",
                  dynamicData: { existingKey: "oldValue" }
                })
              })
            }))
          };
        }
        if (col === "case_packs") {
          return {
            doc: jest.fn().mockImplementation((id: string) => ({
              get: jest.fn().mockResolvedValue({
                exists: true,
                id,
                data: () => ({
                  workflow: { stages: ["draft_filing"], requiredSlots: ["slot_1"] }
                })
              })
            }))
          };
        }
        return {};
      }),
      runTransaction: jest.fn(async (cb) => {
        const transactionMock = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ userId: "u_123", dynamicData: { existingKey: "oldValue" } })
          }),
          update: jest.fn()
        };
        await cb(transactionMock);
      })
    };

    (admin.firestore as unknown as jest.Mock).mockReturnValue(firestoreMock);
    admin.firestore.FieldValue = {
      serverTimestamp: jest.fn().mockReturnValue("mock_timestamp"),
    } as any;

    registerCaseRoutes(app, admin);
    registerWorkflowRoutes(app, admin);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("POST /v1/cases - should create case with casePackId", async () => {
    firestoreMock.collection.mockImplementation((col: string) => {
      if (col === "cases") {
        return {
          doc: jest.fn().mockReturnValue({
            id: "new_case_1",
            set: jest.fn().mockResolvedValue(true)
          })
        };
      }
      return {};
    });

    const res = await request(app)
      .post("/v1/cases")
      .send({ casePackId: "real_estate_transfer_v1", intentData: {} });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.casePackId).toBe("real_estate_transfer_v1");
  });

  it("POST /v1/cases/:caseId/forms/dynamic - should update dynamicData", async () => {
    const res = await request(app)
      .post("/v1/cases/c_123/forms/dynamic")
      .send({ dynamicData: { newField: "newValue" } });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.message).toContain("동적 폼 데이터");
  });

  it("GET /v1/cases/:caseId/workflow - should return dynamic workflow data", async () => {
    const res = await request(app).get("/v1/cases/c_123/workflow");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.caseId).toBe("c_123");
    expect(res.body.data.stages).toContain("draft_filing");
    expect(res.body.data.requiredSlots).toContain("slot_1");
  });
});
