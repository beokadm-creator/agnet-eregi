import { computeSignature, dispatchWebhook } from "../../lib/webhook";
import axios from "axios";
import * as crypto from "crypto";

jest.mock("axios");

describe("Webhook Delivery Service", () => {
  const secret = "test_secret_123";
  const payload = {
    eventId: "evt_1",
    eventType: "case.created",
    resourceId: "case_1",
    data: { foo: "bar" },
    createdAt: "2024-04-27T00:00:00Z"
  };

  it("should compute correct HMAC signature", () => {
    const bodyString = JSON.stringify(payload);
    const signature = computeSignature(bodyString, secret);
    const expected = crypto.createHmac("sha256", secret).update(bodyString).digest("hex");
    
    expect(signature).toBe(expected);
  });

  it("should dispatch webhook successfully", async () => {
    (axios.post as jest.Mock).mockResolvedValueOnce({ status: 200, data: { ok: true } });
    
    const result = await dispatchWebhook("https://example.com/webhook", secret, payload);
    
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(axios.post).toHaveBeenCalledWith(
      "https://example.com/webhook",
      JSON.stringify(payload),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-AgentRegi-Signature": expect.any(String)
        })
      })
    );
  });

  it("should handle webhook delivery failure", async () => {
    (axios.post as jest.Mock).mockRejectedValueOnce({
      response: { status: 500 },
      message: "Internal Server Error"
    });
    
    const result = await dispatchWebhook("https://example.com/webhook", secret, payload);
    
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.error).toBe("Internal Server Error");
  });
});
