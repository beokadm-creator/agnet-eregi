import * as admin from "firebase-admin";
import { CaseEvidence } from "./partner_models";

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