import { Express } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { ok, fail, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerTaskRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 운영자/파트너의 할 일(Task) 목록 조회 (GET /v1/tasks)
  app.get("/v1/tasks", requireAuth, async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const uid = req.user!.uid;
    const isOps = req.user!.isOps;
    const isPartner = req.user!.partnerId != null;
    const partnerId = req.user!.partnerId;

    try {
      let query: admin.firestore.Query = db.collection("tasks").where("status", "==", "pending");

      if (isOps) {
        // 운영자는 할당되지 않거나 특정 ops 큐에 있는 태스크를 볼 수 있음 (여기서는 예시로 전체 미해결 태스크)
        query = query.orderBy("createdAt", "asc").limit(50);
      } else if (isPartner) {
        // 파트너는 자신에게 할당된 태스크(예: 서류 검토 요청 알림 등)만 조회
        query = query.where("assigneeId", "==", partnerId).orderBy("createdAt", "asc").limit(50);
      } else {
        // 유저의 경우 유저가 해야 할 일(예: 결제 대기, 보완 서류 제출)
        query = query.where("assigneeId", "==", uid).orderBy("createdAt", "asc").limit(50);
      }

      const snapshot = await query.get();
      const tasks = snapshot.docs.map(doc => doc.data());

      return ok(res, { tasks }, requestId);
    } catch (error: any) {
      logError("GET /v1/tasks", "N/A", "INTERNAL", "할 일 목록 조회 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "할 일 목록 조회에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. 특정 태스크 완료 처리 (PATCH /v1/tasks/:taskId/complete)
  app.patch("/v1/tasks/:taskId/complete", requireAuth, async (req, res) => {
    const requestId = req.requestId || "req-unknown";
    const uid = req.user!.uid;
    const isOps = req.user!.isOps;
    const partnerId = req.user!.partnerId;
    const taskId = String(req.params.taskId);
    const { resolution } = req.body; // 해결 내용 또는 코멘트

    try {
      const taskRef = db.collection("tasks").doc(taskId);
      const taskDoc = await taskRef.get();

      if (!taskDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 태스크를 찾을 수 없습니다.", { requestId });
      }

      const taskData = taskDoc.data() as any;

      // 권한 검사 (할당자이거나 운영자여야 함)
      const isAssignee = taskData.assigneeId === uid || taskData.assigneeId === partnerId;
      if (!isAssignee && !isOps) {
        return fail(res, 403, "PERMISSION_DENIED", "이 태스크를 완료 처리할 권한이 없습니다.", { requestId });
      }

      if (taskData.status !== "pending") {
        return fail(res, 400, "FAILED_PRECONDITION", "이미 완료되거나 취소된 태스크입니다.", { requestId });
      }

      await taskRef.update({
        status: "completed",
        resolution: resolution || null,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedBy: uid,
      });

      // 감사 로그 기록
      await logOpsEvent(db, "TASK_COMPLETED", "SUCCESS", uid, requestId, taskData.caseId || "N/A", {
        taskId,
        resolution,
      });

      return ok(res, { id: taskId, status: "completed" }, requestId);
    } catch (error: any) {
      logError("PATCH /v1/tasks/:taskId/complete", taskId, "INTERNAL", "태스크 완료 처리 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "태스크 완료 처리에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
