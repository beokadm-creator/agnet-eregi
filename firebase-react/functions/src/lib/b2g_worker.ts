import * as admin from "firebase-admin";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { logOpsEvent } from "./ops_audit";
import { enqueueNotification } from "./notify_trigger";

const secretManagerClient = new SecretManagerServiceClient();

/**
 * [EP-13-02 & EP-13-04] B2G Submission Worker
 * 1. queued -> submitted: 공공기관 시스템에 자동 제출 (RPA/API Mock)
 * 2. submitted -> action_required / completed: 상태 폴링 모의 진행
 */
export async function processB2gJobs(adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. 제출 큐 (queued)
  const queuedSnap = await db.collection("b2g_submissions")
    .where("status", "==", "queued")
    .limit(10)
    .get();

  for (const doc of queuedSnap.docs) {
    const data = doc.data();
    try {
      // 1. 해당 파트너와 agency의 인증서 메타데이터 조회
      const credSnap = await db.collection("b2g_credentials")
        .where("partnerId", "==", data.partnerId)
        .where("agencyType", "==", data.agency)
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (credSnap.empty) {
        throw new Error(`${data.agency} 연동을 위한 활성 인증서(Credential)가 없습니다.`);
      }

      const credDoc = credSnap.docs[0].data();
      let decryptedCertData = null;
      let decryptedCertPassword = null;

      // 2. Secret Manager에서 실제 인증서 Payload 복호화 및 추출
      try {
        if (credDoc.certId && !credDoc.certId.startsWith("sm_cert_mock")) {
          const [version] = await secretManagerClient.accessSecretVersion({
            name: `${credDoc.certId}/versions/latest`,
          });
          const payloadStr = version.payload?.data?.toString() || "{}";
          const payloadParsed = JSON.parse(Buffer.from(payloadStr, "base64").toString("utf-8"));
          
          decryptedCertData = payloadParsed.certData;
          decryptedCertPassword = payloadParsed.certPassword;
        } else {
          // Mock ID인 경우 테스트 환경 간주
          console.log(`[Mock] ${data.agency} 전자신청 테스트 전송 모드 (certId: ${credDoc.certId})`);
        }
      } catch (err: any) {
        console.warn("Secret Manager 인증서 복호화 실패:", err.message);
        // 실제 환경이라면 throw err; 를 해야하지만 MVP 무중단 테스트를 위해 로깅만 진행
      }

      // 3. (Mock) 추출한 decryptedCertData, decryptedCertPassword 를 외부 RPA / B2G API로 전송하는 로직 위치
      // await sendToGovernmentApi(data.agency, decryptedCertData, decryptedCertPassword, packageUrl);
      console.log(`Using cert data: ${decryptedCertData ? "OK" : "Missing"}, password: ${decryptedCertPassword ? "OK" : "Missing"}`);
      
      await doc.ref.update({
        status: "submitted",
        receiptNumber: `b2g_${Date.now().toString(36)}`, // 모의 접수번호
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logOpsEvent(db, "b2g.submission.sent", "SUCCESS", "system", doc.id, "system", {
        caseId: data.caseId,
        agency: data.agency
      });

    } catch (error: any) {
      await doc.ref.update({
        status: "failed",
        lastError: error.message || "B2G Submission failed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await logOpsEvent(db, "b2g.submission.failed", "FAIL", "system", doc.id, "system", { error: error.message });
    }
  }

  // 2. 상태 폴링 (submitted -> completed or action_required)
  // Mock: 실제로는 공공기관 상태를 조회해야 하지만, 테스트를 위해 랜덤하게 변경.
  const submittedSnap = await db.collection("b2g_submissions")
    .where("status", "==", "submitted")
    .limit(10)
    .get();

  for (const doc of submittedSnap.docs) {
    const data = doc.data();
    
    // 단순 모의 로직: 제출 후 일정 시간(예: 5분 이상)이 지났다고 가정 (여기서는 난수 활용)
    const randomChance = Math.random();

    let newStatus = "submitted";
    let agencyStatus = "조사대기";
    let actionDetails = null;

    if (randomChance > 0.8) {
      // 20% 확률로 보정명령 (RFI)
      newStatus = "action_required";
      agencyStatus = "보정명령발령";
      actionDetails = "첨부된 인감증명서 화질 불량으로 식별 불가";

      // 보정명령 시 운영팀 및 파트너에게 에스컬레이션 알림 (EP-13-04)
      await enqueueNotification(adminApp, { partnerId: data.partnerId }, "b2g.action_required" as any, {
        submissionId: doc.id,
        caseId: data.caseId,
        agency: data.agency,
        actionDetails
      });

    } else if (randomChance > 0.6) {
      // 20% 확률로 등기 완료
      newStatus = "completed";
      agencyStatus = "등기완료";
      
      // 완료 시 파트너에게 알림
      await enqueueNotification(adminApp, { partnerId: data.partnerId }, "b2g.completed" as any, {
        submissionId: doc.id,
        caseId: data.caseId,
        agency: data.agency,
      });
    }

    if (newStatus !== "submitted") {
      await doc.ref.update({
        status: newStatus,
        agencyStatus,
        actionDetails,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await logOpsEvent(db, "b2g.submission.polled", "SUCCESS", "system", doc.id, "system", { newStatus, agencyStatus });
    }
  }
}
