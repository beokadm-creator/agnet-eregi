"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryAutoCompleteAfterFiling = tryAutoCompleteAfterFiling;
exports.tryAutoAdvanceAfterDraftFiling = tryAutoAdvanceAfterDraftFiling;
const node_crypto_1 = __importDefault(require("node:crypto"));
const firestore_1 = require("./firestore");
const timeline_1 = require("./timeline");
const workflow_1 = require("./workflow");
const case_status_1 = require("./case_status");
const tasks_1 = require("./tasks");
/**
 * filing_submitted 단계의 “완료 조건”이 충족되면 자동으로 completed까지 전진한다.
 * - 현재는 실무적으로 가장 중요한 “제출 후 완료” 자동화를 우선 구현한다.
 */
async function tryAutoCompleteAfterFiling(adminApp, params) {
    const { caseId, actor } = params;
    const cs = await (0, firestore_1.caseRef)(adminApp, caseId).get();
    if (!cs.exists)
        return { ok: false, reason: "case_not_found" };
    const c = cs.data();
    const packId = String(c.casePackId ?? "");
    const wfSnap = await (0, workflow_1.workflowRef)(adminApp, caseId).get();
    if (!wfSnap.exists)
        return { ok: false, reason: "workflow_not_found" };
    const wf = wfSnap.data();
    const stage = String(wf.stage || "intake");
    if (stage !== "filing_submitted")
        return { ok: true, advanced: false, skipped: "not_filing_stage" };
    const ns = (0, workflow_1.nextStage)(packId, "filing_submitted");
    if (ns !== "completed")
        return { ok: true, advanced: false, skipped: "no_completed_next" };
    // filing_submitted “완료 조건” 검증(필수 슬롯 OK + 체크리스트 + 접수정보)
    const prereq = await (0, workflow_1.validateStagePrerequisites)(adminApp, { caseId, casePackId: packId, stage: "filing_submitted" });
    if (!prereq.ok)
        return { ok: true, advanced: false, skipped: "prereq_not_met", reasonKo: prereq.reasonKo };
    const now = adminApp.firestore.FieldValue.serverTimestamp();
    const toStage = "completed";
    const desiredCaseStatus = (0, workflow_1.stageToCaseStatus)("completed");
    await adminApp.firestore().runTransaction(async (tx) => {
        const caseSnap = await tx.get((0, firestore_1.caseRef)(adminApp, caseId));
        if (!caseSnap.exists)
            throw new Error("CASE_NOT_FOUND");
        const c2 = caseSnap.data();
        const fromCaseStatus = String(c2.status || "new");
        const toCaseStatus = fromCaseStatus === desiredCaseStatus
            ? fromCaseStatus
            : (0, case_status_1.isAllowedTransition)(fromCaseStatus, desiredCaseStatus)
                ? desiredCaseStatus
                : fromCaseStatus;
        tx.set((0, workflow_1.workflowRef)(adminApp, caseId), {
            stage: toStage,
            checklist: (0, workflow_1.initChecklist)(packId, toStage),
            updatedAt: now
        }, { merge: true });
        if (toCaseStatus !== fromCaseStatus) {
            tx.set((0, firestore_1.caseRef)(adminApp, caseId), {
                status: toCaseStatus,
                updatedAt: now,
                summary: { ...(c2.summary ?? {}), lastEventKo: "등기 제출 완료(자동 처리)" }
            }, { merge: true });
        }
    });
    const eventId = node_crypto_1.default.randomUUID();
    await (0, timeline_1.writeTimelineEvent)(adminApp, caseId, eventId, {
        type: "WORKFLOW_STAGE_CHANGED",
        occurredAt: now,
        actor,
        summaryKo: "등기 제출 완료로 케이스가 완료 처리되었습니다.",
        meta: { from: "filing_submitted", to: "completed", by: "auto_complete_after_filing" }
    });
    // stage/advance 태스크 정리
    await (0, tasks_1.setTaskStatus)(adminApp, { caseId, taskId: "stage_filing_submitted", status: "done" });
    await (0, tasks_1.setTaskStatus)(adminApp, { caseId, taskId: "advance_filing_submitted", status: "done" });
    const e2 = node_crypto_1.default.randomUUID();
    await (0, timeline_1.writeTimelineEvent)(adminApp, caseId, e2, {
        type: "PACKAGE_READY",
        occurredAt: now,
        actor,
        summaryKo: "제출 패키지/리포트 다운로드가 준비되었습니다.",
        meta: {
            submissionPackagePath: `/v1/cases/${caseId}/packages/submission.zip`,
            closingReportPath: `/v1/cases/${caseId}/reports/closing.docx`
        }
    });
    return { ok: true, advanced: true, toStage };
}
/**
 * draft_filing 단계에서 필수 서류/서명본이 모두 OK가 되면 filing_submitted로 자동 전진한다.
 * (사용자가 "다음 단계로" 버튼을 누르지 않아도 흐름이 자연스럽게 이어지도록)
 */
async function tryAutoAdvanceAfterDraftFiling(adminApp, params) {
    const { caseId, actor } = params;
    const cs = await (0, firestore_1.caseRef)(adminApp, caseId).get();
    if (!cs.exists)
        return { ok: false, reason: "case_not_found" };
    const c = cs.data();
    const packId = String(c.casePackId ?? "");
    const wfSnap = await (0, workflow_1.workflowRef)(adminApp, caseId).get();
    if (!wfSnap.exists)
        return { ok: false, reason: "workflow_not_found" };
    const wf = wfSnap.data();
    const stage = String(wf.stage || "intake");
    if (stage !== "draft_filing")
        return { ok: true, advanced: false, skipped: "not_draft_filing" };
    const ns = (0, workflow_1.nextStage)(packId, "draft_filing");
    if (ns !== "filing_submitted")
        return { ok: true, advanced: false, skipped: "unexpected_next" };
    const prereq = await (0, workflow_1.validateStagePrerequisites)(adminApp, { caseId, casePackId: packId, stage: "draft_filing" });
    if (!prereq.ok)
        return { ok: true, advanced: false, skipped: "prereq_not_met", reasonKo: prereq.reasonKo };
    const now = adminApp.firestore.FieldValue.serverTimestamp();
    const toStage = "filing_submitted";
    const desiredCaseStatus = (0, workflow_1.stageToCaseStatus)(toStage);
    await adminApp.firestore().runTransaction(async (tx) => {
        const caseSnap = await tx.get((0, firestore_1.caseRef)(adminApp, caseId));
        if (!caseSnap.exists)
            throw new Error("CASE_NOT_FOUND");
        const c2 = caseSnap.data();
        const fromCaseStatus = String(c2.status || "new");
        const toCaseStatus = fromCaseStatus === desiredCaseStatus
            ? fromCaseStatus
            : (0, case_status_1.isAllowedTransition)(fromCaseStatus, desiredCaseStatus)
                ? desiredCaseStatus
                : fromCaseStatus;
        tx.set((0, workflow_1.workflowRef)(adminApp, caseId), {
            stage: toStage,
            checklist: (0, workflow_1.initChecklist)(packId, toStage),
            updatedAt: now
        }, { merge: true });
        if (toCaseStatus !== fromCaseStatus) {
            tx.set((0, firestore_1.caseRef)(adminApp, caseId), {
                status: toCaseStatus,
                updatedAt: now,
                summary: { ...(c2.summary ?? {}), lastEventKo: "등기서류 작성 완료(자동 전진)" }
            }, { merge: true });
        }
    });
    // stage task 생성(안정적인 taskId)
    if (c.partnerId) {
        await (0, tasks_1.ensureTask)(adminApp, {
            caseId,
            taskId: "stage_filing_submitted",
            partnerId: String(c.partnerId),
            titleKo: "등기 제출(접수증 업로드/접수정보 입력)",
            type: "filing_submit"
        });
    }
    // advance_draft_filing 태스크는 완료 처리(있으면)
    await (0, tasks_1.setTaskStatus)(adminApp, { caseId, taskId: "advance_draft_filing", status: "done" });
    const eventId = node_crypto_1.default.randomUUID();
    await (0, timeline_1.writeTimelineEvent)(adminApp, caseId, eventId, {
        type: "WORKFLOW_STAGE_CHANGED",
        occurredAt: now,
        actor,
        summaryKo: "등기 서류 작성 완료로 다음 단계로 자동 전진했습니다.",
        meta: { from: "draft_filing", to: "filing_submitted", by: "auto_advance_after_draft_filing" }
    });
    return { ok: true, advanced: true, toStage };
}
//# sourceMappingURL=workflow_auto.js.map