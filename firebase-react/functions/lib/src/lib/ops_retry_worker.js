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
exports.processRetryJobs = processRetryJobs;
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const ops_actions_1 = require("./ops_actions");
const ops_audit_1 = require("./ops_audit");
// 간단한 백오프 계산: 분 단위 추가 (1분 -> 5분 -> 15분 -> 60분)
function calculateNextRunAt(attempts) {
    const now = new Date();
    let addMinutes = 1;
    if (attempts === 1)
        addMinutes = 5;
    else if (attempts === 2)
        addMinutes = 15;
    else if (attempts >= 3)
        addMinutes = 60;
    now.setMinutes(now.getMinutes() + addMinutes);
    return now;
}
async function processRetryJobs(adminApp) {
    const db = adminApp.firestore();
    const now = adminApp.firestore.Timestamp.now();
    // 큐에서 대기중이고, 실행 시간이 된 잡 최대 10개
    const snap = await db.collection("ops_retry_jobs")
        .where("status", "==", "queued")
        .where("nextRunAt", "<=", now)
        .limit(10)
        .get();
    if (snap.empty)
        return;
    for (const doc of snap.docs) {
        const job = doc.data();
        const jobId = doc.id;
        // 1. 트랜잭션으로 running 선점 (동시성 방지)
        try {
            await db.runTransaction(async (t) => {
                var _a;
                const freshSnap = await t.get(doc.ref);
                if (((_a = freshSnap.data()) === null || _a === void 0 ? void 0 : _a.status) !== "queued") {
                    throw new Error("Job is no longer queued");
                }
                t.update(doc.ref, { status: "running", updatedAt: adminApp.firestore.FieldValue.serverTimestamp() });
            });
        }
        catch (e) {
            console.log(`[Retry Worker] Job ${jobId} skipped (already running or dead)`);
            continue;
        }
        // 2. 작업 실행
        let success = false;
        let errorMessage = "";
        try {
            // -- 비즈니스 로직 분리 (MVP용 간이 실행) --
            console.log(`[Retry Worker] Executing job ${jobId}, action: ${job.action}`);
            const payload = job.payload || {};
            const gateKey = payload.gateKey;
            // 실제 로직 연동
            if (job.action === "monthly.generate") {
                await (0, ops_actions_1.generateMonthlyReportAction)(adminApp, gateKey, payload.target.month);
                success = true;
            }
            else if (job.action === "workflow.dispatch") {
                await (0, ops_actions_1.dispatchWorkflowAction)(adminApp, gateKey, payload.target.month);
                success = true;
            }
            else if (job.action === "project.discover") {
                await (0, ops_actions_1.discoverProjectConfigAction)(adminApp, gateKey, undefined, "system_retry");
                success = true;
            }
            else if (job.action === "project.resolve") {
                await (0, ops_actions_1.doResolveAction)(adminApp, gateKey, "system_retry");
                success = true;
            }
            else {
                // 아직 ops_actions.ts로 추출되지 않은 나머지 액션들 (임시 성공 처리)
                success = true;
            }
        }
        catch (e) {
            success = false;
            errorMessage = e.message || "Unknown error";
            // Fast Dead 판별: 재시도 가치가 없는 에러는 즉시 Dead 처리
            const { retryable } = (0, ops_audit_1.categorizeError)(errorMessage);
            if (!retryable) {
                console.log(`[Retry Worker] Fast Dead due to non-retryable error category. Job ${jobId}`);
                job.maxAttempts = 0; // 즉시 Dead Letter Queue로 가도록 강제
            }
        }
        // 3. 결과 업데이트
        if (success) {
            await doc.ref.update({
                status: "success",
                updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
            });
        }
        else {
            const newAttempts = (job.attempts || 0) + 1;
            const maxAttempts = job.maxAttempts || 4;
            if (newAttempts >= maxAttempts) {
                // Dead Letter Queue
                await doc.ref.update({
                    status: "dead",
                    attempts: newAttempts,
                    lastError: { message: errorMessage },
                    updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
                });
                // (옵션) 슬랙 알림 발송
                const webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL;
                if (webhookUrl) {
                    try {
                        await (0, node_fetch_1.default)(webhookUrl, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                text: `🚨 [Ops Automation] 재시도 실패 알림 (Dead)\nAction: ${job.action}\nJobId: ${jobId}\nGateKey: ${job.gateKey}\nError: ${errorMessage}`
                            })
                        });
                    }
                    catch (e) {
                        console.error("[Retry Worker] Webhook send failed:", e);
                    }
                }
            }
            else {
                // 백오프 재시도
                const nextRun = calculateNextRunAt(newAttempts);
                await doc.ref.update({
                    status: "queued",
                    attempts: newAttempts,
                    nextRunAt: admin.firestore.Timestamp.fromDate(nextRun),
                    lastError: { message: errorMessage },
                    updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    }
}
//# sourceMappingURL=ops_retry_worker.js.map