import axios from "axios";
import * as crypto from "crypto";

export interface WebhookPayload {
  eventId: string;
  eventType: string;
  resourceId: string;
  data: any;
  createdAt: string;
}

export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  response?: any;
}

/**
 * Computes the HMAC SHA256 signature for the given payload using the secret.
 * @param payload The JSON stringified payload.
 * @param secret The partner's webhook secret.
 * @returns The hex string of the HMAC signature.
 */
export function computeSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Dispatches a webhook to the specified URL.
 * It computes an HMAC signature and includes it in the `X-AgentRegi-Signature` header.
 * 
 * @param url The webhook endpoint URL.
 * @param secret The webhook secret for computing the signature.
 * @param payload The webhook payload.
 * @returns The result of the webhook delivery.
 */
export async function dispatchWebhook(url: string, secret: string, payload: WebhookPayload): Promise<WebhookResult> {
  const bodyString = JSON.stringify(payload);
  const signature = computeSignature(bodyString, secret);

  try {
    const response = await axios.post(url, bodyString, {
      headers: {
        "Content-Type": "application/json",
        "X-AgentRegi-Signature": signature,
      },
      timeout: 5000, // 5 seconds timeout
    });

    return {
      success: response.status >= 200 && response.status < 300,
      statusCode: response.status,
      response: response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      statusCode: error.response?.status,
      error: error.message,
    };
  }
}
