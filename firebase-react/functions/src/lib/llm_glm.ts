import axios from "axios";

export interface GlmChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GlmChatCompletionRequest {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: GlmChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface GlmChatCompletionResult {
  text: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  raw: any;
}

function buildChatCompletionsUrl(endpoint: string): string {
  const base = String(endpoint || "").trim().replace(/\/+$/, "");
  return `${base}/chat/completions`;
}

export async function glmChatCompletion(req: GlmChatCompletionRequest): Promise<GlmChatCompletionResult> {
  const url = buildChatCompletionsUrl(req.endpoint);
  const timeout = req.timeoutMs ?? 60_000;

  const res = await axios.post(
    url,
    {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.4,
      max_tokens: req.maxTokens ?? 1024,
      stream: false,
    },
    {
      timeout,
      headers: {
        Authorization: `Bearer ${req.apiKey}`,
        "Content-Type": "application/json",
        "Accept-Language": "en-US,en",
      },
      validateStatus: () => true,
    }
  );

  if (res.status < 200 || res.status >= 300) {
    const msg = typeof res.data === "string" ? res.data : JSON.stringify(res.data || {});
    throw new Error(`GLM API request failed: ${res.status} ${msg.slice(0, 400)}`);
  }

  const text = res.data?.choices?.[0]?.message?.content ?? "";
  const usage = res.data?.usage
    ? {
        promptTokens: res.data.usage.prompt_tokens,
        completionTokens: res.data.usage.completion_tokens,
        totalTokens: res.data.usage.total_tokens,
      }
    : undefined;

  return { text, usage, raw: res.data };
}

