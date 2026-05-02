import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { fail, ok, logError } from "../../lib/http";
import { checkAndRecordUsage } from "../../lib/quota";
import { processOpsIncidents } from "../../lib/ops_incident_worker";
import { logOpsEvent } from "../../lib/ops_audit";
import { resetCircuitBreaker } from "../../lib/ops_circuit_breaker";
import { notifyOpsAlert } from "../../lib/ops_alert";
import { createDeadLetterIssueAction } from "../../lib/ops_actions";
import { safeQuery } from "../../lib/ops_query_health";
import { llmChatComplete } from "../../lib/llm_engine";
import { buildDataBlock, SYSTEM_HARDENING_SUFFIX } from "../../lib/prompt_sanitize";

function parseJsonText(text: string): any {
  const t = String(text || "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const cleaned = t.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
    return JSON.parse(cleaned);
  }
}

export function registerOpsIncidentRoutes(app: express.Application, adminApp: typeof admin) {
  
  // 1) GET /v1/ops/incidents
  app.get("/v1/ops/incidents", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = req.query.gateKey ? String(req.query.gateKey) : undefined;
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", gateKey);
      if (!hasRole) return;

      const status = req.query.status ? String(req.query.status) : undefined;
      const limit = Number(req.query.limit) || 50;

      let query: admin.firestore.Query = adminApp.firestore().collection("ops_incidents");

      if (gateKey) {
        query = query.where("gateKey", "==", gateKey);
      }
      if (status) {
        query = query.where("status", "==", status);
      }

      query = query.orderBy("startAt", "desc").limit(limit);

      const snap = await safeQuery(adminApp, gateKey || "unknown", "ops_incidents_query", async () => await query.get(), null);
      if (!snap) return fail(res, 500, "FAILED_PRECONDITION", "Query Health에 의해 차단되었습니다.");

      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "incidents/list", code: "INTERNAL", messageKo: "Incident 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", "Incident 목록 조회 실패");
    }
  });

  // 2) GET /v1/ops/incidents/:id
  app.get("/v1/ops/incidents/:id", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const incidentId = String(req.params.id);
      const docRef = adminApp.firestore().collection("ops_incidents").doc(incidentId);
      const snap = await docRef.get();
      
      if (!snap.exists) {
        return fail(res, 404, "NOT_FOUND", "Incident를 찾을 수 없습니다.");
      }

      const data = snap.data();
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", data?.gateKey);
      if (!hasRole) return;

      return ok(res, { incident: { id: snap.id, ...data } });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 2-1) POST /v1/ops/incidents/:id/ai/triage
  app.post("/v1/ops/incidents/:id/ai/triage", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const incidentId = String(req.params.id);
      const docRef = adminApp.firestore().collection("ops_incidents").doc(incidentId);
      const snap = await docRef.get();
      if (!snap.exists) return fail(res, 404, "NOT_FOUND", "Incident를 찾을 수 없습니다.");

      const data = snap.data() as any;
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_operator", data?.gateKey);
      if (!hasRole) return;

      const quotaOk = await checkAndRecordUsage(auth.uid, "ops_ai", 500);
      if (!quotaOk) {
        return fail(res, 429, "RESOURCE_EXHAUSTED", "AI 호출 일일 한도를 초과했습니다. 내일 다시 시도해주세요.");
      }

      const prompt = `
당신은 SRE/운영 담당자를 돕는 Incident triage AI입니다.
아래 Incident JSON을 바탕으로 원인 가설/확인 체크리스트/권고 조치를 한국어로 정리해 주세요.
반드시 오직 JSON으로만 응답하세요. 마크다운 백틱(\`\`\`)은 쓰지 마세요.

입력:
${buildDataBlock("incident-input", { id: incidentId, ...data })}

출력(JSON):
{
  "summaryKo": "요약(1~2문장)",
  "probableCausesKo": ["원인 가설 1", "원인 가설 2"],
  "checksKo": ["확인 항목 1", "확인 항목 2"],
  "suggestedActionsKo": ["권고 조치 1", "권고 조치 2"]
}
`;

      const out = await llmChatComplete(
        adminApp,
        [
          { role: "system", content: "당신은 한국어로만 답변하며, 오직 유효한 JSON만 반환합니다." + SYSTEM_HARDENING_SUFFIX },
          { role: "user", content: prompt },
        ],
        { temperature: 0.2, maxTokens: 900, expectJson: true }
      );

      const parsed = parseJsonText(out.text || "{}");
      const aiTriage = {
        ...parsed,
        provider: out.provider,
        model: out.model,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.uid,
      };

      await docRef.set({ aiTriage }, { merge: true });
      return ok(res, { aiTriage });
    } catch (err: any) {
      logError({ endpoint: "ops/incidents/ai/triage", code: "INTERNAL", messageKo: "AI triage 생성 실패", err });
      return fail(res, 500, "INTERNAL", "AI triage 생성 실패");
    }
  });

  // 3) POST /v1/ops/incidents/rebuild
  app.post("/v1/ops/incidents/rebuild", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin");
      if (!hasRole) return;

      // 간단한 rebuild 로직: 기존 incidents 지우고 지난 7일치 이벤트 다시 스캔
      // 실제로는 timeout 위험이 있으므로 제한적으로 구현 (예: 최근 1일치만 하거나)
      // 여기서는 7일치 이벤트 조회하여 rebuild
      
      const db = adminApp.firestore();
      
      // 1. 기존 incidents 삭제 (간단히 최대 500개만 삭제)
      const incidentsSnap = await db.collection("ops_incidents").limit(500).get();
      const batch = db.batch();
      for (const doc of incidentsSnap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();

      // 2. 지난 7일치 이벤트 가져오기
      const sevenDaysAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // state 갱신 (worker가 다시 7일 전부터 시작하도록 유도)
      await db.collection("ops_system").doc("incident_worker_state").set({
        lastProcessedTime: sevenDaysAgo
      });

      // 즉시 worker 로직 실행
      await processOpsIncidents(adminApp);

      return ok(res, { message: "Rebuild completed." });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 4) GET /v1/ops/incidents/:id/playbook
  app.get("/v1/ops/incidents/:id/playbook", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const incidentId = String(req.params.id);
      const docRef = adminApp.firestore().collection("ops_incidents").doc(incidentId);
      const snap = await docRef.get();
      
      if (!snap.exists) {
        return fail(res, 404, "NOT_FOUND", "Incident를 찾을 수 없습니다.");
      }

      const data = snap.data();
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer", data?.gateKey);
      if (!hasRole) return;

      const triage = data?.triage || { type: "unknown", confidence: 0, reasons: [], suggestedActions: [] };
      
      const ALL_ACTIONS: Record<string, { label: string, desc: string, requiredRole: string }> = {
        cb_reset: { label: "CB Reset", desc: "Circuit Breaker를 강제로 리셋합니다.", requiredRole: "ops_admin" },
        deadletter_issue: { label: "Create Issue", desc: "Dead-letter 큐의 Job들을 수동으로 이슈화합니다.", requiredRole: "ops_admin" },
        alert_force_send: { label: "Force Alert", desc: "강제 알림(수동 메시지)을 발송합니다.", requiredRole: "ops_operator" },
      };

      const steps = triage.suggestedActions.map((actionKey: string) => ({
        actionKey,
        ...ALL_ACTIONS[actionKey]
      }));

      // 실제 실행 가능한(runnable) 액션 키들. (UI에서 참고용)
      const runnableActions = Object.keys(ALL_ACTIONS);

      return ok(res, { 
        triage, 
        steps, 
        runnableActions 
      });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 5) POST /v1/ops/incidents/:id/playbook/run
  app.post("/v1/ops/incidents/:id/playbook/run", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const incidentId = String(req.params.id);
      const docRef = adminApp.firestore().collection("ops_incidents").doc(incidentId);
      const snap = await docRef.get();
      
      if (!snap.exists) {
        return fail(res, 404, "NOT_FOUND", "Incident를 찾을 수 없습니다.");
      }

      const incidentData = snap.data();
      const gateKey = incidentData?.gateKey;

      const { actionKey, params } = req.body;
      if (!actionKey) return fail(res, 400, "INVALID_ARGUMENT", "actionKey is required");

      let resultStatus: "success" | "fail" = "success";
      let ref: string | undefined = undefined;

      if (actionKey === "cb_reset") {
        const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin", gateKey);
        if (!hasRole) return;

        await resetCircuitBreaker(adminApp, gateKey, `Manual reset via playbook by ${auth.uid}`);
        ref = "cb_reset_done";
      } else if (actionKey === "deadletter_issue") {
        const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin", gateKey);
        if (!hasRole) return;

        // Find the dead jobs for this gateKey
        const deadJobsSnap = await adminApp.firestore().collection("ops_retry_jobs")
          .where("gateKey", "==", gateKey)
          .where("status", "==", "dead")
          .limit(1)
          .get();

        if (deadJobsSnap.empty) {
          resultStatus = "fail";
          ref = "no_dead_jobs_found";
        } else {
          // Trigger the dead letter issue action for the first one for simplicity,
          // or ideally trigger a bulk action. We will trigger for the first one.
          const jobId = deadJobsSnap.docs[0].id;
          const job = deadJobsSnap.docs[0].data() as any;
          try {
            const issueResult = await createDeadLetterIssueAction(
              adminApp,
              String(gateKey || "unknown"),
              String(job.action || "unknown"),
              String(job.lastError?.message || "Unknown error"),
              Number(job.attempts || 0),
              jobId,
              job.sourceEventId ? String(job.sourceEventId) : undefined
            );
            if (!issueResult) {
              resultStatus = "fail";
              ref = "missing_github_project_config";
            } else {
              ref = issueResult.issueUrl;
            }
          } catch(e) {
            resultStatus = "fail";
            ref = String(e);
          }
        }
      } else if (actionKey === "alert_force_send") {
        const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_operator", gateKey);
        if (!hasRole) return;

        const message = params?.message || "Incident Playbook - Force Alert";
        const result = await notifyOpsAlert({
          gateKey,
          action: "manual_override",
          alertType: "manual",
          summary: message,
          severity: "warning",
          force: true
        });

        if (!result.success) {
          resultStatus = "fail";
          ref = result.reason;
        } else {
          ref = "alert_sent";
        }
      } else {
        return fail(res, 400, "INVALID_ARGUMENT", "Unsupported actionKey");
      }

      // Record in audit log
      await logOpsEvent(adminApp, {
        gateKey,
        action: "ops_playbook.run",
        status: resultStatus,
        actorUid: auth.uid,
        requestId: String(req.requestId || "unknown"),
        summary: `Playbook run: ${actionKey} for incident ${incidentId}`,
        target: { incidentId, actionKey, params, ref }
      });

      // Record in incident
      await docRef.update({
        actionsTaken: admin.firestore.FieldValue.arrayUnion({
          at: admin.firestore.FieldValue.serverTimestamp(),
          actionKey,
          actorUid: auth.uid,
          result: resultStatus,
          ref
        })
      });

      return ok(res, { result: resultStatus, ref });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });
}
