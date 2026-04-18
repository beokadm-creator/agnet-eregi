import type express from "express";
import type * as admin from "firebase-admin";
import crypto from "node:crypto";

import { requireAuth, isOps, partnerIdOf } from "../../lib/auth";
import { fail, ok } from "../../lib/http";
import { caseRef } from "../../lib/firestore";
import { withIdempotency } from "../../lib/idempotency";
import { writeTimelineEvent } from "../../lib/timeline";
import { buildOfficerChangeResolutionKo, isYmd, officerChangeFormRef } from "../../lib/forms";

export function registerFormRoutes(app: express.Express, adminApp: typeof admin) {
  // 임원변경 등기 입력 폼 조회(참여자)
  app.get("/v1/cases/:caseId/forms/officer-change", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const cs = await caseRef(adminApp, caseId).get();
    if (!cs.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cs.data() as any;
    const canRead = isOps(auth) || c.ownerUid === auth.uid || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canRead) return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    const snap = await officerChangeFormRef(adminApp, caseId).get();
    return ok(res, { exists: snap.exists, form: snap.exists ? { id: snap.id, ...snap.data() } : null });
  });

  // 임원변경 등기 입력 폼 저장(파트너/ops)
  app.post("/v1/cases/:caseId/forms/officer-change", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const cs = await caseRef(adminApp, caseId).get();
    if (!cs.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cs.data() as any;
    const canWrite = isOps(auth) || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canWrite) return fail(res, 403, "FORBIDDEN", "권한이 없습니다.");

    const {
      companyName,
      meetingDate,
      resolutionKo,
      officers,
      principalName,
      agentName,
      scopeKo
    } = req.body ?? {};

    if (!companyName) return fail(res, 400, "INVALID_ARGUMENT", "companyName가 필요합니다.");
    if (!meetingDate || !isYmd(String(meetingDate))) return fail(res, 400, "INVALID_ARGUMENT", "meetingDate는 YYYY-MM-DD 형식이어야 합니다.");
    // resolutionKo는 없으면 officers 기반으로 자동 생성
    const parsedOfficers = Array.isArray(officers) ? officers : [];
    if (parsedOfficers.length === 0) return fail(res, 400, "INVALID_ARGUMENT", "officers(임원 변경 목록)가 필요합니다.");
    const normalizedOfficers = parsedOfficers.slice(0, 20).map((o: any) => ({
      nameKo: String(o?.nameKo ?? ""),
      roleKo: String(o?.roleKo ?? ""),
      changeType: String(o?.changeType ?? "") as any,
      effectiveDate: String(o?.effectiveDate ?? ""),
      birthDate: o?.birthDate ? String(o.birthDate) : undefined,
      addressKo: o?.addressKo ? String(o.addressKo) : undefined,
      isRepresentative: o?.isRepresentative === true
    }));
    for (const o of normalizedOfficers) {
      if (!o.nameKo) return fail(res, 400, "INVALID_ARGUMENT", "officers.nameKo가 필요합니다.");
      if (!o.roleKo) return fail(res, 400, "INVALID_ARGUMENT", "officers.roleKo가 필요합니다.");
      if (!["appoint", "resign", "reappoint"].includes(o.changeType)) {
        return fail(res, 400, "INVALID_ARGUMENT", "officers.changeType(appoint|resign|reappoint)가 필요합니다.");
      }
      if (!o.effectiveDate || !isYmd(o.effectiveDate)) {
        return fail(res, 400, "INVALID_ARGUMENT", "officers.effectiveDate는 YYYY-MM-DD 형식이어야 합니다.");
      }
      if (o.birthDate && !isYmd(o.birthDate)) {
        return fail(res, 400, "INVALID_ARGUMENT", "officers.birthDate는 YYYY-MM-DD 형식이어야 합니다.");
      }
    }
    const normalizedResolutionKo = resolutionKo ? String(resolutionKo) : buildOfficerChangeResolutionKo(normalizedOfficers);
    if (!principalName) return fail(res, 400, "INVALID_ARGUMENT", "principalName가 필요합니다.");
    if (!agentName) return fail(res, 400, "INVALID_ARGUMENT", "agentName가 필요합니다.");
    if (!scopeKo) return fail(res, 400, "INVALID_ARGUMENT", "scopeKo가 필요합니다.");

    const result = await withIdempotency(adminApp, req, res, "forms.officer_change.upsert", async () => {
      const now = adminApp.firestore.FieldValue.serverTimestamp();
      await officerChangeFormRef(adminApp, caseId).set(
        {
          caseId,
          companyName: String(companyName),
          meetingDate: String(meetingDate),
          resolutionKo: normalizedResolutionKo,
          officers: normalizedOfficers,
          principalName: String(principalName),
          agentName: String(agentName),
          scopeKo: String(scopeKo),
          updatedAt: now,
          createdAt: now
        },
        { merge: true }
      );

      const eventId = crypto.randomUUID();
      await writeTimelineEvent(adminApp, caseId, eventId, {
        type: "FORM_UPDATED",
        occurredAt: now,
        actor: isOps(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
        summaryKo: "서류 입력 정보가 저장되었습니다.",
        meta: { form: "officer_change" }
      });

      return { ok: true };
    });

    if (!result) return;
    return ok(res, result);
  });
}
