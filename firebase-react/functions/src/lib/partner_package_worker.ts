import * as admin from "firebase-admin";

export async function processPackageBuilds(adminApp: typeof admin) {
  const db = adminApp.firestore();

  // "queued" 상태의 패키지를 찾아서 "building"으로 변경
  const queuedPackagesSnap = await db.collection("packages")
    .where("status", "==", "queued")
    .limit(10)
    .get();

  if (queuedPackagesSnap.empty) {
    return;
  }

  for (const doc of queuedPackagesSnap.docs) {
    const pkg = doc.data();
    const packageId = doc.id;
    const caseId = pkg.caseId;

    try {
      // 상태를 building으로 업데이트
      await doc.ref.update({
        status: "building",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 여기에서 실제로는 Storage에 있는 Evidence 파일들을 모아 압축(Zip)하거나
      // 메타데이터를 취합하여 PDF로 변환하는 등 긴 작업(Build)을 수행해야 합니다.
      // MVP에서는 3초 대기 후 가짜 artifactUrl을 생성하는 것으로 시뮬레이션.
      
      await new Promise((resolve) => setTimeout(resolve, 3000));
      
      // 임의 실패 시뮬레이션 (10% 확률로 실패)
      if (Math.random() < 0.1) {
        throw new Error("Temporary network error during zip compression");
      }

      const dummyArtifactUrl = `https://storage.googleapis.com/fake-bucket/packages/${caseId}/${packageId}.zip`;

      const batch = db.batch();
      
      // 패키지 상태를 ready로
      batch.update(doc.ref, {
        status: "ready",
        artifactUrl: dummyArtifactUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 케이스 상태를 ready로
      const caseRef = db.collection("cases").doc(caseId);
      batch.update(caseRef, {
        status: "ready",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();
      console.log(`[PackageBuilder] Package ${packageId} built successfully.`);

    } catch (error: any) {
      console.error(`[PackageBuilder] Failed to build package ${packageId}:`, error);
      
      const batch = db.batch();
      
      // 패키지 상태를 failed로
      batch.update(doc.ref, {
        status: "failed",
        error: {
          category: "BUILD_ERROR",
          message: error.message || String(error)
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 케이스 상태를 failed로
      const caseRef = db.collection("cases").doc(caseId);
      batch.update(caseRef, {
        status: "failed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();
    }
  }
}
