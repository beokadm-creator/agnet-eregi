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
        message: "제출물 검증 및 처리를 시작합니다.",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      // 실제로는 외부 API를 호출하거나 복잡한 렌더링/PDF 생성/심사 시스템 연동을 수행합니다.
      // MVP에서는 2초 대기 후 임의 결과(성공/실패)를 생성하여 시뮬레이션합니다.
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 중간에 사용자가 취소(cancel_requested)했는지 확인
      const currentSnap = await doc.ref.get();
      if (currentSnap.data()?.status === "cancel_requested") {
        const cBatch = db.batch();
        cBatch.update(doc.ref, {
          status: "cancelled",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        const cEventRef = db.collection("submission_events").doc();
        cBatch.set(cEventRef, {
          submissionId: subId,
          userId,
          type: "cancelled",
          message: "사용자 요청에 의해 처리가 취소되었습니다.",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await cBatch.commit();
        console.log(`[UserSubmissionWorker] Submission ${subId} cancelled during processing.`);
        continue;
      }

      // 진행 상태 기록 (Progress)
      await db.collection("submission_events").doc().set({
        submissionId: subId,
        userId,
        type: "processing_progress",
        message: "데이터 분석 중...",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // 임의로 10% 확률로 실패
      if (Math.random() < 0.1) {
        throw new Error("데이터 형식이 올바르지 않습니다 (시뮬레이션 에러)");
      }

      // 파트너 연동 (가짜 Case 생성)
      // 실제로는 파트너 측에 Case를 생성하고 caseId를 받아와야 하지만 MVP에서는 가상의 caseId 부여
      const fakeCaseId = `case_${Date.now()}`;
      
      const successBatch = db.batch();
      successBatch.update(doc.ref, {
        status: "completed",
        caseId: fakeCaseId,
        result: {
          summary: "정상적으로 심사가 접수되었습니다.",
          artifactUrl: "https://storage.googleapis.com/fake/result.pdf"
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const successEventRef = db.collection("submission_events").doc();
      successBatch.set(successEventRef, {
        submissionId: subId,
        userId,
        type: "completed",
        message: "처리가 완료되었습니다. 파트너에게 전달되었습니다.",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await successBatch.commit();
      console.log(`[UserSubmissionWorker] Submission ${subId} completed successfully.`);

    } catch (error: any) {
      console.error(`[UserSubmissionWorker] Failed to process submission ${subId}:`, error);
      
      const failBatch = db.batch();
      failBatch.update(doc.ref, {
        status: "failed",
        result: {
          error: {
            category: "VALIDATION_ERROR",
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
}
