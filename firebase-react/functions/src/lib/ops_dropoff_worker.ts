import * as admin from "firebase-admin";
import { enqueueNotification } from "./notify_trigger";

/**
 * [EP-12-03] 진행 정체 구간(Drop-off) 자동 감지 및 리마인드 자동 트리거
 * - 주기적으로 (예: 매시간) 실행되어 사용자 이탈을 감지합니다.
 * - 진단 중단 (Funnel Drop-off): 1시간 이상 업데이트가 없는 diagnosing 세션
 * - 견적 대기 이탈 (Quote Drop-off): 24시간 이상 draft 상태인 케이스 연동 submission
 */
export async function processDropoffReminders(adminApp: typeof admin) {
  const db = adminApp.firestore();
  
  // 1. Funnel Drop-off (1시간 이상 지연된 diagnosing 세션)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const funnelSnap = await db.collection("funnel_sessions")
    .where("status", "==", "diagnosing")
    .where("updatedAt", "<=", admin.firestore.Timestamp.fromDate(oneHourAgo))
    .where("reminded", "!=", true)
    .limit(100)
    .get();

  const batches: admin.firestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let opCount = 0;

  for (const doc of funnelSnap.docs) {
    const data = doc.data();
    if (data.userId) {
      // 회원인 경우에만 알림 발송 가능
      await enqueueNotification(adminApp, { userId: data.userId }, "funnel.dropoff", {
        sessionId: doc.id,
        intent: data.intent
      });
    }

    currentBatch.update(doc.ref, {
      reminded: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    opCount++;
    if (opCount === 490) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      opCount = 0;
    }
  }

  // 2. Submission Drop-off (24시간 이상 draft 상태인 submission)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const subSnap = await db.collection("user_submissions")
    .where("status", "==", "draft")
    .where("updatedAt", "<=", admin.firestore.Timestamp.fromDate(twentyFourHoursAgo))
    .where("reminded", "!=", true)
    .limit(100)
    .get();

  for (const doc of subSnap.docs) {
    const data = doc.data();
    if (data.userId) {
      await enqueueNotification(adminApp, { userId: data.userId }, "submission.dropoff", {
        submissionId: doc.id,
        type: data.input?.type || "알 수 없음"
      });
    }

    currentBatch.update(doc.ref, {
      reminded: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    opCount++;
    if (opCount === 490) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    batches.push(currentBatch);
  }

  await Promise.all(batches.map(b => b.commit()));
}
