import * as admin from "firebase-admin";
import { CaseEvidence } from "./partner_models";
import { enqueueNotification } from "./notify_trigger";

export async function processEvidenceValidation(adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 상태가 "uploaded"인 증거물 찾기
  const snap = await db.collection("evidences")
    .where("status", "==", "uploaded")
    .limit(10)
    .get();

  for (const doc of snap.docs) {
    const ev = doc.data() as CaseEvidence;
    const evidenceId = doc.id;

    try {
      if (!ev.storagePath) {
        throw new Error("storagePath가 없습니다.");
      }

      // Storage 파일 메타데이터 확인
      const bucket = adminApp.storage().bucket();
      const file = bucket.file(ev.storagePath);
      const [exists] = await file.exists();

      if (!exists) {
        throw new Error("스토리지에 파일이 존재하지 않습니다.");
      }

      const [metadata] = await file.getMetadata();

      // 확장자/MIME 검증
      const contentType = metadata.contentType || "";
      const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
      
      if (!allowedTypes.includes(contentType)) {
        throw new Error(`허용되지 않는 파일 형식입니다: ${contentType}`);
      }

      // 크기 검증 (25MB 제한)
      const sizeBytes = Number(metadata.size) || 0;
      if (sizeBytes > 25 * 1024 * 1024) {
        throw new Error(`파일이 너무 큽니다: ${sizeBytes} bytes`);
      }

      // (옵션) Virus Scan 시뮬레이션
      // 실제로는 Cloud Run 또는 외부 API를 통해 검사
      const scanStatus = Math.random() < 0.05 ? "infected" : "clean"; // 5% 확률로 악성코드 시뮬레이션
      
      if (scanStatus === "infected") {
        throw new Error("악성 코드가 감지되었습니다.");
      }

      // 검증 통과 -> 상태 변경
      await doc.ref.update({
        status: "validated",
        scanStatus,
        contentType,
        sizeBytes,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`[EvidenceValidation] Evidence ${evidenceId} validated successfully.`);

      // Evidence Request 충족 처리
      if (ev.requestId && ev.itemCode) {
        const reqRef = db.collection("evidence_requests").doc(ev.requestId);
        
        await db.runTransaction(async (transaction) => {
          const reqSnap = await transaction.get(reqRef);
          if (!reqSnap.exists) return;

          const reqData = reqSnap.data() as any;
          if (reqData.status !== "open") return;

          const items = reqData.items || [];
          const itemIndex = items.findIndex((i: any) => i.code === ev.itemCode);
          
          if (itemIndex === -1) return;

          // 해당 아이템 fulfilled 처리
          items[itemIndex].status = "fulfilled";
          items[itemIndex].evidenceId = evidenceId;
          items[itemIndex].fulfilledAt = admin.firestore.FieldValue.serverTimestamp();

          // 모든 required 아이템이 fulfilled인지 확인
          const allRequiredFulfilled = items
            .filter((i: any) => i.required)
            .every((i: any) => i.status === "fulfilled");

          const updateData: any = {
            items,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };

          let isFullyFulfilled = false;
          if (allRequiredFulfilled) {
            updateData.status = "fulfilled";
            updateData.fulfilledAt = admin.firestore.FieldValue.serverTimestamp();
            isFullyFulfilled = true;
          }

          transaction.update(reqRef, updateData);

          if (isFullyFulfilled) {
            // 패키지 자동 재생성 트리거를 위해 packages 조회
            const packagesSnap = await transaction.get(
              db.collection("packages")
                .where("caseId", "==", ev.caseId)
                .orderBy("createdAt", "desc")
                .limit(1)
            );

            if (!packagesSnap.empty) {
              const latestPkgRef = packagesSnap.docs[0].ref;
              transaction.update(latestPkgRef, {
                status: "queued",
                error: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            }

            // 알림 발송은 트랜잭션 성공 후 (임시로 enqueue를 트랜잭션 밖에서 처리)
            // Firebase Functions의 runTransaction은 Promise 반환하므로 체이닝 가능
          }
        }).then(async () => {
          const updatedReqSnap = await reqRef.get();
          if (updatedReqSnap.exists && updatedReqSnap.data()?.status === "fulfilled") {
            await enqueueNotification(adminApp, { partnerId: ev.partnerId }, "evidence.fulfilled", {
              caseId: ev.caseId,
              requestId: ev.requestId,
              evidenceId
            });
          }
        }).catch(err => {
          console.error(`[EvidenceValidation] Transaction failed for request ${ev.requestId}:`, err);
        });
      }

    } catch (error: any) {
      console.error(`[EvidenceValidation] Evidence ${evidenceId} validation failed:`, error);
      
      // 검증 실패 -> 상태 변경
      await doc.ref.update({
        status: "failed",
        scanStatus: error.message.includes("악성 코드") ? "infected" : "unknown",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }
}