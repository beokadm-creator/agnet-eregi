import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";
import { getOpsSettingsCollection, TelegramSettings, TossPaymentsSettings } from "../../lib/ops_settings";

export function registerOpsSettingsRoutes(app: express.Application, adminApp: typeof admin) {

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
