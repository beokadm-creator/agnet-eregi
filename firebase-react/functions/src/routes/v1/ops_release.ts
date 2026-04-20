import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth, isOps } from "../../lib/auth";
import { fail, ok, logError } from "../../lib/http";
import { requireOpsRole } from "../../lib/ops_rbac";
import { logOpsEvent } from "../../lib/ops_audit";

export function registerOpsReleaseRoutes(app: express.Application, adminApp: typeof admin) {
  
  // 1) POST /v1/ops/preflight
  app.post("/v1/ops/preflight", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = req.body.gateKey ? String(req.body.gateKey) : undefined;
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin", gateKey);
      if (!hasRole) return;

      const checks: Array<{ name: string; status: "ok" | "warn" | "fail"; hint: string }> = [];

      // 1. Slack webhook check
      let slackOk = false;
      if (process.env.OPS_ALERT_WEBHOOK_URL) {
        slackOk = true;
      } else if (gateKey) {
        const gateSnap = await adminApp.firestore().collection("ops_gate_settings").doc(gateKey).get();
        if (gateSnap.exists && gateSnap.data()?.slackWebhookUrl) {
          slackOk = true;
        }
      }
      checks.push({
        name: "Slack Webhook URL",
        status: slackOk ? "ok" : "warn",
        hint: "환경변수 OPS_ALERT_WEBHOOK_URL 또는 Gate Settings에 설정이 없으면 알림 발송이 실패합니다."
      });

      // 2. GitHub Token check (for dead-letter issue)
      let ghTokenOk = false;
      if (process.env.GITHUB_TOKEN_BACKLOG_BOT) {
        ghTokenOk = true;
      }
      checks.push({
        name: "GitHub Token (Backlog)",
        status: ghTokenOk ? "ok" : "fail",
        hint: "환경변수 GITHUB_TOKEN_BACKLOG_BOT이 없으면 Dead-letter 자동 이슈 생성이 불가합니다."
      });

      // 3. Firestore Index Warning
      checks.push({
        name: "Firestore Composite Indexes",
        status: "warn",
        hint: "ops_audit_events 쿼리 시 (gateKey+createdAt), (action+createdAt) 등 복합 인덱스가 필요할 수 있습니다. 콘솔 에러를 확인하세요."
      });

      // 4. opsRole Claim Check
      const userRecord = await adminApp.auth().getUser(auth.uid);
      const role = userRecord.customClaims?.opsRole;
      checks.push({
        name: "opsRole Claim",
        status: role ? "ok" : "fail",
        hint: `현재 사용자의 opsRole: ${role || "없음"}. 올바른 권한이 부여되었는지 확인하세요.`
      });

      // 5. Worker Registration Check (Environment Variables or functions config)
      // Cloud Functions에서는 직접 워커 목록을 가져오기 어려우므로, 예상되는 워커 함수들이 배포되었는지 가이드
      checks.push({
        name: "Scheduled Workers",
        status: "ok",
        hint: "opsRetryWorker, opsAlertWorker, opsIncidentWorker, opsWeeklySummaryWorker가 배포되었는지 확인하세요."
      });

      const passed = !checks.some(c => c.status === "fail");

      await logOpsEvent(adminApp, {
        gateKey: gateKey || "unknown",
        action: "ops_preflight.run",
        status: passed ? "success" : "fail",
        actorUid: auth.uid,
        requestId: String((req as any).requestId || "unknown"),
        summary: `Preflight checks run. Passed: ${passed}`,
        target: { gateKey, checks }
      });

      return ok(res, { passed, checks });
    } catch (err: any) {
      logError({ endpoint: "ops/preflight", code: "INTERNAL", messageKo: "Preflight 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 2) POST /v1/ops/smoke-test
  app.post("/v1/ops/smoke-test", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const gateKey = String(req.body.gateKey || "pilot-gate");
      const mode = String(req.body.mode || "read_only");

      // read_only는 operator, full은 admin
      const requiredRole = mode === "full" ? "ops_admin" : "ops_operator";
      const hasRole = await requireOpsRole(adminApp, req, res, auth, requiredRole, gateKey);
      if (!hasRole) return;

      const results: Array<{ endpoint: string; method: string; status: "ok" | "fail"; durationMs: number; error?: string }> = [];

      // Helper for internal API call
      const runTest = async (method: string, path: string, body?: any) => {
        const start = Date.now();
        try {
          // req 객체에서 token 추출 (간단히 Authorization 헤더 사용)
          const token = req.headers.authorization;
          
          // Get local host from req
          const host = req.get('host');
          const protocol = req.protocol || 'http';
          const baseUrl = `${protocol}://${host}`;
          
          const response = await globalThis.fetch(`${baseUrl}${path}`, {
            method,
            headers: {
              "Authorization": token || "",
              "Content-Type": "application/json"
            },
            body: body ? JSON.stringify(body) : undefined
          });

          const data = await response.json().catch(() => ({}));
          
          results.push({
            endpoint: path,
            method,
            status: (response.ok && data.ok) ? "ok" : "fail",
            durationMs: Date.now() - start,
            error: (response.ok && data.ok) ? undefined : (data.error?.messageKo || data.error?.message || `HTTP ${response.status}`)
          });
        } catch (e: any) {
          results.push({
            endpoint: path,
            method,
            status: "fail",
            durationMs: Date.now() - start,
            error: e.message
          });
        }
      };

      // Read-only tests
      await runTest("GET", `/v1/ops/health/summary?gateKey=${gateKey}`);
      await runTest("GET", `/v1/ops/gates/${gateKey}/settings`);
      await runTest("GET", `/v1/ops/gates/${gateKey}/alert-policy`);
      await runTest("GET", `/v1/ops/incidents?gateKey=${gateKey}&limit=5`);

      // Full mode tests
      if (mode === "full") {
        await runTest("POST", `/v1/ops/alerts/test`, { gateKey, message: "Smoke Test - Auto Generated" });
      }

      const passed = !results.some(r => r.status === "fail");

      await logOpsEvent(adminApp, {
        gateKey,
        action: "ops_smoketest.run",
        status: passed ? "success" : "fail",
        actorUid: auth.uid,
        requestId: String((req as any).requestId || "unknown"),
        summary: `Smoke test (${mode}) run. Passed: ${passed}`,
        target: { gateKey, mode, resultsSummary: results }
      });

      return ok(res, { passed, mode, results });
    } catch (err: any) {
      logError({ endpoint: "ops/smoke-test", code: "INTERNAL", messageKo: "Smoke Test 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });
}
