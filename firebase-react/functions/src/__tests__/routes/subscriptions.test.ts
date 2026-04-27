import request from "supertest";
import express from "express";
import * as admin from "firebase-admin";
import { registerSubscriptionRoutes } from "../../routes/v1/subscriptions";

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
  requireAuth: jest.fn((req, res) => {
    return Promise.resolve({ uid: "p_123", partnerId: "p_123" });
  }),
  partnerIdOf: jest.fn((auth) => auth.partnerId)
}));

describe("Subscriptions API", () => {
  let app: express.Express;
  let firestoreMock: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    firestoreMock = {
      collection: jest.fn().mockImplementation((col) => {
        if (col === "subscription_plans") {
          return {
            where: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              docs: [{ id: "plan_pro", data: () => ({ name: "Pro", active: true }) }]
            }),
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({ active: true })
              })
            })
          };
        }
        if (col === "partner_subscriptions") {
          return {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              empty: true // 기본적으로 구독이 없다고 가정
            }),
            doc: jest.fn().mockReturnValue({
              id: "sub_123",
              set: jest.fn().mockResolvedValue(true)
            })
          };
        }
        return {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ docs: [] })
        };
      })
    };

    (admin.firestore as unknown as jest.Mock).mockReturnValue(firestoreMock);
    admin.firestore.FieldValue = {
      serverTimestamp: jest.fn().mockReturnValue("mock_timestamp"),
    } as any;
    admin.firestore.Timestamp = {
      fromDate: jest.fn().mockReturnValue("mock_timestamp"),
    } as any;

    registerSubscriptionRoutes(app, admin);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("GET /v1/subscriptions/plans - should return active plans", async () => {
    const res = await request(app).get("/v1/subscriptions/plans");
    expect(res.status).toBe(200);
    expect(res.body.data.plans.length).toBe(1);
    expect(res.body.data.plans[0].id).toBe("plan_pro");
  });

  it("GET /v1/partner/subscription - should return null if no subscription exists", async () => {
    const res = await request(app)
      .get("/v1/partner/subscription")
      .set("Authorization", "Bearer token");
    expect(res.status).toBe(200);
    expect(res.body.data.subscription).toBeNull();
  });

  it("POST /v1/partner/subscription/subscribe - should create new subscription", async () => {
    const res = await request(app)
      .post("/v1/partner/subscription/subscribe")
      .set("Authorization", "Bearer token")
      .send({ planId: "plan_pro", paymentMethodId: "pm_123" });
    
    expect(res.status).toBe(200);
    expect(res.body.data.subscription.status).toBe("active");
    expect(res.body.data.subscription.paymentMethodId).toBe("pm_123");
  });
});
