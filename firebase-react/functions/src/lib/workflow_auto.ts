import type * as admin from "firebase-admin";
import crypto from "node:crypto";

import { caseRef } from "./firestore";
import { writeTimelineEvent } from "./timeline";
import { initChecklist, nextStage, stageToCaseStatus, validateStagePrerequisites, workflowRef } from "./workflow";
import { isAllowedTransition, type CaseStatus } from "./case_status";
import { ensureTask, setTaskStatus } from "./tasks";

/**
 * filing_submitted 단계의 “완료 조건”이 충족되면 자동으로 completed까지 전진한다.
 * - 현재는 실무적으로 가장 중요한 “제출 후 완료” 자동화를 우선 구현한다.
 */
export async function tryAutoCompleteAfterFiling(
  adminApp: typeof admin,
  params: {
    caseId: string;
    actor:
      | { type: "ops"; uid: string }
      | { type: "partner"; partnerId: string; uid: string };
  }
) {
  const { caseId, actor } = params;
  const cs = await caseRef(adminApp, caseId).get();
  if (!cs.exists) return { ok: false as const, reason: "case_not_found" as const };
  const c = cs.data() as any;
  const packId = String(c.casePackId ?? "");

  const wfSnap = await workflowRef(adminApp, caseId).get();
  if (!wfSnap.exists) return { ok: false as const, reason: "workflow_not_found" as const };
  const wf = wfSnap.data() as any;
  const stage = String(wf.stage || "intake");
  if (stage !== "filing_submitted") return { ok: true as const, advanced: false as const, skipped: "not_filing_stage" as const };

  const ns = nextStage(packId, "filing_submitted");
  if (ns !== "completed") return { ok: true as const, advanced: false as const, skipped: "no_completed_next" as const };

  // filing_submitted “완료 조건” 검증(필수 슬롯 OK + 체크리스트 + 접수정보)
  const prereq = await validateStagePrerequisites(adminApp, { caseId, casePackId: packId, stage: "filing_submitted" });
  if (!prereq.ok) return { ok: true as const, advanced: false as const, skipped: "prereq_not_met" as const, reasonKo: prereq.reasonKo };

  const now = adminApp.firestore.FieldValue.serverTimestamp();
  const toStage = "completed";
  const desiredCaseStatus = stageToCaseStatus("completed");

  await adminApp.firestore().runTransaction(async (tx) => {
    const caseSnap = await tx.get(caseRef(adminApp, caseId));
    if (!caseSnap.exists) throw new Error("CASE_NOT_FOUND");
    const c2 = caseSnap.data() as any;

    const fromCaseStatus = String(c2.status || "new") as CaseStatus;
    const toCaseStatus =
      fromCaseStatus === desiredCaseStatus
        ? fromCaseStatus
        : isAllowedTransition(fromCaseStatus, desiredCaseStatus)
          ? desiredCaseStatus
          : fromCaseStatus;

    tx.set(
      workflowRef(adminApp, caseId),
      {
        stage: toStage,
        checklist: initChecklist(packId, toStage),
        updatedAt: now
      },
      { merge: true }
    );

    if (toCaseStatus !== fromCaseStatus) {
      tx.set(
        caseRef(adminApp, caseId),
        {
          status: toCaseStatus,
          updatedAt: now,
          summary: { ...(c2.summary ?? {}), lastEventKo: "등기 제출 완료(자동 처리)" }
        },
        { merge: true }
      );
    }
  });

  const eventId = crypto.randomUUID();
  await writeTimelineEvent(adminApp, caseId, eventId, {
    type: "WORKFLOW_STAGE_CHANGED",
    occurredAt: now,
    actor,
    summaryKo: "등기 제출 완료로 케이스가 완료 처리되었습니다.",
    meta: { from: "filing_submitted", to: "completed", by: "auto_complete_after_filing" }
  });

  // stage/advance 태스크 정리
  await setTaskStatus(adminApp, { caseId, taskId: "stage_filing_submitted", status: "done" });
  await setTaskStatus(adminApp, { caseId, taskId: "advance_filing_submitted", status: "done" });

  const e2 = crypto.randomUUID();
  await writeTimelineEvent(adminApp, caseId, e2, {
    type: "PACKAGE_READY",
    occurredAt: now,
    actor,
    summaryKo: "제출 패키지/리포트 다운로드가 준비되었습니다.",
    meta: {
      submissionPackagePath: `/v1/cases/${caseId}/packages/submission.zip`,
      closingReportPath: `/v1/cases/${caseId}/reports/closing.docx`
    }
  });

  return { ok: true as const, advanced: true as const, toStage };
}

/**
 * draft_filing 단계에서 필수 서류/서명본이 모두 OK가 되면 filing_submitted로 자동 전진한다.
 * (사용자가 "다음 단계로" 버튼을 누르지 않아도 흐름이 자연스럽게 이어지도록)
 */
export async function tryAutoAdvanceAfterDraftFiling(
  adminApp: typeof admin,
  params: {
    caseId: string;
    actor:
      | { type: "ops"; uid: string }
      | { type: "partner"; partnerId: string; uid: string };
  }
) {
  const { caseId, actor } = params;
  const cs = await caseRef(adminApp, caseId).get();
  if (!cs.exists) return { ok: false as const, reason: "case_not_found" as const };
  const c = cs.data() as any;
  const packId = String(c.casePackId ?? "");

  const wfSnap = await workflowRef(adminApp, caseId).get();
  if (!wfSnap.exists) return { ok: false as const, reason: "workflow_not_found" as const };
  const wf = wfSnap.data() as any;
  const stage = String(wf.stage || "intake");
  if (stage !== "draft_filing") return { ok: true as const, advanced: false as const, skipped: "not_draft_filing" as const };

  const ns = nextStage(packId, "draft_filing");
  if (ns !== "filing_submitted") return { ok: true as const, advanced: false as const, skipped: "unexpected_next" as const };

  const prereq = await validateStagePrerequisites(adminApp, { caseId, casePackId: packId, stage: "draft_filing" });
  if (!prereq.ok) return { ok: true as const, advanced: false as const, skipped: "prereq_not_met" as const, reasonKo: prereq.reasonKo };

  const now = adminApp.firestore.FieldValue.serverTimestamp();
  const toStage = "filing_submitted";
  const desiredCaseStatus = stageToCaseStatus(toStage);

  await adminApp.firestore().runTransaction(async (tx) => {
    const caseSnap = await tx.get(caseRef(adminApp, caseId));
    if (!caseSnap.exists) throw new Error("CASE_NOT_FOUND");
    const c2 = caseSnap.data() as any;

    const fromCaseStatus = String(c2.status || "new") as CaseStatus;
    const toCaseStatus =
      fromCaseStatus === desiredCaseStatus
        ? fromCaseStatus
        : isAllowedTransition(fromCaseStatus, desiredCaseStatus)
          ? desiredCaseStatus
          : fromCaseStatus;

    tx.set(
      workflowRef(adminApp, caseId),
      {
        stage: toStage,
        checklist: initChecklist(packId, toStage),
        updatedAt: now
      },
      { merge: true }
    );

    if (toCaseStatus !== fromCaseStatus) {
      tx.set(
        caseRef(adminApp, caseId),
        {
          status: toCaseStatus,
          updatedAt: now,
          summary: { ...(c2.summary ?? {}), lastEventKo: "등기서류 작성 완료(자동 전진)" }
        },
        { merge: true }
      );
    }
  });

  // stage task 생성(안정적인 taskId)
  if (c.partnerId) {
    await ensureTask(adminApp, {
      caseId,
      taskId: "stage_filing_submitted",
      partnerId: String(c.partnerId),
      titleKo: "등기 제출(접수증 업로드/접수정보 입력)",
      type: "filing_submit"
    });
  }

  // advance_draft_filing 태스크는 완료 처리(있으면)
  await setTaskStatus(adminApp, { caseId, taskId: "advance_draft_filing", status: "done" });

  const eventId = crypto.randomUUID();
  await writeTimelineEvent(adminApp, caseId, eventId, {
    type: "WORKFLOW_STAGE_CHANGED",
    occurredAt: now,
    actor,
    summaryKo: "등기 서류 작성 완료로 다음 단계로 자동 전진했습니다.",
    meta: { from: "draft_filing", to: "filing_submitted", by: "auto_advance_after_draft_filing" }
  });

  return { ok: true as const, advanced: true as const, toStage };
}
