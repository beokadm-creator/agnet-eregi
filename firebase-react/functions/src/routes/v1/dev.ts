import type express from "express";
import type * as admin from "firebase-admin";

import { requireAuth, roleOf } from "../../lib/auth";
import { fail, ok } from "../../lib/http";

function isDevAllowed() {
  // 보안: dev endpoint는 **에뮬레이터에서만** 허용
  // (실수로 운영 배포되는 사고를 원천 차단)
  return process.env.FUNCTIONS_EMULATOR === "true";
}

export function registerDevRoutes(app: express.Express, adminApp: typeof admin) {
  app.post("/v1/dev/set-claims", async (req, res) => {
    if (!isDevAllowed()) return fail(res, 403, "FORBIDDEN", "dev endpoint는 비활성화 상태입니다.");

    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const { uid, claims } = req.body ?? {};
    const targetUid = String(uid || auth.uid);
    if (!claims || typeof claims !== "object") return fail(res, 400, "INVALID_ARGUMENT", "claims가 필요합니다.");

    await adminApp.auth().setCustomUserClaims(targetUid, claims);
    return ok(res, { uid: targetUid, claims, callerRole: roleOf(auth) ?? null });
  });

  app.get("/v1/dev/whoami", async (req, res) => {
    if (!isDevAllowed()) return fail(res, 403, "FORBIDDEN", "dev endpoint는 비활성화 상태입니다.");
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    return ok(res, { uid: auth.uid, role: (auth as any).role ?? null, partnerId: (auth as any).partnerId ?? null });
  });
}
