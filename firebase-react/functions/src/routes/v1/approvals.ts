import { Express } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

import { processApprovalAction } from "../../lib/ops_approval_worker";

export function registerApprovalRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. [운영자 전용] 2인 승인(Two-man rule) 목록 조회 (GET /v1/ops/approvals)
  app.get("/v1/ops/approvals", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const isOps = (req as any).user.isOps;

    if (!isOps) {
      return fail(res, 403, "PERMISSION_DENIED", "운영자만 접근 가능한 기능입니다.", { requestId });
    }

    try {
      const snapshot = await db.collection("ops_approvals")
        .where("status", "==", "pending")
        .orderBy("createdAt", "asc")
        .limit(50)
        .get();

      const approvals = snapshot.docs.map(doc => doc.data());

      return ok(res, { approvals }, requestId);
    } catch (error: any) {
      logError("GET /v1/ops/approvals", "N/A", "INTERNAL", "승인 대기 목록 조회 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "승인 대기 목록 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. [운영자 전용] 승인 요청 승인/반려 (PATCH /v1/ops/approvals/:approvalId/status)
  // 대상: 고액 환불, 예외적 파트너 교체 등 민감한 작업
  app.patch("/v1/ops/approvals/:approvalId/status", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const uid = (req as any).user.uid;
    const isOps = (req as any).user.isOps;
    const approvalId = String(req.params.approvalId);
    const { status, comment } = req.body; // status: "approved" | "rejected"

    if (!isOps) {
      return fail(res, 403, "PERMISSION_DENIED", "운영자만 접근 가능한 기능입니다.", { requestId });
    }

    if (!["approved", "rejected"].includes(status)) {
      return fail(res, 400, "INVALID_ARGUMENT", "올바르지 않은 상태값입니다 (approved 또는 rejected).", { requestId });
    }

    if (status === "rejected" && !comment) {
      return fail(res, 400, "INVALID_ARGUMENT", "반려 시 코멘트(comment)가 필요합니다.", { requestId });
    }

    try {
      const approvalRef = db.collection("ops_approvals").doc(approvalId);
      const approvalDoc = await approvalRef.get();

      if (!approvalDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 승인 요청을 찾을 수 없습니다.", { requestId });
      }

      const approvalData = approvalDoc.data() as any;

      if (approvalData.status !== "pending") {
        return fail(res, 400, "FAILED_PRECONDITION", "이미 처리된 승인 요청입니다.", { requestId });
      }

      // 자기 자신이 요청한 건은 자신이 승인할 수 없음 (Two-man rule 제어)
      if (approvalData.requestedBy === uid) {
        return fail(res, 403, "PERMISSION_DENIED", "자신이 요청한 건은 직접 승인할 수 없습니다.", { requestId });
      }

      await approvalRef.update({
        status,
        comment: comment || null,
        reviewedBy: uid,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 승인되었다면(status === "approved"), approvalData.actionType에 따라 후속 작업 실행 (예: 환불 워커 호출)
      if (status === "approved") {
        try {
          await processApprovalAction(db, approvalData, uid);
        } catch (execError: any) {
          logError("PATCH /v1/ops/approvals/:approvalId/status", "N/A", "INTERNAL", "승인 후속 작업 중 오류가 발생했습니다.", execError, requestId);
          // 후속 작업 실패 시, 승인 상태를 failed_execution으로 남기거나 에러를 반환
          await approvalRef.update({
            status: "failed_execution",
            executionError: execError.message
          });
          return fail(res, 500, "INTERNAL", "승인은 처리되었으나, 후속 작업 실행에 실패했습니다.", { error: execError.message, requestId });
        }
      }

      // 감사 로그 기록
      const auditEventName = status === "approved" ? "OPS_APPROVAL_GRANTED" : "OPS_APPROVAL_REJECTED";
      await logOpsEvent(db, auditEventName, "SUCCESS", uid, requestId, approvalData.caseId || "N/A", {
        approvalId,
        actionType: approvalData.actionType,
        comment,
      });

      return ok(res, { id: approvalId, status }, requestId);
    } catch (error: any) {
      logError("PATCH /v1/ops/approvals/:approvalId/status", "N/A", "INTERNAL", "승인 처리 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "승인 처리에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
