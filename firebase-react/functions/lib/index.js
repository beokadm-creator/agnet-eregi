"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.opsRetryWorker = exports.api = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const http_1 = require("./lib/http");
const funnel_1 = require("./routes/v1/funnel");
const cases_1 = require("./routes/v1/cases");
const refunds_1 = require("./routes/v1/refunds");
const approvals_1 = require("./routes/v1/approvals");
const quotes_1 = require("./routes/v1/quotes");
const dev_1 = require("./routes/v1/dev");
const payments_1 = require("./routes/v1/payments");
const partner_1 = require("./routes/v1/partner");
const documents_1 = require("./routes/v1/documents");
const settlements_1 = require("./routes/v1/settlements");
const payables_1 = require("./routes/v1/payables");
const workflow_1 = require("./routes/v1/workflow");
const tasks_1 = require("./routes/v1/tasks");
const filing_1 = require("./routes/v1/filing");
const reports_1 = require("./routes/v1/reports");
const packages_1 = require("./routes/v1/packages");
const forms_1 = require("./routes/v1/forms");
const ops_retry_worker_1 = require("./lib/ops_retry_worker");
admin.initializeApp();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(http_1.requestIdMiddleware);
// 웹훅 서명 검증을 위해 rawBody를 보관한다.
app.use(express_1.default.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    }
}));
// v1 routes
(0, funnel_1.registerFunnelRoutes)(app, admin);
(0, cases_1.registerCaseRoutes)(app, admin);
(0, refunds_1.registerRefundRoutes)(app, admin);
(0, approvals_1.registerApprovalRoutes)(app, admin);
(0, quotes_1.registerQuoteRoutes)(app, admin);
(0, payments_1.registerPaymentRoutes)(app, admin);
(0, partner_1.registerPartnerRoutes)(app, admin);
(0, documents_1.registerDocumentRoutes)(app, admin);
(0, settlements_1.registerSettlementRoutes)(app, admin);
(0, payables_1.registerPayablesRoutes)(app, admin);
(0, workflow_1.registerWorkflowRoutes)(app, admin);
(0, tasks_1.registerTaskRoutes)(app, admin);
(0, filing_1.registerFilingRoutes)(app, admin);
(0, reports_1.registerReportRoutes)(app, admin);
(0, packages_1.registerPackageRoutes)(app, admin);
(0, forms_1.registerFormRoutes)(app, admin);
(0, dev_1.registerDevRoutes)(app, admin);
app.get("/health", async (_req, res) => (0, http_1.ok)(res, { status: "ok" }));
app.use((_req, res) => (0, http_1.fail)(res, 404, "NOT_FOUND", "존재하지 않는 엔드포인트입니다."));
exports.api = functions.region("asia-northeast3").https.onRequest(app);
// Ops 재시도 워커 (5분마다 실행)
exports.opsRetryWorker = functions
    .region("asia-northeast3")
    .pubsub.schedule("every 5 minutes")
    .onRun(async () => {
    try {
        await (0, ops_retry_worker_1.processRetryJobs)(admin);
    }
    catch (e) {
        console.error("[OpsRetryWorker] Fatal error:", e);
    }
});
//# sourceMappingURL=index.js.map