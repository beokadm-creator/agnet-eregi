import request from "supertest";
import express from "express";
import * as admin from "firebase-admin";

import { registerPaymentRoutes } from "../../routes/v1/payments";
import { registerB2bRoutes } from "../../routes/v1/b2b";

jest.mock("firebase-admin", () => {
  const mockDocRef = {
    id: "mock-doc-id",
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        status: "active",
        companyName: "Test Company",
        hashedSecret: "secret-123",
      }),
    }),
    set: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockResolvedValue(true),
  };

  const mockCollection = {
    doc: jest.fn(() => mockDocRef),
  };

  const firestoreMock = jest.fn(() => ({
    collection: jest.fn(() => mockCollection),
    batch: jest.fn(() => ({
      set: jest.fn(),
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(true),
    })),
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

jest.mock("../../lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue({
    uid: "user_123",
    email: "tester@example.com",
  }),
}));

jest.mock("../../lib/ops_audit", () => ({
  logOpsEvent: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../lib/b2b_webhook_worker", () => ({
  enqueueB2bWebhook: jest.fn().mockResolvedValue(true),
}));

describe("runtime config guards", () => {
  const originalStripeSecret = process.env.STRIPE_SECRET_KEY;
  const originalClientBaseUrl = process.env.CLIENT_BASE_URL;
  const originalB2bJwtSecret = process.env.B2B_JWT_SECRET;

  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    process.env.CLIENT_BASE_URL = "https://example.com";
    delete process.env.B2B_JWT_SECRET;
  });

  afterAll(() => {
    process.env.STRIPE_SECRET_KEY = originalStripeSecret;
    process.env.CLIENT_BASE_URL = originalClientBaseUrl;
    process.env.B2B_JWT_SECRET = originalB2bJwtSecret;
  });

  it("blocks stripe payment creation when STRIPE_SECRET_KEY is missing", async () => {
    const app = express();
    app.use(express.json());
    registerPaymentRoutes(app, admin as any);

    const response = await request(app)
      .post("/v1/user/payments")
      .send({ amount: 10000, currency: "KRW", provider: "stripe" });

    expect(response.status).toBe(500);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.code).toBe("FAILED_PRECONDITION");
    expect(response.body.error.messageKo).toContain("STRIPE_SECRET_KEY");
  });

  it("blocks b2b token issuance when B2B_JWT_SECRET is missing", async () => {
    const app = express();
    app.use(express.json());
    registerB2bRoutes(app, admin as any);

    const response = await request(app)
      .post("/v1/b2b/auth/token")
      .send({ clientId: "client-1", clientSecret: "secret-123" });

    expect(response.status).toBe(500);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.code).toBe("FAILED_PRECONDITION");
    expect(response.body.error.messageKo).toContain("B2B_JWT_SECRET");
  });
});
