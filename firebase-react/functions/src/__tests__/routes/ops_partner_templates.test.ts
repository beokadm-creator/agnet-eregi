import request from "supertest";
import express from "express";
import * as admin from "firebase-admin";
import { registerOpsPartnersRoutes } from "../../routes/v1/ops_partners";
import { registerOpsPartnerTaxonomyRoutes } from "../../routes/v1/ops_partner_taxonomy";

jest.mock("../../lib/auth", () => ({
  requireAuth: jest.fn(async () => ({ uid: "ops-uid", opsRole: "ops_admin" })),
  isOps: jest.fn(() => true),
}));

jest.mock("../../lib/ops_rbac", () => ({
  requireOpsRole: jest.fn(async () => true),
}));

jest.mock("../../lib/ops_audit", () => ({
  logOpsEvent: jest.fn(async () => true),
}));

jest.mock("firebase-admin", () => {
  const firestoreMock: any = {
    collection: jest.fn(),
  };

  const firestoreFn: any = jest.fn(() => firestoreMock);
  firestoreFn.FieldValue = {
    serverTimestamp: jest.fn(() => "mock-timestamp"),
  };

  return {
    firestore: firestoreFn,
    app: jest.fn(),
  };
});

describe("Ops templates/taxonomy routes", () => {
  let app: express.Express;
  let firestoreMock: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    firestoreMock = (admin.firestore as unknown as jest.Mock)();
    firestoreMock.collection = jest.fn().mockImplementation((path: string) => {
      if (path === "ops_settings") {
        return {
          doc: jest.fn().mockImplementation(() => ({
            get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
            set: jest.fn().mockResolvedValue(true),
          })),
        };
      }
      if (path === "partners") {
        return {
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ docs: [] }),
          doc: jest.fn().mockImplementation((id?: string) => ({
            id: id || "p1",
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
            set: jest.fn().mockResolvedValue(true),
          })),
        };
      }
      return {
        doc: jest.fn().mockImplementation(() => ({
          get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
          set: jest.fn().mockResolvedValue(true),
        })),
      };
    });

    registerOpsPartnersRoutes(app, admin as any);
    registerOpsPartnerTaxonomyRoutes(app, admin as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("GET /v1/ops/partners/templates returns templates and scenarioKeys", async () => {
    const res = await request(app).get("/v1/ops/partners/templates");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data.templates)).toBe(true);
    expect(res.body.data.templates.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.scenarioKeys)).toBe(true);
    expect(res.body.data.scenarioKeys).toEqual(expect.arrayContaining(["corp_establishment"]));
    expect(res.body.data.taxonomy.specialties).toEqual(expect.arrayContaining(["설립"]));
  });

  it("GET /v1/ops/settings/partner-taxonomy returns scenarioKeys", async () => {
    const res = await request(app).get("/v1/ops/settings/partner-taxonomy");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data.scenarioKeys)).toBe(true);
    expect(res.body.data.scenarioKeys).toEqual(expect.arrayContaining(["corp_establishment"]));
  });
});

