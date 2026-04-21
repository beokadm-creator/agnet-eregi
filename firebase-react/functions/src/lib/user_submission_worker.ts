import * as admin from "firebase-admin";

export async function processUserSubmissions(adminApp: typeof admin) {
  const db = adminApp.firestore();

  // "submitted" 상태인 제출물을 찾아 "processing"으로 변경
  const submittedSnap = await db.collection("user_submissions")
    .where("status", "==", "submitted")
    .limit(10)
    .get();

  for (const doc of submittedSnap.docs) {
    const sub = doc.data();
    const subId = doc.id;
    const userId = sub.userId;

    try {
      const batch = db.batch();
      
      // 상태 변경
      batch.update(doc.ref, {
        status: "processing",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 이벤트 기록
      const eventRef1 = db.collection("submission_events").doc();
      batch.set(eventRef1, {
        submissionId: subId,
        userId,
        type: "processing_started",
        message: "제출물 검증 및 파트너 케이스 생성을 시작합니다.",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 1. 파트너 케이스 생성 여부 확인 및 생성
      let caseId = sub.caseId;
      if (!caseId) {
        const caseRef = db.collection("cases").doc();
        caseId = caseRef.id;
        
        batch.set(caseRef, {
          partnerId: sub.partnerId,
          status: "draft",
          title: `User Submission - ${sub.input.type} (${subId.substring(0,6)})`,
          submissionId: subId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        batch.update(doc.ref, { caseId });
      }

      // 2. 파트너 패키지 생성 요청
      let packageId = sub.packageId;
      if (!packageId) {
        const pkgRef = db.collection("packages").doc();
        packageId = pkgRef.id;
        
        batch.set(pkgRef, {
          caseId,
          partnerId: sub.partnerId,
          status: "queued",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // 케이스 상태를 packaging으로 업데이트
        const caseRef = db.collection("cases").doc(caseId);
        batch.update(caseRef, {
          status: "packaging",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        batch.update(doc.ref, { packageId });
      }

      await batch.commit();

      // processing으로 유지하며 다음 단계(폴링)를 대기
      console.log(`[UserSubmissionWorker] Submission ${subId} triggered case ${caseId} and package ${packageId}.`);

    } catch (error: any) {
      console.error(`[UserSubmissionWorker] Failed to process submission ${subId}:`, error);
      
      const failBatch = db.batch();
      failBatch.update(doc.ref, {
        status: "failed",
        result: {
          error: {
            category: "INTEGRATION_ERROR",
            message: error.message || String(error)
          }
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const failEventRef = db.collection("submission_events").doc();
      failBatch.set(failEventRef, {
        submissionId: subId,
        userId,
        type: "failed",
        message: `처리 중 오류가 발생했습니다: ${error.message}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await failBatch.commit();
    }
  }

  // "processing" 상태인 제출물을 찾아 파트너 패키지 상태를 폴링
  const processingSnap = await db.collection("user_submissions")
    .where("status", "==", "processing")
    .limit(10)
    .get();

  for (const doc of processingSnap.docs) {
    const sub = doc.data();
    const subId = doc.id;
    const userId = sub.userId;

    if (!sub.packageId) continue;

    try {
      const pkgSnap = await db.collection("packages").doc(sub.packageId).get();
      if (!pkgSnap.exists) continue;

      const pkgStatus = pkgSnap.data()?.status;

      if (pkgStatus === "ready") {
        const batch = db.batch();
        batch.update(doc.ref, {
          status: "completed",
          result: {
            summary: "정상적으로 파트너 심사/패키징이 완료되었습니다."
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const eventRef = db.collection("submission_events").doc();
        batch.set(eventRef, {
          submissionId: subId,
          userId,
          type: "completed",
          message: "처리가 완료되어 패키지 다운로드가 가능합니다.",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        console.log(`[UserSubmissionWorker] Submission ${subId} completed (linked to package ${sub.packageId}).`);

      } else if (pkgStatus === "failed") {
        const batch = db.batch();
        batch.update(doc.ref, {
          status: "failed",
          result: {
            error: pkgSnap.data()?.error || { category: "PARTNER_BUILD_ERROR", message: "패키지 생성 실패" }
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const eventRef = db.collection("submission_events").doc();
        batch.set(eventRef, {
          submissionId: subId,
          userId,
          type: "failed",
          message: "파트너 시스템에서 패키지 생성 중 오류가 발생했습니다.",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        console.log(`[UserSubmissionWorker] Submission ${subId} failed (linked to package ${sub.packageId}).`);
      }
    } catch (error: any) {
      console.error(`[UserSubmissionWorker] Failed to poll package for submission ${subId}:`, error);
    }
  }
}
