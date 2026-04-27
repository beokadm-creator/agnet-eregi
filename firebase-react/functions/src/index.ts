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
import { registerOpsObservabilityRoutes } from "./routes/v1/ops_observability";
import { registerOpsSloRoutes } from "./routes/v1/ops_slo";
import { registerOpsAccessRoutes } from "./routes/v1/ops_access";
import { registerOpsBackupRoutes } from "./routes/v1/ops_backup";
import { registerOpsQueryHealthRoutes } from "./routes/v1/ops_query_health";
import { registerPartnerCaseRoutes } from "./routes/v1/partner_cases";
import { registerUserSubmissionRoutes } from "./routes/v1/user_submissions";
import { registerNotificationSettingsRoutes } from "./routes/v1/notify_settings";
import { registerStripeWebhookRoutes } from "./routes/v1/stripe_webhooks";
import { registerOpsSettingsRoutes } from "./routes/v1/ops_settings";
import { registerMonitoringWebhookRoutes } from "./routes/v1/monitoring_webhooks";
import { registerTossPaymentsWebhookRoutes } from "./routes/v1/tosspayments_webhooks";
import { registerAdRoutes } from "./routes/v1/ads";
import { registerSubscriptionRoutes } from "./routes/v1/subscriptions";
import { registerCasePackRoutes } from "./routes/v1/case_packs";
import { registerOpsCasePackRoutes } from "./routes/v1/ops_case_packs";
import { registerPartnerTeamRoutes } from "./routes/v1/partner_team";
import { registerOpsRiskRoutes } from "./routes/v1/ops_risk";
import { registerChatbotRoutes } from "./routes/v1/chatbot";
import { registerOpsPredictionRoutes } from "./routes/v1/ops_prediction";

import { processRetryJobs } from "./lib/ops_retry_worker";
import { processOpsAlertJobs } from "./lib/ops_alert_worker";
import { processOpsIncidents, generateWeeklyIncidentSummary } from "./lib/ops_incident_worker";
import { executeDataRetention } from "./lib/ops_retention";
import { processOpsMetricsDaily } from "./lib/ops_metrics_worker";
import { processAlertQualityDaily } from "./lib/ops_alert_quality_worker";
import { processWeeklyOpsReview } from "./lib/ops_weekly_review_worker";
import { processSloBurnRateDaily } from "./lib/ops_slo_worker";
import { processBreakglassExpiry } from "./lib/ops_access_worker";
import { processFirestoreBackup } from "./lib/ops_backup_worker";
import { processPackageBuilds } from "./lib/partner_package_worker";
import { processUserSubmissions } from "./lib/user_submission_worker";
import { processEvidenceValidation } from "./lib/partner_evidence_worker";
import { processNotificationJobs } from "./lib/notify_worker";

import { executeAdBillingDailyBatch } from "./lib/ad_billing_worker";
import { executeSettlementBatch } from "./lib/settlement_batch_worker";
import { executeSubscriptionBillingBatch } from "./lib/subscription_worker";
import { processOpsTickets } from "./lib/ops_ticket_worker";
import { processPartnerRankings } from "./lib/ops_ranking_worker";
import { processDocumentAI } from "./lib/document_ai_worker";
import { processOpsPrediction } from "./lib/ops_prediction_worker";
import { processDropoffReminders } from "./lib/ops_dropoff_worker";
import { registerAuthRoutes } from "./routes/v1/auth_routes";
import { registerB2gRoutes } from "./routes/v1/b2g";
import { registerB2bRoutes } from "./routes/v1/b2b";
import { registerTranslationRoutes } from "./routes/v1/translation";
import { registerApostilleRoutes } from "./routes/v1/apostille";
import { processB2gJobs } from "./lib/b2g_worker";
import { processB2gFeeParsing, processB2gFeePayments } from "./lib/b2g_fee_worker";
import { processB2bWebhooks } from "./lib/b2b_webhook_worker";

admin.initializeApp();

const app = express();
if (process.env.OPS_ALLOW_ALL === "1" && process.env.FUNCTIONS_EMULATOR !== "true") {
  throw new Error("OPS_ALLOW_ALL cannot be enabled outside Functions emulator");
}

const corsAllowAny = process.env.FUNCTIONS_EMULATOR === "true" || process.env.CORS_ALLOW_ANY === "1";
const corsAllowlist = (process.env.CORS_ALLOWLIST || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsAllowAny) return callback(null, true);
    if (corsAllowlist.includes(origin)) return callback(null, true);
    return callback(null, false);
  }
}));
app.use(requestIdMiddleware);
// stripe webhook uses raw body, so we register it before express.json()
app.post(
  "/v1/webhooks/stripe",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    (req as any).rawBody = req.body;
    next();
  }
);

app.use(
  express.json({
    limit: "2mb",
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
registerOpsObservabilityRoutes(app, admin);
registerOpsSloRoutes(app, admin);
registerOpsAccessRoutes(app, admin);
registerOpsBackupRoutes(app, admin);
registerOpsQueryHealthRoutes(app, admin);
registerPartnerCaseRoutes(app, admin);
registerUserSubmissionRoutes(app, admin);
registerNotificationSettingsRoutes(app, admin);
registerStripeWebhookRoutes(app, admin);
registerTossPaymentsWebhookRoutes(app, admin);
registerOpsSettingsRoutes(app, admin);
registerMonitoringWebhookRoutes(app, admin);
registerAdRoutes(app, admin);
registerSubscriptionRoutes(app, admin);
registerCasePackRoutes(app, admin);
registerOpsCasePackRoutes(app, admin);
registerPartnerTeamRoutes(app, admin);
registerOpsRiskRoutes(app, admin);
registerChatbotRoutes(app, admin);
registerOpsPredictionRoutes(app, admin);
registerAuthRoutes(app, admin);
registerB2gRoutes(app, admin);
registerB2bRoutes(app, admin);
registerTranslationRoutes(app, admin);
registerApostilleRoutes(app, admin);

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
      await processWeeklyOpsReview(admin);
    } catch (e) {
      console.error("[OpsWeeklySummaryWorker] Fatal error:", e);
    }
  });

export const opsMetricsWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("20 1 * * *") // 매일 01:20 (Asia/Seoul)
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    try {
      await processOpsMetricsDaily(admin);
    } catch (e) {
      console.error("[OpsMetricsWorker] Fatal error:", e);
    }
  });

export const adBillingBatchWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("10 0 * * *") // 매일 00:10
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    try {
      const today = new Date();
      today.setDate(today.getDate() - 1);
      const targetDateStr = today.toISOString().split("T")[0];
      await executeAdBillingDailyBatch(admin.firestore(), targetDateStr, "system_worker");
    } catch (e) {
      console.error("[AdBillingWorker] Fatal error:", e);
    }
  });

export const subscriptionBatchWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("0 1 * * *") // 매일 01:00
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    try {
      await executeSubscriptionBillingBatch(admin.firestore(), new Date());
    } catch (e) {
      console.error("[SubscriptionWorker] Fatal error:", e);
    }
  });

export const settlementBatchWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("0 3 1 * *") // 매월 1일 03:00
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    try {
      const periodEnd = new Date(); // roughly now
      await executeSettlementBatch(admin.firestore(), periodEnd, "system_worker");
    } catch (e) {
      console.error("[SettlementWorker] Fatal error:", e);
    }
  });

export const opsAlertQualityWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("30 1 * * *") // 매일 01:30 (Asia/Seoul)
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    try {
      await processAlertQualityDaily(admin);
    } catch (e) {
      console.error("[OpsAlertQualityWorker] Fatal error:", e);
    }
  });

export const opsSloWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("0 2 * * *") // 매일 02:00 (Asia/Seoul)
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    try {
      await processSloBurnRateDaily(admin);
    } catch (e) {
      console.error("[OpsSloWorker] Fatal error:", e);
    }
  });

export const opsBackupWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("0 4 * * 0") // 매주 일요일 새벽 4시
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    try {
      await processFirestoreBackup(admin);
    } catch (e) {
      console.error("[OpsBackupWorker] Fatal error:", e);
    }
  });

export const opsAccessWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 5 minutes") // 매 5분마다 만료된 Break-glass 회수
  .onRun(async () => {
    try {
      await processBreakglassExpiry(admin);
    } catch (e) {
      console.error("[OpsAccessWorker] Fatal error:", e);
    }
  });

export const partnerPackageWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 1 minutes")
  .onRun(async () => {
    try {
      await processPackageBuilds(admin);
    } catch (e) {
      console.error("[PartnerPackageWorker] Fatal error:", e);
    }
  });

export const partnerEvidenceWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 1 minutes")
  .onRun(async () => {
    try {
      await processEvidenceValidation(admin);
    } catch (e) {
      console.error("[PartnerEvidenceWorker] Fatal error:", e);
    }
  });

export const userSubmissionWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 1 minutes")
  .onRun(async () => {
    try {
      await processUserSubmissions(admin);
    } catch (e) {
      console.error("[UserSubmissionWorker] Fatal error:", e);
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

export const notifyWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 1 minutes")
  .onRun(async () => {
    try {
      await processNotificationJobs(admin);
    } catch (e) {
      console.error("[NotifyWorker] Fatal error:", e);
    }
  });

export const opsTicketWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 5 minutes")
  .onRun(async () => {
    try {
      await processOpsTickets(admin);
    } catch (e) {
      console.error("[OpsTicketWorker] Fatal error:", e);
    }
  });

export const opsRankingWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 1 hours")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    try {
      await processPartnerRankings(admin);
    } catch (e) {
      console.error("[OpsRankingWorker] Fatal error:", e);
    }
  });

// 스토리지 파일 업로드 완료 시 Document AI 워커 실행 (onFinalize)
export const documentAiStorageTrigger = functions
  .region("asia-northeast3")
  .storage.object()
  .onFinalize(async (object) => {
    try {
      await processDocumentAI(admin, object);
    } catch (e) {
      console.error("[DocumentAIStorageTrigger] Fatal error:", e);
    }
  });

export const opsPredictionBatchWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("0 4 * * *") // 매일 새벽 4시
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    try {
      await processOpsPrediction(admin);
    } catch (e) {
      console.error("[OpsPredictionWorker] Fatal error:", e);
    }
  });

export const opsDropoffWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("0 * * * *") // 매시 정각에 실행
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    try {
      await processDropoffReminders(admin);
    } catch (e) {
      console.error("[OpsDropoffWorker] Fatal error:", e);
    }
  });

export const b2gSubmissionWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 5 minutes") // 5분 주기
  .onRun(async () => {
    try {
      await processB2gJobs(admin);
    } catch (e) {
      console.error("[B2GWorker] Fatal error:", e);
    }
  });

export const b2gFeeWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 3 minutes") // 3분 주기
  .onRun(async () => {
    try {
      await processB2gFeeParsing(admin);
      await processB2gFeePayments(admin);
    } catch (e) {
      console.error("[B2GFeeWorker] Fatal error:", e);
    }
  });

// EP-14: B2B Open API Webhook 전송 워커
export const b2bWebhookWorker = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 1 minutes")
  .onRun(async () => {
    try {
      await processB2bWebhooks(admin);
    } catch (e) {
      console.error("[B2bWebhookWorker] Fatal error:", e);
    }
  });
