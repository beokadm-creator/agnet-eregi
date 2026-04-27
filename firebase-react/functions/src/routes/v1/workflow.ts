import { Express, Request, Response } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerWorkflowRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  /**
   * 내부 헬퍼 함수: 케이스 접근 권한(소유권 및 할당 여부) 검증
   */
  async function checkCaseAccess(caseId: string, req: any, res: any, requestId: string) {
    const uid = req.user.uid;
    const isPartner = req.user.partnerId != null;
    const partnerId = req.user.partnerId;

    const doc = await db.collection("cases").doc(caseId).get();
    if (!doc.exists) {
      return { allowed: false, response: fail(res, 404, "NOT_FOUND", "해당 케이스를 찾을 수 없습니다.", { requestId }) };
    }

    const caseData = doc.data() as any;
    if (isPartner) {
      if (caseData.partnerId !== partnerId) {
        return { allowed: false, response: fail(res, 403, "FORBIDDEN", "이 케이스에 접근할 권한이 없습니다.", { requestId }) };
      }
    } else {
      if (caseData.userId !== uid) {
        return { allowed: false, response: fail(res, 403, "FORBIDDEN", "이 케이스에 접근할 권한이 없습니다.", { requestId }) };
      }
    }

    return { allowed: true, caseData, caseRef: doc.ref };
  }

  // 1. 케이스 상태 전이 이벤트 트리거 (POST /v1/cases/:caseId/events)
  app.post("/v1/cases/:caseId/events", requireAuth, async (req: Request, res: Response) => {
    const requestId = (req as any).requestId || "req-unknown";
    const uid = (req as any).user.uid;
    const isPartner = (req as any).user.partnerId != null;
    const caseId = req.params.caseId as string;
    const { event, payload } = req.body;

    if (!event) {
      return fail(res, 400, "INVALID_ARGUMENT", "트리거할 이벤트명(event)이 필요합니다.", { requestId });
    }

    try {
      const access = await checkCaseAccess(caseId, req, res, requestId);
      if (!access.allowed) return access.response;

      const { caseData, caseRef } = access;
      const currentStatus = caseData.status;
      let nextStatus = currentStatus;

      switch (event) {
        case "SUBMIT_DOCS":
          if (currentStatus !== "draft_filing" && currentStatus !== "needs_revision") {
            return fail(res, 400, "FAILED_PRECONDITION", "현재 상태에서는 서류를 제출할 수 없습니다.", { currentStatus, requestId });
          }
          if (isPartner) {
            return fail(res, 403, "FORBIDDEN", "서류 제출은 유저만 가능합니다.", { requestId });
          }
          nextStatus = "under_review";
          break;

        case "APPROVE_ALL_DOCS":
          if (currentStatus !== "under_review") {
            return fail(res, 400, "FAILED_PRECONDITION", "현재 상태에서는 서류를 승인할 수 없습니다.", { currentStatus, requestId });
          }
          if (!isPartner) {
            return fail(res, 403, "FORBIDDEN", "서류 승인은 파트너만 가능합니다.", { requestId });
          }
          nextStatus = "awaiting_payment";
          break;

        case "REQUEST_REVISION":
          if (currentStatus !== "under_review") {
            return fail(res, 400, "FAILED_PRECONDITION", "현재 상태에서는 보완을 요청할 수 없습니다.", { currentStatus, requestId });
          }
          if (!isPartner) {
            return fail(res, 403, "FORBIDDEN", "보완 요청은 파트너만 가능합니다.", { requestId });
          }
          nextStatus = "needs_revision";
          break;

        case "COMPLETE_FILING":
          if (currentStatus !== "filing_submitted" && currentStatus !== "awaiting_payment") {
            return fail(res, 400, "FAILED_PRECONDITION", "현재 상태에서는 접수를 완료할 수 없습니다.", { currentStatus, requestId });
          }
          if (!isPartner) {
            return fail(res, 403, "FORBIDDEN", "접수 완료는 파트너만 가능합니다.", { requestId });
          }
          nextStatus = "completed";
          break;

        default:
          return fail(res, 400, "INVALID_ARGUMENT", `알 수 없거나 허용되지 않는 이벤트입니다: ${event}`, { requestId });
      }

      if (nextStatus !== currentStatus && caseRef) {
        await caseRef.update({
          status: nextStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await logOpsEvent(admin, {
          action: "WORKFLOW_STATE_TRANSITION",
          status: "success",
          actorUid: uid,
          requestId,
          summary: `상태 변경: ${currentStatus} -> ${nextStatus}`,
          target: { caseId, event, from: currentStatus, to: nextStatus, payload }
        });
      }

      return ok(res, { caseId, previousStatus: currentStatus, status: nextStatus, event });
    } catch (error: any) {
      logError({
        endpoint: "POST /v1/cases/:caseId/events",
        caseId,
        code: "INTERNAL",
        messageKo: "상태 전이 처리 중 오류가 발생했습니다.",
        err: error
      });
      return fail(res, 500, "INTERNAL", "상태 전이 처리에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. 현재 상태에서 가능한 이벤트 목록(Transitions) 조회 (GET /v1/cases/:caseId/transitions)
  app.get("/v1/cases/:caseId/transitions", requireAuth, async (req: Request, res: Response) => {
    const requestId = (req as any).requestId || "req-unknown";
    const caseId = req.params.caseId as string;
    const isPartner = (req as any).user.partnerId != null;

    try {
      const access = await checkCaseAccess(caseId, req, res, requestId);
      if (!access.allowed) return access.response;

      const { caseData } = access;
      const currentStatus = caseData.status;
      const allowedEvents: string[] = [];

      if (currentStatus === "draft_filing" || currentStatus === "needs_revision") {
        if (!isPartner) allowedEvents.push("SUBMIT_DOCS");
      } else if (currentStatus === "under_review") {
        if (isPartner) {
          allowedEvents.push("APPROVE_ALL_DOCS");
          allowedEvents.push("REQUEST_REVISION");
        }
      } else if (currentStatus === "awaiting_payment" || currentStatus === "filing_submitted") {
        if (isPartner) allowedEvents.push("COMPLETE_FILING");
      }

      return ok(res, { caseId, currentStatus, allowedEvents });
    } catch (error: any) {
      logError({
        endpoint: "GET /v1/cases/:caseId/transitions",
        caseId,
        code: "INTERNAL",
        messageKo: "가능한 상태 전이 목록 조회 중 오류가 발생했습니다.",
        err: error
      });
      return fail(res, 500, "INTERNAL", "상태 전이 목록 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 3. 케이스의 워크플로우 및 서류 현황 통합 조회 (GET /v1/cases/:caseId/workflow) - Phase 4 확장
  app.get("/v1/cases/:caseId/workflow", requireAuth, async (req: Request, res: Response) => {
    const requestId = (req as any).requestId || "req-unknown";
    const caseId = req.params.caseId as string;

    try {
      const doc = await db.collection("cases").doc(caseId).get();
      if (!doc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 케이스를 찾을 수 없습니다.", { requestId });
      }

      const caseData = doc.data() as any;
      const casePackId = caseData.casePackId || caseData.type;

      if (!casePackId) {
        return fail(res, 400, "FAILED_PRECONDITION", "해당 케이스는 casePackId(사건팩) 정보가 없습니다.", { requestId });
      }

      const packDoc = await db.collection("case_packs").doc(casePackId).get();
      if (!packDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "참조된 사건팩 설정을 찾을 수 없습니다.", { requestId });
      }

      const packData = packDoc.data() as any;
      
      // 실제로는 cases/{caseId}/documents 서브컬렉션을 조회하여 각 requiredSlot의 충족 여부를 병합해야 합니다.
      // 여기서는 워크플로우 스키마와 현재 상태를 합쳐서 반환하는 구조를 제공합니다.
      const workflowResponse = {
        caseId,
        status: caseData.status,
        stages: packData.workflow?.stages || [],
        requiredSlots: packData.workflow?.requiredSlots || [],
        checklists: packData.workflow?.checklists || {}
      };

      return ok(res, workflowResponse, requestId);
    } catch (error: any) {
      logError({
        endpoint: "GET /v1/cases/:caseId/workflow",
        caseId,
        code: "INTERNAL",
        messageKo: "워크플로우 상태 조회 중 오류가 발생했습니다.",
        err: error
      });
      return fail(res, 500, "INTERNAL", "워크플로우 상태 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
