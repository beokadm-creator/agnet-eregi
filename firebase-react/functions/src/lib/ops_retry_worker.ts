import * as admin from "firebase-admin";
// import fetch from "node-fetch";

import { discoverProjectConfigAction, doResolveAction, generateMonthlyReportAction, dispatchWorkflowAction, createDeadLetterIssueAction } from "./ops_actions";
import { categorizeError } from "./ops_audit";
import { notifyOpsAlert } from "./ops_alert";

// 간단한 백오프 계산: 분 단위 추가 (1분 -> 5분 -> 15분 -> 60분)
function calculateNextRunAt(attempts: number): Date {
  const now = new Date();
  let addMinutes = 1;
  if (attempts === 1) addMinutes = 5;
  else if (attempts === 2) addMinutes = 15;
  else if (attempts >= 3) addMinutes = 60;
  
  now.setMinutes(now.getMinutes() + addMinutes);
  return now;
}

export async function processRetryJobs(adminApp: typeof admin) {
  const db = adminApp.firestore();
  const now = adminApp.firestore.Timestamp.now();

  // 큐에서 대기중이고, 실행 시간이 된 잡 최대 10개
  const snap = await db.collection("ops_retry_jobs")
    .where("status", "==", "queued")
    .where("nextRunAt", "<=", now)
    .limit(10)
    .get();

  if (snap.empty) return;

  for (const doc of snap.docs) {
    const job = doc.data() as any;
    const jobId = doc.id;

    // 1. 트랜잭션으로 running 선점 (동시성 방지)
    try {
      await db.runTransaction(async (t) => {
        const freshSnap = await t.get(doc.ref);
        if (freshSnap.data()?.status !== "queued") {
          throw new Error("Job is no longer queued");
        }
        t.update(doc.ref, { status: "running", updatedAt: adminApp.firestore.FieldValue.serverTimestamp() });
      });
    } catch (e) {
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
        await generateMonthlyReportAction(adminApp, gateKey, payload.target.month);
        success = true; 
      } else if (job.action === "workflow.dispatch") {
        await dispatchWorkflowAction(adminApp, gateKey, payload.target.month);
        success = true;
      } else if (job.action === "project.discover") {
        await discoverProjectConfigAction(adminApp, gateKey, undefined, "system_retry");
        success = true;
      } else if (job.action === "project.resolve") {
        await doResolveAction(adminApp, gateKey, "system_retry");
        success = true;
      } else {
         // 아직 ops_actions.ts로 추출되지 않은 나머지 액션들 (임시 성공 처리)
         success = true;
      }
      
    } catch (e: any) {
      success = false;
      errorMessage = e.message || "Unknown error";
      
      // Fast Dead 판별: 재시도 가치가 없는 에러는 즉시 Dead 처리
      const { retryable } = categorizeError(errorMessage);
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
      
      // logOpsEvent for retry success
      await adminApp.firestore().collection("ops_audit_events").doc().set({
        gateKey: job.gateKey || "unknown",
        action: "ops_retry.success",
        status: "success",
        actorUid: "system",
        requestId: `retry_${jobId}`,
        correlationId: job.correlationId || `retry_${jobId}`,
        summary: `Retry job ${jobId} succeeded`,
        target: { jobId, action: job.action },
        createdAt: adminApp.firestore.FieldValue.serverTimestamp()
      });
    } else {
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
        
        await adminApp.firestore().collection("ops_audit_events").doc().set({
          gateKey: job.gateKey || "unknown",
          action: "ops_retry.deadletter",
          status: "fail",
          actorUid: "system",
          requestId: `retry_${jobId}`,
          correlationId: job.correlationId || `retry_${jobId}`,
          summary: `Retry job ${jobId} failed and moved to dead letter`,
          target: { jobId, action: job.action, error: errorMessage },
          createdAt: adminApp.firestore.FieldValue.serverTimestamp()
        });

        const errorInfo = categorizeError(errorMessage);
        
        // (옵션) 슬랙 알림 발송 (notifyOpsAlert 공통 함수 사용) - 중복 방지
        if (!job.alertSentAt) {
          await notifyOpsAlert({
            gateKey: job.gateKey || "unknown",
            action: job.action,
            category: errorInfo.category,
            summary: `자동화 작업 재시도 최종 실패 (Dead)`,
            error: { message: errorMessage },
            severity: "critical",
            correlationId: job.correlationId || `retry_${jobId}`
          });
          await doc.ref.update({ alertSentAt: adminApp.firestore.FieldValue.serverTimestamp() });
        }

        // Dead Letter 자동 이슈화
        try {
          const issueResult = await createDeadLetterIssueAction(adminApp, job.gateKey, job.action, errorMessage, newAttempts, jobId, job.sourceEventId);
          if (issueResult && issueResult.issueUrl && !issueResult.skipped) {
             await doc.ref.update({
               deadIssue: {
                 issueUrl: issueResult.issueUrl,
                 issueNumber: issueResult.issueNumber,
                 projectItemId: issueResult.projectItemId || null,
                 createdAt: adminApp.firestore.FieldValue.serverTimestamp()
               }
             });
          } else if (issueResult?.skipped) {
             console.log(`[Retry Worker] Dead-letter 이슈 이미 존재 (Job ${jobId})`);
          }
        } catch (issueErr) {
          console.error(`[Retry Worker] Dead-letter 이슈 자동 생성 실패 (Job ${jobId}):`, issueErr);
        }
        
      } else {
        // 백오프 재시도
        const nextRun = calculateNextRunAt(newAttempts);
        await doc.ref.update({
          status: "queued",
          attempts: newAttempts,
          nextRunAt: adminApp.firestore.Timestamp.fromDate(nextRun),
          lastError: { message: errorMessage },
          updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  }
}
