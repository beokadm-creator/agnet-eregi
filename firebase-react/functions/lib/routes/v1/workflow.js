"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWorkflowRoutes = registerWorkflowRoutes;
const node_crypto_1 = __importDefault(require("node:crypto"));
const auth_1 = require("../../lib/auth");
const http_1 = require("../../lib/http");
const firestore_1 = require("../../lib/firestore");
const timeline_1 = require("../../lib/timeline");
const idempotency_1 = require("../../lib/idempotency");
const casepack_1 = require("../../lib/casepack");
const workflow_1 = require("../../lib/workflow");
const tasks_1 = require("../../lib/tasks");
const case_status_1 = require("../../lib/case_status");
function registerWorkflowRoutes(app, adminApp) {
    async function computeAdvanceInfo(params) {
        const ns = (0, workflow_1.nextStage)(params.casePackId, params.stage);
        if (!ns)
            return { nextStage: null, canAdvance: false, reasonKo: "다음 단계가 없습니다." };
        const prereq = await (0, workflow_1.validateStagePrerequisites)(adminApp, { caseId: params.caseId, casePackId: params.casePackId, stage: params.stage });
        return prereq.ok
            ? { nextStage: ns, canAdvance: true, reasonKo: null }
            : { nextStage: ns, canAdvance: false, reasonKo: prereq.reasonKo };
    }
    async function syncAdvanceTask(params) {
        const info = await computeAdvanceInfo(params);
        const taskId = `advance_${params.stage}`;
        if (info.canAdvance && info.nextStage) {
            await (0, tasks_1.ensureTask)(adminApp, {
                caseId: params.caseId,
                taskId,
                partnerId: params.partnerId,
                titleKo: `다음 단계 진행: ${params.stage} → ${info.nextStage}`,
                type: "advance_stage"
            });
        }
        else {
            await (0, tasks_1.setTaskStatus)(adminApp, { caseId: params.caseId, taskId, status: "done" });
        }
        return info;
    }
    // 케이스 워크플로우 조회(참여자)
    app.get("/v1/cases/:caseId/workflow", async (req, res) => {
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
        const wfSnap = await (0, workflow_1.workflowRef)(adminApp, caseId).get();
        const wf = wfSnap.exists ? { id: wfSnap.id, ...wfSnap.data() } : null;
        const cfg = (0, casepack_1.getCasePackConfig)(String(c.casePackId));
        const stageRaw = String(wf?.stage || "intake");
        const stage = (0, workflow_1.isCaseStage)(stageRaw) ? stageRaw : "intake";
        const adv = cfg ? await computeAdvanceInfo({ caseId, casePackId: String(c.casePackId), stage }) : { nextStage: null, canAdvance: false, reasonKo: "casePack 없음" };
        const requiredSlots = cfg ? await (0, workflow_1.requiredSlotsForStage)(adminApp, { caseId, casePackId: String(c.casePackId), stage }) : [];
        return (0, http_1.ok)(res, { case: { id: cs.id, ...c }, workflow: wf, casePack: cfg, advance: adv, requiredSlots });
    });
    // 사용자 보완 가이드(필수 서류 누락/needs_fix 기반)
    app.get("/v1/cases/:caseId/fix-guide", async (req, res) => {
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
        const wfSnap = await (0, workflow_1.workflowRef)(adminApp, caseId).get();
        const wf = wfSnap.exists ? wfSnap.data() : { stage: "intake" };
        const stageRaw = String(wf.stage || "intake");
        const stage = (0, workflow_1.isCaseStage)(stageRaw) ? stageRaw : "intake";
        const cfg = (0, casepack_1.getCasePackConfig)(String(c.casePackId));
        if (!cfg)
            return (0, http_1.ok)(res, { stage, requiredSlots: [], items: [] });
        const requiredSlots = await (0, workflow_1.requiredSlotsForStage)(adminApp, { caseId, casePackId: String(c.casePackId), stage });
        const docsSnap = await adminApp.firestore().collection(`cases/${caseId}/documents`).get();
        const docs = docsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // slotId별 최신 문서 매핑
        const bySlot = new Map();
        for (const d of docs) {
            const slotId = String(d.slotId);
            const prev = bySlot.get(slotId);
            const du = Number(new Date(d.updatedAt?.toDate?.() ?? d.updatedAt ?? 0));
            const pu = prev ? Number(new Date(prev.updatedAt?.toDate?.() ?? prev.updatedAt ?? 0)) : -1;
            if (!prev || du > pu)
                bySlot.set(slotId, d);
        }
        const items = requiredSlots.map((slotId) => {
            const titleKo = cfg.slotTitlesKo?.[slotId] ?? String(slotId);
            const d = bySlot.get(slotId);
            if (!d) {
                return { slotId, titleKo, status: "missing", guidanceKo: "필수 서류가 아직 제출되지 않았습니다." };
            }
            if (d.status === "ok")
                return { slotId, titleKo, status: "ok", guidanceKo: "제출 완료" };
            const issues = d.review?.issues ?? [];
            const issueSummariesKo = d.review?.issueSummariesKo ?? [];
            const guidanceKo = issues.length > 0
                ? issues.map((i) => `- ${i.titleKo}: ${i.guidanceKo}`).join("\n")
                : issueSummariesKo.length > 0
                    ? issueSummariesKo.map((s) => `- ${s}`).join("\n")
                    : "문서 검토가 필요하거나 보완이 필요합니다.";
            return { slotId, titleKo, status: String(d.status), documentId: d.documentId ?? d.id, guidanceKo, issueCodes: d.review?.issueCodes ?? [] };
        });
        return (0, http_1.ok)(res, { stage, requiredSlots, items });
    });
    // 워크플로우 전진(법무사/ops)
    app.post("/v1/cases/:caseId/workflow/advance", async (req, res) => {
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
        const result = await (0, idempotency_1.withIdempotency)(adminApp, req, res, "workflow.advance", async () => {
            const now = adminApp.firestore.FieldValue.serverTimestamp();
            const wfR = (0, workflow_1.workflowRef)(adminApp, caseId);
            const wfSnap = await wfR.get();
            const currentStage = (wfSnap.exists ? wfSnap.data().stage : "intake");
            const packId = String(c.casePackId);
            // 다음 스테이지 계산
            const desired = (req.body?.toStage ? String(req.body.toStage) : null);
            const computedNext = (0, workflow_1.nextStage)(packId, currentStage);
            const toStage = desired ?? computedNext;
            if (!toStage)
                throw new Error("INVALID_ARGUMENT:다음 단계가 없습니다.");
            // 기본 정책: 다음 단계로만 전진(ops만 점프 허용)
            if (!(0, auth_1.isOps)(auth) && desired && desired !== computedNext) {
                throw new Error("INVALID_ARGUMENT:단계를 건너뛸 수 없습니다.");
            }
            // 선행조건 검증(“법무사가 수행할 수 있을 정도로” 핵심)
            const prereq = await (0, workflow_1.validateStagePrerequisites)(adminApp, { caseId, casePackId: packId, stage: currentStage });
            if (!prereq.ok)
                throw new Error(`INVALID_ARGUMENT:${prereq.reasonKo}`);
            // 워크플로우 업데이트 + 케이스 상태 연결(연결)
            const checklist = (0, workflow_1.initChecklist)(packId, toStage);
            const fromCaseStatus = String(c.status || "new");
            const desiredCaseStatus = (0, workflow_1.stageToCaseStatus)(toStage);
            const toCaseStatus = fromCaseStatus === desiredCaseStatus
                ? fromCaseStatus
                : (0, case_status_1.isAllowedTransition)(fromCaseStatus, desiredCaseStatus)
                    ? desiredCaseStatus
                    : fromCaseStatus; // 안전: 허용되지 않으면 변경하지 않음(ops가 별도로 transition 가능)
            await adminApp.firestore().runTransaction(async (tx) => {
                tx.set(wfR, {
                    caseId,
                    casePackId: packId,
                    stage: toStage,
                    checklist,
                    updatedAt: now,
                    ...(wfSnap.exists ? {} : { createdAt: now })
                }, { merge: true });
                if (toCaseStatus !== fromCaseStatus) {
                    tx.set((0, firestore_1.caseRef)(adminApp, caseId), {
                        status: toCaseStatus,
                        updatedAt: now,
                        summary: {
                            ...(c.summary ?? {}),
                            lastEventKo: `업무 단계 변경(${currentStage}→${toStage})`
                        }
                    }, { merge: true });
                }
            });
            // 타임라인
            const eventId = node_crypto_1.default.randomUUID();
            await (0, timeline_1.writeTimelineEvent)(adminApp, caseId, eventId, {
                type: "WORKFLOW_STAGE_CHANGED",
                occurredAt: now,
                actor: (0, auth_1.isOps)(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
                summaryKo: `업무 단계가 변경되었습니다: ${currentStage} → ${toStage}`,
                meta: { from: currentStage, to: toStage, caseStatus: toCaseStatus }
            });
            // 단계별 기본 태스크 생성(최소형)
            if ((0, auth_1.partnerIdOf)(auth) || c.partnerId) {
                // stage 태스크는 중복 생성 방지를 위해 안정적인 taskId를 사용
                if (toStage === "docs_collect")
                    await (0, tasks_1.ensureTask)(adminApp, { caseId, taskId: "stage_docs_collect", partnerId: c.partnerId, titleKo: "필수 서류 수집 안내/확인", type: "docs_collect" });
                if (toStage === "docs_review")
                    await (0, tasks_1.ensureTask)(adminApp, { caseId, taskId: "stage_docs_review", partnerId: c.partnerId, titleKo: "서류 검토(필수 체크리스트)", type: "docs_review" });
                if (toStage === "draft_filing")
                    await (0, tasks_1.ensureTask)(adminApp, { caseId, taskId: "stage_draft_filing", partnerId: c.partnerId, titleKo: "등기 서류 작성", type: "draft_filing" });
                if (toStage === "filing_submitted")
                    await (0, tasks_1.ensureTask)(adminApp, { caseId, taskId: "stage_filing_submitted", partnerId: c.partnerId, titleKo: "등기 제출(접수증 업로드/접수정보 입력)", type: "filing_submit" });
            }
            // 전 단계 advance 태스크는 완료 처리
            await (0, tasks_1.setTaskStatus)(adminApp, { caseId, taskId: `advance_${currentStage}`, status: "done" });
            // 새 단계에서 전진 가능 여부를 계산해 태스크 동기화
            const adv = await syncAdvanceTask({ caseId, partnerId: c.partnerId, casePackId: packId, stage: toStage });
            return { stage: toStage, caseStatus: toCaseStatus, advance: adv };
        }).catch((e) => {
            const msg = String(e?.message || e);
            if (msg.startsWith("INVALID_ARGUMENT:")) {
                (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", msg.replace("INVALID_ARGUMENT:", ""));
                return null;
            }
            (0, http_1.fail)(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
            return null;
        });
        if (!result)
            return;
        return (0, http_1.ok)(res, result);
    });
    // 체크리스트 업데이트(법무사/ops)
    app.post("/v1/cases/:caseId/workflow/checklist", async (req, res) => {
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
        const { itemId, done } = req.body ?? {};
        if (!itemId)
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "itemId가 필요합니다.");
        const result = await (0, idempotency_1.withIdempotency)(adminApp, req, res, "workflow.checklist", async () => {
            const wfR = (0, workflow_1.workflowRef)(adminApp, caseId);
            const wfSnap = await wfR.get();
            if (!wfSnap.exists)
                throw new Error("INVALID_ARGUMENT:워크플로우가 없습니다.");
            const wf = wfSnap.data();
            const stage = String(wf.stage);
            const packId = String(wf.casePackId ?? c.casePackId);
            // itemId가 해당 stage의 체크리스트에 존재하는지 검증
            const cfg = (0, casepack_1.getCasePackConfig)(packId);
            const items = cfg?.checklistByStage?.[stage] ?? [];
            if (!items.some((it) => it.id === String(itemId))) {
                throw new Error("INVALID_ARGUMENT:현재 단계의 체크리스트 항목이 아닙니다.");
            }
            const now = adminApp.firestore.FieldValue.serverTimestamp();
            await wfR.set({
                checklist: { [String(itemId)]: Boolean(done) },
                updatedAt: now
            }, { merge: true });
            const eventId = node_crypto_1.default.randomUUID();
            await (0, timeline_1.writeTimelineEvent)(adminApp, caseId, eventId, {
                type: "CHECKLIST_UPDATED",
                occurredAt: now,
                actor: (0, auth_1.isOps)(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
                summaryKo: `체크리스트 업데이트: ${String(itemId)}=${Boolean(done)}`,
                meta: { stage, itemId: String(itemId), done: Boolean(done) }
            });
            const adv = await syncAdvanceTask({ caseId, partnerId: c.partnerId, casePackId: packId, stage });
            return { stage, itemId: String(itemId), done: Boolean(done), advance: adv };
        }).catch((e) => {
            const msg = String(e?.message || e);
            if (msg.startsWith("INVALID_ARGUMENT:")) {
                (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", msg.replace("INVALID_ARGUMENT:", ""));
                return null;
            }
            (0, http_1.fail)(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
            return null;
        });
        if (!result)
            return;
        return (0, http_1.ok)(res, result);
    });
}
//# sourceMappingURL=workflow.js.map