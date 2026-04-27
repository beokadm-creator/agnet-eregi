import { getPayoutProvider, MockPayoutProvider, ManualPayoutProvider } from "../../lib/payout_provider";

describe("PayoutProvider", () => {
  it("should return ManualPayoutProvider by default or when providerName is manual", () => {
    const manualProvider = getPayoutProvider("manual");
    expect(manualProvider).toBeInstanceOf(ManualPayoutProvider);

    const defaultProvider = getPayoutProvider("unknown");
    expect(defaultProvider).toBeInstanceOf(ManualPayoutProvider);
  });

  it("should return MockPayoutProvider when providerName is mock", () => {
    const mockProvider = getPayoutProvider("mock");
    expect(mockProvider).toBeInstanceOf(MockPayoutProvider);
  });

  describe("ManualPayoutProvider", () => {
    it("should return success with manual_pending providerRef", async () => {
      const provider = new ManualPayoutProvider();
      const result = await provider.pay("settlement_1", 1000, {});
      
      expect(result.success).toBe(true);
      expect(result.providerRef).toBe("manual_pending");
      expect(result.payoutAttemptId).toMatch(/^manual_attempt_/);
    });
  });

  describe("MockPayoutProvider", () => {
    it("should simulate a payment attempt", async () => {
      const provider = new MockPayoutProvider();
      
      // Since it has a 10% failure rate, we mock Math.random to always succeed for this test
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.5); // Greater than 0.1, so it succeeds

      const result = await provider.pay("settlement_2", 2000, {});
      
      expect(result.success).toBe(true);
      expect(result.providerRef).toMatch(/^mock_ref_/);
      expect(result.payoutAttemptId).toMatch(/^mock_attempt_/);

      Math.random = jest.fn(() => 0.05); // Less than 0.1, so it fails
      const failedResult = await provider.pay("settlement_3", 3000, {});
      
      expect(failedResult.success).toBe(false);
      expect(failedResult.error).toBe("Simulated mock provider failure");
      expect(failedResult.payoutAttemptId).toMatch(/^mock_attempt_/);

      Math.random = originalRandom; // Restore
    });
  });
});
