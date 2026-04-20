import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import cors from "cors";
import express from "express";

import { requestIdMiddleware, fail, ok } from "./lib/http";
import { registerFunnelRoutes } from "./routes/v1/funnel";
import { registerCaseRoutes } from "./routes/v1/cases";
import { registerRefundRoutes } from "./routes/v1/refunds";
import { registerApprovalRoutes } from "./routes/v1/approvals";
import { registerQuoteRoutes } from "./routes/v1/quotes";
import { registerDevRoutes } from "./routes/v1/dev";
import { registerPaymentRoutes } from "./routes/v1/payments";
import { registerPartnerRoutes } from "./routes/v1/partner";
import { registerDocumentRoutes } from "./routes/v1/documents";
import { registerSettlementRoutes } from "./routes/v1/settlements";
import { registerPayablesRoutes } from "./routes/v1/payables";
import { registerWorkflowRoutes } from "./routes/v1/workflow";
import { registerTaskRoutes } from "./routes/v1/tasks";
import { registerFilingRoutes } from "./routes/v1/filing";
import { registerReportRoutes } from "./routes/v1/reports";
import { registerPackageRoutes } from "./routes/v1/packages";
import { registerFormRoutes } from "./routes/v1/forms";
import { registerOpsIncidentRoutes } from "./routes/v1/ops_incidents";
import { registerOpsReleaseRoutes } from "./routes/v1/ops_release";
import { registerOpsRetentionRoutes } from "./routes/v1/ops_retention";
import { processRetryJobs } from "./lib/ops_retry_worker";
import { processOpsAlertJobs } from "./lib/ops_alert_worker";
import { processOpsIncidents, generateWeeklyIncidentSummary } from "./lib/ops_incident_worker";
import { executeDataRetention } from "./lib/ops_retention";

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(requestIdMiddleware);
// 웹훅 서명 검증을 위해 rawBody를 보관한다.
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    }
  })
);

// v1 routes
registerFunnelRoutes(app, admin);
registerCaseRoutes(app, admin);
registerRefundRoutes(app, admin);
registerApprovalRoutes(app, admin);
registerQuoteRoutes(app, admin);
registerPaymentRoutes(app, admin);
registerPartnerRoutes(app, admin);
registerDocumentRoutes(app, admin);
registerSettlementRoutes(app, admin);
registerPayablesRoutes(app, admin);
registerWorkflowRoutes(app, admin);
registerTaskRoutes(app, admin);
registerFilingRoutes(app, admin);
registerReportRoutes(app, admin);
registerPackageRoutes(app, admin);
registerFormRoutes(app, admin);
registerDevRoutes(app, admin);
registerOpsIncidentRoutes(app, admin);
registerOpsReleaseRoutes(app, admin);
registerOpsRetentionRoutes(app, admin);

app.get("/health", async (_req, res) => ok(res, { status: "ok" }));
app.use((_req, res) => fail(res, 404, "NOT_FOUND", "존재하지 않는 엔드포인트입니다."));

export const api = functions.region("asia-northeast3").https.onRequest(app);

// Ops 재시도 워커 (5분마다 실행)
export const opsRetryWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 5 minutes")
  .onRun(async () => {
    try {
      await processRetryJobs(admin);
    } catch (e) {
      console.error("[OpsRetryWorker] Fatal error:", e);
    }
  });

export const opsAlertWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 1 minutes")
  .onRun(async () => {
    try {
      await processOpsAlertJobs(admin);
    } catch (e) {
      console.error("[OpsAlertWorker] Fatal error:", e);
    }
  });

export const opsIncidentWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 5 minutes")
  .onRun(async () => {
    try {
      await processOpsIncidents(admin);
    } catch (e) {
      console.error("[OpsIncidentWorker] Fatal error:", e);
    }
  });

export const opsWeeklySummaryWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("0 9 * * 1") // 매주 월요일 오전 9시 (KST/UTC 고려 필요)
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    try {
      await generateWeeklyIncidentSummary(admin);
    } catch (e) {
      console.error("[OpsWeeklySummaryWorker] Fatal error:", e);
    }
  });

export const opsRetentionWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("10 3 * * *") // 매일 03:10 (Asia/Seoul)
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    try {
      const dryRun = process.env.OPS_RETENTION_DRY_RUN === "1";
      await executeDataRetention(admin, "system_worker", dryRun);
    } catch (e) {
      console.error("[OpsRetentionWorker] Fatal error:", e);
    }
  });
