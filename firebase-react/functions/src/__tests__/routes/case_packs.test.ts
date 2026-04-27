import request from "supertest";
import express from "express";
import * as admin from "firebase-admin";
import { registerCasePackRoutes } from "../../routes/v1/case_packs";

jest.mock("firebase-admin", () => {
  const firestoreMock = {
    collection: jest.fn(),
  };
  return {
    firestore: jest.fn(() => firestoreMock),
    app: jest.fn(),
  };
});

describe("Case Packs API", () => {
  let app: express.Express;
  let firestoreMock: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    firestoreMock = {
      collection: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [
          { id: "pack_1", data: () => ({ nameKo: "부동산 이전", active: true }) }
        ]
      }),
      doc: jest.fn().mockImplementation((id: string) => ({
        get: jest.fn().mockResolvedValue({
          exists: id === "pack_1",
          id,
          data: () => ({ nameKo: "부동산 이전", active: true, formSchema: {} })
        })
      }))
    };

    (admin.firestore as unknown as jest.Mock).mockReturnValue(firestoreMock);

    registerCasePackRoutes(app, admin);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("GET /v1/case-packs - should return list of active case packs", async () => {
    const res = await request(app).get("/v1/case-packs");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.packs).toHaveLength(1);
    expect(res.body.data.packs[0].id).toBe("pack_1");
  });

  it("GET /v1/case-packs/:casePackId - should return specific case pack", async () => {
    const res = await request(app).get("/v1/case-packs/pack_1");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.pack.id).toBe("pack_1");
  });

  it("GET /v1/case-packs/:casePackId - should return 404 if not found", async () => {
    const res = await request(app).get("/v1/case-packs/invalid_pack");
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });
});
