import type express from "express";
import type * as admin from "firebase-admin";

import { requireAuth, partnerIdOf } from "../../lib/auth";
import { fail, ok } from "../../lib/http";

export function registerPartnerRoutes(app: express.Express, adminApp: typeof admin) {
  // Partner: 케이스 큐(리스트)
  app.get("/v1/partner/cases", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const pid = partnerIdOf(auth);
    if (!pid) return fail(res, 403, "FORBIDDEN", "파트너 계정이 아닙니다.");

    const statusesRaw = req.query.statuses ? String(req.query.statuses) : "new,in_progress,waiting_partner,waiting_user";
    const statuses = statusesRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);

    let q = adminApp.firestore().collection("cases").where("partnerId", "==", pid);
    // Firestore in query는 최대 10개
    q = q.where("status", "in", statuses);
    q = q.orderBy("updatedAt", "desc").limit(50);

    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  // Partner: 문서 검토 큐(컬렉션 그룹)
  app.get("/v1/partner/documents", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const pid = partnerIdOf(auth);
    if (!pid) return fail(res, 403, "FORBIDDEN", "파트너 계정이 아닙니다.");

    const statusesRaw = req.query.statuses ? String(req.query.statuses) : "uploaded";
    const statuses = statusesRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);

    let q = adminApp.firestore().collectionGroup("documents").where("partnerId", "==", pid);
    q = q.where("status", "in", statuses);
    q = q.orderBy("updatedAt", "desc").limit(50);

    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });
}
