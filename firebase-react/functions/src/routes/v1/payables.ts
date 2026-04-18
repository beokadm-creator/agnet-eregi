import type express from "express";
import type * as admin from "firebase-admin";

import { requireAuth, requireOps, partnerIdOf } from "../../lib/auth";
import { fail, ok } from "../../lib/http";

function payablesSummaryRef(adminApp: typeof admin, partnerId: string) {
  return adminApp.firestore().doc(`partners/${partnerId}/payables/summary`);
}

export function registerPayablesRoutes(app: express.Express, adminApp: typeof admin) {
  // Partner: 현재 이월/지급 관련 요약
  app.get("/v1/partner/payables/summary", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    const pid = partnerIdOf(auth);
    if (!pid) return fail(res, 403, "FORBIDDEN", "파트너 계정이 아닙니다.");

    const snap = await payablesSummaryRef(adminApp, pid).get();
    return ok(res, { exists: snap.exists, summary: snap.exists ? { id: snap.id, ...snap.data() } : null });
  });

  // Ops: 파트너 이월 요약 조회
  app.get("/v1/ops/partners/:partnerId/payables/summary", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    if (!requireOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자 권한이 없습니다.");

    const pid = req.params.partnerId;
    const snap = await payablesSummaryRef(adminApp, pid).get();
    return ok(res, { exists: snap.exists, summary: snap.exists ? { id: snap.id, ...snap.data() } : null });
  });
}

