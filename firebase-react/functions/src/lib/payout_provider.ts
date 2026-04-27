export interface PayoutResult {
  success: boolean;
  providerRef?: string;
  error?: string;
  payoutAttemptId: string;
}

export interface PayoutProvider {
  pay(settlementId: string, amount: number, accountInfo: any): Promise<PayoutResult>;
}

export class MockPayoutProvider implements PayoutProvider {
  async pay(settlementId: string, amount: number, accountInfo: any): Promise<PayoutResult> {
    const attemptId = `mock_attempt_${Date.now()}`;
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate 10% failure rate for testing
    if (Math.random() < 0.1) {
      return {
        success: false,
        error: "Simulated mock provider failure",
        payoutAttemptId: attemptId,
      };
    }

    return {
      success: true,
      providerRef: `mock_ref_${Date.now()}`,
      payoutAttemptId: attemptId,
    };
  }
}

export class ManualPayoutProvider implements PayoutProvider {
  async pay(settlementId: string, amount: number, accountInfo: any): Promise<PayoutResult> {
    const attemptId = `manual_attempt_${Date.now()}`;
    return {
      success: true,
      providerRef: "manual_pending",
      payoutAttemptId: attemptId,
    };
  }
}

export function getPayoutProvider(providerName: string): PayoutProvider {
  if (providerName === "mock") {
    return new MockPayoutProvider();
  }
  return new ManualPayoutProvider();
}
