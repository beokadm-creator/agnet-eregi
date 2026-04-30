import * as express from "express";
import * as admin from "firebase-admin";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";
import { getOpsSettingsCollection, TelegramSettings, TossPaymentsSettings, LlmSettings } from "../../lib/ops_settings";
import { llmTestCall } from "../../lib/llm_engine";

export function registerOpsSettingsRoutes(app: express.Application, adminApp: typeof admin) {
  const secretClient = new SecretManagerServiceClient();
  const DEFAULT_LLM = { enabled: false, provider: "glm", model: "glm-5.1", endpoint: "https://api.z.ai/api/coding/paas/v4", apiKeySecretName: "" };
  const SECRET_ID = "ops_llm_glm_api_key";

  function projectId(): string {
    return process.env.GOOGLE_CLOUD_PROJECT || "agent-eregi";
  }

  async function ensureSecretExists(): Promise<string> {
    const pid = projectId();
    const secretName = `projects/${pid}/secrets/${SECRET_ID}`;
    try {
      await secretClient.createSecret({
        parent: `projects/${pid}`,
        secretId: SECRET_ID,
        secret: { replication: { automatic: {} } },
      });
    } catch (_e: any) {
    }
    return secretName;
  }

  // GET /v1/ops/settings/telegram
  app.get("/v1/ops/settings/telegram", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const docSnap = await getOpsSettingsCollection().doc("telegram").get();
      const data = docSnap.exists ? docSnap.data() : { enabled: false, botToken: "", chatId: "", webhookToken: "" };

      return ok(res, { settings: data });
    } catch (err: any) {
      logError({ endpoint: "ops/settings/telegram/get", code: "INTERNAL", messageKo: "텔레그램 설정 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // PUT /v1/ops/settings/telegram
  app.put("/v1/ops/settings/telegram", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const { enabled, botToken, chatId, webhookToken } = req.body;

      if (enabled && (!botToken || !chatId || !webhookToken)) {
         return fail(res, 400, "INVALID_ARGUMENT", "활성화 시 botToken, chatId, webhookToken은 필수입니다.");
      }

      const newSettings: Partial<TelegramSettings> = {
        enabled: !!enabled,
        botToken: botToken || "",
        chatId: chatId || "",
        webhookToken: webhookToken || "",
        updatedAt: adminApp.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updatedBy: auth.uid
      };

      await getOpsSettingsCollection().doc("telegram").set(newSettings, { merge: true });

      await logOpsEvent(adminApp, {
        gateKey: "system",
        action: "ops_settings.update",
        status: "success",
        actorUid: auth.uid,
        requestId: (req as any).requestId,
        summary: `텔레그램 알림 설정 변경 (enabled: ${newSettings.enabled})`,
        target: { type: "telegram", enabled: newSettings.enabled }
      });

      return ok(res, { settings: newSettings });
    } catch (err: any) {
      logError({ endpoint: "ops/settings/telegram/put", code: "INTERNAL", messageKo: "텔레그램 설정 변경 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // GET /v1/ops/settings/llm
  app.get("/v1/ops/settings/llm", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const docSnap = await getOpsSettingsCollection().doc("llm").get();
      const raw = docSnap.exists ? (docSnap.data() as any) : DEFAULT_LLM;
      const apiKeySecretName = String(raw.apiKeySecretName || "").trim();
      const settings = {
        enabled: !!raw.enabled,
        provider: "glm",
        model: raw.model || DEFAULT_LLM.model,
        endpoint: raw.endpoint || DEFAULT_LLM.endpoint,
        apiKeySecretName,
        apiKeySet: !!apiKeySecretName,
        updatedAt: raw.updatedAt,
        updatedBy: raw.updatedBy,
      };

      return ok(res, { settings });
    } catch (err: any) {
      logError({ endpoint: "ops/settings/llm/get", code: "INTERNAL", messageKo: "LLM 설정 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // PUT /v1/ops/settings/llm
  app.put("/v1/ops/settings/llm", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const { enabled, provider, model, endpoint, apiKey } = req.body || {};
      if (provider && provider !== "glm") {
        return fail(res, 400, "INVALID_ARGUMENT", "현재는 glm provider만 지원합니다.");
      }

      const llmRef = getOpsSettingsCollection().doc("llm");
      const beforeSnap = await llmRef.get();
      const before = beforeSnap.exists ? (beforeSnap.data() as any) : {};
      const beforeSecretName = String(before.apiKeySecretName || "").trim();

      let apiKeySecretName = beforeSecretName;
      const incomingKey = String(apiKey || "").trim();
      if (incomingKey) {
        if (process.env.FUNCTIONS_EMULATOR === "true") {
          apiKeySecretName = "emulator";
          await llmRef.set({ apiKey: incomingKey }, { merge: true });
        } else {
          apiKeySecretName = await ensureSecretExists();
          await secretClient.addSecretVersion({
            parent: apiKeySecretName,
            payload: { data: Buffer.from(incomingKey, "utf8") },
          });
        }
      }

      if (!!enabled && (!model || !endpoint)) {
        return fail(res, 400, "INVALID_ARGUMENT", "활성화 시 model, endpoint는 필수입니다.");
      }
      if (!!enabled && !apiKeySecretName) {
        return fail(res, 400, "INVALID_ARGUMENT", "활성화 시 API Key를 입력하거나 기존 API Key가 등록되어 있어야 합니다.");
      }

      const update: Partial<LlmSettings> & Record<string, any> = {
        enabled: !!enabled,
        provider: "glm",
        model: model || DEFAULT_LLM.model,
        endpoint: endpoint || DEFAULT_LLM.endpoint,
        apiKeySecretName: apiKeySecretName || "",
        updatedAt: adminApp.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updatedBy: auth.uid
      };

      if (process.env.FUNCTIONS_EMULATOR !== "true") {
        update.apiKey = adminApp.firestore.FieldValue.delete();
      }

      await llmRef.set(update, { merge: true });

      await logOpsEvent(adminApp, {
        gateKey: "system",
        action: "ops_settings.update",
        status: "success",
        actorUid: auth.uid,
        requestId: (req as any).requestId,
        summary: `LLM 설정 변경 (enabled: ${update.enabled}, provider: ${update.provider}, model: ${update.model})`,
        target: { type: "llm", enabled: update.enabled, provider: update.provider, model: update.model }
      });

      const responseSettings = {
        enabled: update.enabled,
        provider: "glm",
        model: update.model,
        endpoint: update.endpoint,
        apiKeySecretName: update.apiKeySecretName,
        apiKeySet: !!update.apiKeySecretName,
        updatedAt: update.updatedAt,
        updatedBy: update.updatedBy,
      };

      return ok(res, { settings: responseSettings });
    } catch (err: any) {
      logError({ endpoint: "ops/settings/llm/put", code: "INTERNAL", messageKo: "LLM 설정 변경 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });


  // POST /v1/ops/settings/llm/test
  app.post("/v1/ops/settings/llm/test", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const incoming = req.body?.settings || req.body || {};
      const provider = incoming.provider || "glm";
      const model = incoming.model || DEFAULT_LLM.model;
      const endpoint = incoming.endpoint || DEFAULT_LLM.endpoint;
      let apiKey = String(incoming.apiKey || "").trim();
      const prompt = String(incoming.prompt || "Hello. Reply with a short sentence to confirm the API works.");

      if (!endpoint || !model) {
        return fail(res, 400, "INVALID_ARGUMENT", "endpoint, model은 필수입니다.");
      }

      if (!apiKey) {
        const llmSnap = await getOpsSettingsCollection().doc("llm").get();
        const llm = llmSnap.exists ? (llmSnap.data() as any) : {};
        const secretName = String(llm.apiKeySecretName || "").trim();
        if (secretName && secretName !== "emulator") {
          const [version] = await secretClient.accessSecretVersion({ name: `${secretName}/versions/latest` });
          apiKey = version.payload?.data?.toString("utf8") || "";
        } else if (process.env.FUNCTIONS_EMULATOR === "true" && llm.apiKey) {
          apiKey = String(llm.apiKey || "").trim();
        }
      }

      if (!apiKey) {
        return fail(res, 400, "FAILED_PRECONDITION", "API Key가 등록되어 있지 않습니다.");
      }

      const startedAt = Date.now();
      const result = await llmTestCall(adminApp, { provider, model, endpoint, apiKey }, prompt);
      const latencyMs = Date.now() - startedAt;
      const preview = String(result.text || "").slice(0, 400);

      return ok(res, { ok: true, provider: result.provider, model: result.model, latencyMs, preview, usage: result.usage });
    } catch (err: any) {
      logError({ endpoint: "ops/settings/llm/test", code: "INTERNAL", messageKo: "LLM 테스트 호출 실패", err });
      return fail(res, 500, "INTERNAL", "LLM 테스트 호출에 실패했습니다.");
    }
  });

  // GET /v1/ops/settings/tosspayments
  app.get("/v1/ops/settings/tosspayments", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const docSnap = await getOpsSettingsCollection().doc("tosspayments").get();
      const data = docSnap.exists ? docSnap.data() : { enabled: false, clientKey: "", secretKey: "" };

      return ok(res, { settings: data });
    } catch (err: any) {
      logError({ endpoint: "ops/settings/tosspayments/get", code: "INTERNAL", messageKo: "토스페이먼츠 설정 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // PUT /v1/ops/settings/tosspayments
  app.put("/v1/ops/settings/tosspayments", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      const { enabled, clientKey, secretKey } = req.body;

      if (enabled && (!clientKey || !secretKey)) {
         return fail(res, 400, "INVALID_ARGUMENT", "활성화 시 clientKey, secretKey는 필수입니다.");
      }

      const newSettings: Partial<TossPaymentsSettings> = {
        enabled: !!enabled,
        clientKey: clientKey || "",
        secretKey: secretKey || "",
        updatedAt: adminApp.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updatedBy: auth.uid
      };

      await getOpsSettingsCollection().doc("tosspayments").set(newSettings, { merge: true });

      await logOpsEvent(adminApp, {
        gateKey: "system",
        action: "ops_settings.update",
        status: "success",
        actorUid: auth.uid,
        requestId: (req as any).requestId,
        summary: `토스페이먼츠 설정 변경 (enabled: ${newSettings.enabled})`,
        target: { type: "tosspayments", enabled: newSettings.enabled }
      });

      return ok(res, { settings: newSettings });
    } catch (err: any) {
      logError({ endpoint: "ops/settings/tosspayments/put", code: "INTERNAL", messageKo: "토스페이먼츠 설정 변경 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

}
