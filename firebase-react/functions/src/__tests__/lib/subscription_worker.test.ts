import * as admin from "firebase-admin";
import { executeSubscriptionBillingBatch, chargePaymentMethod } from "../../lib/subscription_worker";

jest.mock("firebase-admin", () => {
  const firestoreMock = {
    collection: jest.fn(),
  };
  return {
    firestore: jest.fn(() => firestoreMock),
  };
});

describe("Subscription Worker", () => {
  let firestoreMock: any;

  beforeEach(() => {
    firestoreMock = {
      collection: jest.fn().mockImplementation((col) => {
        if (col === "subscription_plans") {
          return {
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({ name: "Pro", price: 50000, interval: "month", currency: "KRW" })
              })
            })
          };
        }
        if (col === "partner_subscriptions") {
          return {
            where: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              docs: [] // Mock empty by default
            })
          };
        }
        return {
          add: jest.fn().mockResolvedValue(true)
        };
      })
    };

    (admin.firestore as unknown as jest.Mock).mockReturnValue(firestoreMock);
    admin.firestore.FieldValue = {
      serverTimestamp: jest.fn().mockReturnValue("mock_timestamp"),
    } as any;
    admin.firestore.Timestamp = {
      fromDate: jest.fn().mockImplementation((d) => d),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should charge payment method with 90% success rate (mock function test)", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.5); // Success
    const res1 = await chargePaymentMethod("pm_123", 50000);
    expect(res1).toBe(true);

    jest.spyOn(Math, "random").mockReturnValue(0.95); // Fail
    const res2 = await chargePaymentMethod("pm_123", 50000);
    expect(res2).toBe(false);

    jest.restoreAllMocks();
  });

  it("should process active subscriptions successfully", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.5); // Force success
    
    const mockUpdate = jest.fn().mockResolvedValue(true);
    const mockNow = new Date("2026-05-01T00:00:00Z");
    
    firestoreMock.collection.mockImplementation((col: string) => {
      if (col === "partner_subscriptions") {
        return {
          where: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValueOnce({
            docs: [{
              id: "sub_123",
              ref: { update: mockUpdate },
              data: () => ({
                partnerId: "p_123",
                planId: "plan_pro",
                status: "active",
                currentPeriodEnd: { toDate: () => mockNow },
                cancelAtPeriodEnd: false
              })
            }]
          }).mockResolvedValueOnce({ docs: [] }) // For past_due Dunning
        };
      }
      if (col === "subscription_plans") {
        return {
          doc: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({ price: 50000, interval: "month", currency: "KRW" })
            })
          })
        };
      }
      return { add: jest.fn() };
    });

    await executeSubscriptionBillingBatch(admin.firestore(), mockNow);

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      currentPeriodStart: mockNow,
      // end should be +1 month
    }));
  });

  it("should process past_due subscriptions and cancel if > 7 days", async () => {
    const mockUpdate = jest.fn().mockResolvedValue(true);
    const mockNow = new Date("2026-05-10T00:00:00Z");
    const mockPastDue = new Date("2026-05-01T00:00:00Z"); // 9 days ago
    
    // Reset the mock specifically for this test
    let activeCalled = false;
    firestoreMock.collection.mockImplementation((col: string) => {
      if (col === "partner_subscriptions") {
        return {
          where: jest.fn().mockReturnThis(),
          get: jest.fn().mockImplementation(() => {
            if (!activeCalled) {
              activeCalled = true;
              return Promise.resolve({ docs: [] });
            }
            return Promise.resolve({
              docs: [{
                id: "sub_123",
                ref: { update: mockUpdate },
                data: () => ({
                  partnerId: "p_123",
                  status: "past_due",
                  currentPeriodEnd: { toDate: () => mockPastDue },
                })
              }]
            });
          })
        };
      }
      return { add: jest.fn() };
    });

    await executeSubscriptionBillingBatch(admin.firestore(), mockNow);

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "canceled"
    }));
  });
});