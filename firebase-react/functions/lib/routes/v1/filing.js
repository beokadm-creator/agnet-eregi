"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFilingRoutes = registerFilingRoutes;
const node_crypto_1 = __importDefault(require("node:crypto"));
const auth_1 = require("../../lib/auth");
const http_1 = require("../../lib/http");
const firestore_1 = require("../../lib/firestore");
const idempotency_1 = require("../../lib/idempotency");
const timeline_1 = require("../../lib/timeline");
const filing_1 = require("../../lib/filing");
const workflow_auto_1 = require("../../lib/workflow_auto");
const tasks_1 = require("../../lib/tasks");
const workflow_1 = require("../../lib/workflow");
function registerFilingRoutes(app, adminApp) {
    // 접수 정보 조회(참여자)
    app.get("/v1/cases/:caseId/filing", async (req, res) => {
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
        const snap = await (0, filing_1.filingRef)(adminApp, caseId).get();
        return (0, http_1.ok)(res, { exists: snap.exists, filing: snap.exists ? { id: snap.id, ...snap.data() } : null });
    });
    // 접수 정보 저장(파트너/ops)
    app.post("/v1/cases/:caseId/filing", async (req, res) => {
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
        const { receiptNo, jurisdictionKo, submittedDate, memoKo } = req.body ?? {};
        if (!receiptNo || !jurisdictionKo || !submittedDate) {
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "receiptNo/jurisdictionKo/submittedDate가 필요합니다.");
        }
        if (!(0, filing_1.validateSubmittedDate)(String(submittedDate))) {
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "submittedDate는 YYYY-MM-DD 형식이어야 합니다.");
        }
        const result = await (0, idempotency_1.withIdempotency)(adminApp, req, res, "filing.upsert", async () => {
            const now = adminApp.firestore.FieldValue.serverTimestamp();
            await (0, filing_1.filingRef)(adminApp, caseId).set({
                caseId,
                partnerId: c.partnerId,
                receiptNo: String(receiptNo),
                jurisdictionKo: String(jurisdictionKo),
                submittedDate: String(submittedDate),
                memoKo: memoKo ? String(memoKo) : null,
                updatedAt: now,
                createdAt: now
            }, { merge: true });
            const eventId = node_crypto_1.default.randomUUID();
            await (0, timeline_1.writeTimelineEvent)(adminApp, caseId, eventId, {
                type: "FILING_INFO_UPSERTED",
                occurredAt: now,
                actor: (0, auth_1.isOps)(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
                summaryKo: "접수 정보가 저장되었습니다.",
                meta: { receiptNo: String(receiptNo), submittedDate: String(submittedDate), jurisdictionKo: String(jurisdictionKo), by: (0, auth_1.roleOf)(auth) }
            });
            return { ok: true };
        });
        if (!result)
            return;
        // 자동 완료 연결(조건 충족 시 completed로 전진)
        const auto = await (0, workflow_auto_1.tryAutoCompleteAfterFiling)(adminApp, {
            caseId,
            actor: (0, auth_1.isOps)(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid }
        });
        // filing_submitted 단계에서 "다음 단계 진행" 태스크 동기화 (자동 완료되지 않은 경우)
        if (!auto.advanced) {
            const wfSnap = await (0, workflow_1.workflowRef)(adminApp, caseId).get();
            const stage = String(wfSnap.exists ? wfSnap.data().stage : "");
            if (stage === "filing_submitted") {
                const packId = String(c.casePackId ?? "");
                const ns = (0, workflow_1.nextStage)(packId, "filing_submitted");
                if (ns) {
                    const prereq = await (0, workflow_1.validateStagePrerequisites)(adminApp, { caseId, casePackId: packId, stage: "filing_submitted" });
                    if (prereq.ok) {
                        await (0, tasks_1.ensureTask)(adminApp, {
                            caseId,
                            taskId: "advance_filing_submitted",
                            partnerId: String(c.partnerId),
                            titleKo: `다음 단계 진행: filing_submitted → ${ns}`,
                            type: "advance_stage"
                        });
                    }
                    else {
                        await (0, tasks_1.setTaskStatus)(adminApp, { caseId, taskId: "advance_filing_submitted", status: "done" });
                    }
                }
            }
        }
        return (0, http_1.ok)(res, result);
    });
}
//# sourceMappingURL=filing.js.map