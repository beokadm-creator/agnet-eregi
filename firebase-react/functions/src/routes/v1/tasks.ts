import type express from "express";
import type * as admin from "firebase-admin";

import crypto from "node:crypto";
import { requireAuth, partnerIdOf, isOps } from "../../lib/auth";
import { fail, ok } from "../../lib/http";
import { caseRef } from "../../lib/firestore";
import { withIdempotency } from "../../lib/idempotency";
import { writeTimelineEvent } from "../../lib/timeline";

export function registerTaskRoutes(app: express.Express, adminApp: typeof admin) {
  // 케이스 태스크 목록(참여자)
  app.get("/v1/cases/:caseId/tasks", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const cs = await caseRef(adminApp, caseId).get();
    if (!cs.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cs.data() as any;

    const canRead = isOps(auth) || c.ownerUid === auth.uid || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canRead) return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    const snap = await adminApp.firestore().collection(`cases/${caseId}/tasks`).orderBy("updatedAt", "desc").limit(100).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  // Partner: 업무 큐 (collectionGroup)
  app.get("/v1/partner/tasks", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const pid = partnerIdOf(auth);
    if (!pid) return fail(res, 403, "FORBIDDEN", "파트너 계정이 아닙니다.");

    const status = String(req.query.status || "open");
    let q = adminApp.firestore().collectionGroup("tasks").where("partnerId", "==", pid).where("status", "==", status);
    q = q.orderBy("updatedAt", "desc").limit(50);
    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  // Ops: 전체 업무 큐(옵션)
  app.get("/v1/ops/tasks", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자 권한이 없습니다.");

    const status = String(req.query.status || "open");
    let q = adminApp.firestore().collectionGroup("tasks").where("status", "==", status);
    q = q.orderBy("updatedAt", "desc").limit(100);
    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  // 태스크 완료(파트너/ops)
  app.post("/v1/cases/:caseId/tasks/:taskId/complete", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const taskId = req.params.taskId;

    const cs = await caseRef(adminApp, caseId).get();
    if (!cs.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cs.data() as any;
    const canWrite = isOps(auth) || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canWrite) return fail(res, 403, "FORBIDDEN", "권한이 없습니다.");

    const result = await withIdempotency(adminApp, req, res, "tasks.complete", async () => {
      const ref = adminApp.firestore().doc(`cases/${caseId}/tasks/${taskId}`);
      const snap = await ref.get();
      if (!snap.exists) throw new Error("NOT_FOUND_TASK");
      const now = adminApp.firestore.FieldValue.serverTimestamp();
      await ref.set({ status: "done", doneAt: now, updatedAt: now }, { merge: true });

      const eventId = crypto.randomUUID();
      await writeTimelineEvent(adminApp, caseId, eventId, {
        type: "TASK_COMPLETED",
        occurredAt: now,
        actor: isOps(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
        summaryKo: "업무가 완료되었습니다.",
        meta: { taskId }
      });

      return { taskId, status: "done" };
    }).catch((e: any) => {
      if (String(e?.message) === "NOT_FOUND_TASK") {
        fail(res, 404, "NOT_FOUND", "태스크를 찾을 수 없습니다.");
        return null;
      }
      fail(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
      return null;
    });

    if (!result) return;
    return ok(res, result);
  });
}
