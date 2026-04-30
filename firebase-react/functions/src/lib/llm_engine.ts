import * as admin from "firebase-admin";
import { VertexAI } from "@google-cloud/vertexai";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

import { getOpsSettingsCollection } from "./ops_settings";
import { glmChatCompletion, GlmChatMessage } from "./llm_glm";

export interface LlmChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  expectJson?: boolean;
}

export interface LlmChatCompletionResult {
  provider: "glm" | "vertex_ai";
  model: string;
  text: string;
  usage?: { totalTokens?: number };
}

const DEFAULT_GLM_ENDPOINT = "https://api.z.ai/api/coding/paas/v4";
const DEFAULT_GLM_MODEL = "glm-5.1";

const DEFAULT_VERTEX_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "agent-eregi";
const DEFAULT_VERTEX_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "asia-northeast3";
const DEFAULT_VERTEX_MODEL = "gemini-1.5-flash-preview-0514";

const secretClient = new SecretManagerServiceClient();

type LlmRuntimeSettings = {
  enabled: boolean;
  provider: "glm";
  model: string;
  endpoint: string;
  apiKey: string;
  apiKeySecretName: string;
};

let cachedSettings: { loadedAtMs: number; settings: LlmRuntimeSettings | null } | null = null;

async function accessSecretText(name: string): Promise<string> {
  const [version] = await secretClient.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString("utf8") || "";
  return payload;
}

async function loadLlmSettings(adminApp: typeof admin, force: boolean = false): Promise<LlmRuntimeSettings | null> {
  const now = Date.now();
  if (!force && cachedSettings && now - cachedSettings.loadedAtMs < 10_000) return cachedSettings.settings;

  const snap = await getOpsSettingsCollection().doc("llm").get();
  const data = snap.exists ? (snap.data() as any) : null;

  let apiKeySecretName = String(data?.apiKeySecretName || "").trim();
  const legacyApiKey = String(data?.apiKey || "").trim();
  if (!apiKeySecretName && legacyApiKey) {
    apiKeySecretName = "";
  }

  let apiKey = "";
  if (apiKeySecretName && apiKeySecretName !== "emulator") {
    apiKey = await accessSecretText(`${apiKeySecretName}/versions/latest`);
  } else if (process.env.FUNCTIONS_EMULATOR === "true" && legacyApiKey) {
    apiKey = legacyApiKey;
  }

  const normalized: LlmRuntimeSettings | null = data
    ? {
        enabled: !!data.enabled,
        provider: "glm",
        model: data.model || DEFAULT_GLM_MODEL,
        endpoint: data.endpoint || DEFAULT_GLM_ENDPOINT,
        apiKeySecretName,
        apiKey,
      }
    : null;

  cachedSettings = { loadedAtMs: now, settings: normalized };
  return normalized;
}

function normalizeMessages(messages: LlmChatMessage[]): LlmChatMessage[] {
  return (messages || [])
    .map((m) => ({ role: m.role, content: String(m.content ?? "") }))
    .filter((m) => m.content.trim().length > 0);
}

function stripJsonFences(text: string): string {
  const t = String(text || "").trim();
  if (t.startsWith("```")) {
    return t.replace(/^```[a-zA-Z]*\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return t;
}

let vertexInstance: VertexAI | null = null;

async function vertexChatCompletion(
  settings: { model?: string; projectId?: string; location?: string },
  messages: LlmChatMessage[],
  opts: LlmChatCompletionOptions
): Promise<{ text: string; tokensUsed?: number }> {
  const projectId = settings.projectId || DEFAULT_VERTEX_PROJECT_ID;
  const location = settings.location || DEFAULT_VERTEX_LOCATION;
  const modelName = settings.model || DEFAULT_VERTEX_MODEL;

  if (!vertexInstance) {
    vertexInstance = new VertexAI({ project: projectId, location });
  }

  const genModel = vertexInstance.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: opts.temperature ?? 0.3,
      maxOutputTokens: opts.maxTokens ?? 2048,
      ...(opts.expectJson ? { responseMimeType: "application/json" } : {}),
    },
  });

  const normalized = normalizeMessages(messages);
  const history = normalized.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const last = normalized[normalized.length - 1];
  const userText = last?.content || "";

  const chat = genModel.startChat({ history });
  const responseStream = await chat.sendMessage([{ text: userText }]);
  const response = await responseStream.response;
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
  return { text, tokensUsed };
}

export async function llmChatComplete(
  adminApp: typeof admin,
  messages: LlmChatMessage[],
  opts: LlmChatCompletionOptions = {}
): Promise<LlmChatCompletionResult> {
  const settings = await loadLlmSettings(adminApp);
  const normalized = normalizeMessages(messages);

  if (settings?.enabled && settings.provider === "glm" && settings.endpoint && !settings.apiKey) {
    throw new Error("LLM API key is missing.");
  }

  if (settings?.enabled && settings.provider === "glm" && settings.endpoint && settings.apiKey) {
    const glmMessages: GlmChatMessage[] = normalized.map((m) => ({ role: m.role, content: m.content }));
    const out = await glmChatCompletion({
      endpoint: settings.endpoint,
      apiKey: settings.apiKey,
      model: settings.model || DEFAULT_GLM_MODEL,
      messages: glmMessages,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      timeoutMs: opts.timeoutMs,
    });
    const text = opts.expectJson ? stripJsonFences(out.text) : out.text;
    return {
      provider: "glm",
      model: settings.model || DEFAULT_GLM_MODEL,
      text,
      usage: out.usage?.totalTokens ? { totalTokens: out.usage.totalTokens } : undefined,
    };
  }

  const vertexOut = await vertexChatCompletion(
    { model: DEFAULT_VERTEX_MODEL, projectId: DEFAULT_VERTEX_PROJECT_ID, location: DEFAULT_VERTEX_LOCATION },
    normalized,
    opts
  );
  const text = opts.expectJson ? stripJsonFences(vertexOut.text) : vertexOut.text;
  return {
    provider: "vertex_ai",
    model: DEFAULT_VERTEX_MODEL,
    text,
    usage: vertexOut.tokensUsed ? { totalTokens: vertexOut.tokensUsed } : undefined,
  };
}

export async function llmTestCall(
  adminApp: typeof admin,
  input: { provider?: "glm"; endpoint?: string; apiKey?: string; model?: string },
  prompt: string
): Promise<{ provider: string; model: string; text: string; usage?: any }> {
  const provider = input.provider || "glm";
  if (provider !== "glm") throw new Error("Only glm provider is supported.");

  const out = await glmChatCompletion({
    endpoint: input.endpoint || DEFAULT_GLM_ENDPOINT,
    apiKey: input.apiKey || "",
    model: input.model || DEFAULT_GLM_MODEL,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 256,
    temperature: 0.2,
    timeoutMs: 20_000,
  });

  return { provider: "glm", model: input.model || DEFAULT_GLM_MODEL, text: out.text, usage: out.usage };
}
