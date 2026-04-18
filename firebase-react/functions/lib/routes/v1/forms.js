"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFormRoutes = registerFormRoutes;
const node_crypto_1 = __importDefault(require("node:crypto"));
const auth_1 = require("../../lib/auth");
const http_1 = require("../../lib/http");
const firestore_1 = require("../../lib/firestore");
const idempotency_1 = require("../../lib/idempotency");
const timeline_1 = require("../../lib/timeline");
const forms_1 = require("../../lib/forms");
function registerFormRoutes(app, adminApp) {
    // 임원변경 등기 입력 폼 조회(참여자)
    app.get("/v1/cases/:caseId/forms/officer-change", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const caseId = req.params.caseId;
        const cs = await (0, firestore_1.caseRef)(adminApp, caseId).get();
        if (!cs.exists)
            return (0, http_1.fail)(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
        const c = cs.data();
        const canRead = (0, auth_1.isOps)(auth) || c.ownerUid === auth.uid || ((0, auth_1.partnerIdOf)(auth) && c.partnerId === (0, auth_1.partnerIdOf)(auth));
        if (!canRead)
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
        const snap = await (0, forms_1.officerChangeFormRef)(adminApp, caseId).get();
        return (0, http_1.ok)(res, { exists: snap.exists, form: snap.exists ? { id: snap.id, ...snap.data() } : null });
    });
    // 임원변경 등기 입력 폼 저장(파트너/ops)
    app.post("/v1/cases/:caseId/forms/officer-change", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const caseId = req.params.caseId;
        const cs = await (0, firestore_1.caseRef)(adminApp, caseId).get();
        if (!cs.exists)
            return (0, http_1.fail)(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
        const c = cs.data();
        const canWrite = (0, auth_1.isOps)(auth) || ((0, auth_1.partnerIdOf)(auth) && c.partnerId === (0, auth_1.partnerIdOf)(auth));
        if (!canWrite)
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "권한이 없습니다.");
        const { companyName, meetingDate, resolutionKo, officers, principalName, agentName, scopeKo } = req.body ?? {};
        if (!companyName)
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "companyName가 필요합니다.");
        if (!meetingDate || !(0, forms_1.isYmd)(String(meetingDate)))
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "meetingDate는 YYYY-MM-DD 형식이어야 합니다.");
        // resolutionKo는 없으면 officers 기반으로 자동 생성
        const parsedOfficers = Array.isArray(officers) ? officers : [];
        if (parsedOfficers.length === 0)
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "officers(임원 변경 목록)가 필요합니다.");
        const normalizedOfficers = parsedOfficers.slice(0, 20).map((o) => ({
            nameKo: String(o?.nameKo ?? ""),
            roleKo: String(o?.roleKo ?? ""),
            changeType: String(o?.changeType ?? ""),
            effectiveDate: String(o?.effectiveDate ?? ""),
            birthDate: o?.birthDate ? String(o.birthDate) : undefined,
            addressKo: o?.addressKo ? String(o.addressKo) : undefined,
            isRepresentative: o?.isRepresentative === true
        }));
        for (const o of normalizedOfficers) {
            if (!o.nameKo)
                return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "officers.nameKo가 필요합니다.");
            if (!o.roleKo)
                return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "officers.roleKo가 필요합니다.");
            if (!["appoint", "resign", "reappoint"].includes(o.changeType)) {
                return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "officers.changeType(appoint|resign|reappoint)가 필요합니다.");
            }
            if (!o.effectiveDate || !(0, forms_1.isYmd)(o.effectiveDate)) {
                return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "officers.effectiveDate는 YYYY-MM-DD 형식이어야 합니다.");
            }
            if (o.birthDate && !(0, forms_1.isYmd)(o.birthDate)) {
                return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "officers.birthDate는 YYYY-MM-DD 형식이어야 합니다.");
            }
        }
        const normalizedResolutionKo = resolutionKo ? String(resolutionKo) : (0, forms_1.buildOfficerChangeResolutionKo)(normalizedOfficers);
        if (!principalName)
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "principalName가 필요합니다.");
        if (!agentName)
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "agentName가 필요합니다.");
        if (!scopeKo)
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "scopeKo가 필요합니다.");
        const result = await (0, idempotency_1.withIdempotency)(adminApp, req, res, "forms.officer_change.upsert", async () => {
            const now = adminApp.firestore.FieldValue.serverTimestamp();
            await (0, forms_1.officerChangeFormRef)(adminApp, caseId).set({
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
            }, { merge: true });
            const eventId = node_crypto_1.default.randomUUID();
            await (0, timeline_1.writeTimelineEvent)(adminApp, caseId, eventId, {
                type: "FORM_UPDATED",
                occurredAt: now,
                actor: (0, auth_1.isOps)(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
                summaryKo: "서류 입력 정보가 저장되었습니다.",
                meta: { form: "officer_change" }
            });
            return { ok: true };
        });
        if (!result)
            return;
        return (0, http_1.ok)(res, result);
    });
}
//# sourceMappingURL=forms.js.map