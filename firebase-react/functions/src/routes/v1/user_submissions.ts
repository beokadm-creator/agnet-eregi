import * as express from "express";
import * as admin from "firebase-admin";

import { requireAuth } from "../../lib/auth";
import { fail, ok, logError } from "../../lib/http";
import { UserSubmission, SubmissionEvent } from "../../lib/user_models";

export function registerUserSubmissionRoutes(app: express.Application, adminApp: typeof admin) {

  // 1) POST /v1/user/submissions
  app.post("/v1/user/submissions", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const { inputType, payload, partnerId, submitNow } = req.body;

      if (!inputType || !payload) {
        return fail(res, 400, "INVALID_ARGUMENT", "inputType과 payload가 필요합니다.");
      }
      
      const pId = partnerId || "default_partner";

      const db = adminApp.firestore();
      const docRef = db.collection("user_submissions").doc();
      
      const newSubmission: UserSubmission = {
        userId,
        partnerId: pId,
        status: submitNow ? "submitted" : "draft",
        input: {
          type: inputType,
          payload
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      const batch = db.batch();
      batch.set(docRef, newSubmission);

      if (submitNow) {
        const eventRef = db.collection("submission_events").doc();
        const event: SubmissionEvent = {
          submissionId: docRef.id,
          userId,
          type: "submitted",
          message: "제출이 완료되어 처리를 대기 중입니다.",
          createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
        };
        batch.set(eventRef, event);
      }

      await batch.commit();

      return ok(res, { submission: { id: docRef.id, ...newSubmission } });
    } catch (err: any) {
      logError({ endpoint: "user/submissions/create", code: "INTERNAL", messageKo: "제출 생성 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 2) POST /v1/user/submissions/:id/submit
  app.post("/v1/user/submissions/:id/submit", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const subId = String(req.params.id);
      const db = adminApp.firestore();
      const docRef = db.collection("user_submissions").doc(subId);
      
      const snap = await docRef.get();
      if (!snap.exists || snap.data()?.userId !== userId) {
        return fail(res, 404, "NOT_FOUND", "제출 내역을 찾을 수 없습니다.");
      }

      if (snap.data()?.status !== "draft") {
        return fail(res, 400, "FAILED_PRECONDITION", "draft 상태의 제출건만 submit 할 수 있습니다.");
      }

      const batch = db.batch();
      batch.update(docRef, {
        status: "submitted",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const eventRef = db.collection("submission_events").doc();
      const event: SubmissionEvent = {
        submissionId: subId,
        userId,
        type: "submitted",
        message: "제출이 완료되어 처리를 대기 중입니다.",
        createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };
      batch.set(eventRef, event);

      await batch.commit();

      return ok(res, { message: "제출 완료" });
    } catch (err: any) {
      logError({ endpoint: "user/submissions/submit", code: "INTERNAL", messageKo: "제출 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 3) POST /v1/user/submissions/:id/link-evidence
  app.post("/v1/user/submissions/:id/link-evidence", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const subId = String(req.params.id);
      const { evidences } = req.body;

      if (!Array.isArray(evidences)) {
        return fail(res, 400, "INVALID_ARGUMENT", "evidences 배열이 필요합니다.");
      }

      const db = adminApp.firestore();
      const docRef = db.collection("user_submissions").doc(subId);
      
      const snap = await docRef.get();
      if (!snap.exists || snap.data()?.userId !== userId) {
        return fail(res, 404, "NOT_FOUND", "제출 내역을 찾을 수 없습니다.");
      }
      
      const subData = snap.data() as UserSubmission;
      
      if (!subData.caseId) {
         return fail(res, 400, "FAILED_PRECONDITION", "연결된 파트너 케이스가 없습니다. 제출을 먼저 완료해주세요.");
      }

      const batch = db.batch();
      
      for (const ev of evidences) {
        if (!ev.type || !ev.fileUrl) continue;
        
        const evRef = db.collection("evidences").doc();
        batch.set(evRef, {
          caseId: subData.caseId,
          partnerId: subData.partnerId,
          type: ev.type,
          fileUrl: ev.fileUrl,
          status: "uploaded",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      const eventRef = db.collection("submission_events").doc();
      batch.set(eventRef, {
        submissionId: subId,
        userId,
        type: "processing_progress",
        message: `${evidences.length}개의 증거물이 파트너 케이스에 연동되었습니다.`,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      return ok(res, { message: "증거물 연동 완료" });
    } catch (err: any) {
      logError({ endpoint: "user/submissions/link-evidence", code: "INTERNAL", messageKo: "증거물 연동 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 4) GET /v1/user/submissions
  app.get("/v1/user/submissions", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const db = adminApp.firestore();

      const snap = await db.collection("user_submissions")
        .where("userId", "==", userId)
        .orderBy("updatedAt", "desc")
        .get();

      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "user/submissions/list", code: "INTERNAL", messageKo: "제출 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 5) GET /v1/user/submissions/:id
  app.get("/v1/user/submissions/:id", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const subId = String(req.params.id);
      const db = adminApp.firestore();

      const snap = await db.collection("user_submissions").doc(subId).get();
      if (!snap.exists || snap.data()?.userId !== userId) {
        return fail(res, 404, "NOT_FOUND", "제출 내역을 찾을 수 없습니다.");
      }

      return ok(res, { submission: { id: snap.id, ...snap.data() } });
    } catch (err: any) {
      logError({ endpoint: "user/submissions/get", code: "INTERNAL", messageKo: "제출 상세 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 6) GET /v1/user/submissions/:id/events
  app.get("/v1/user/submissions/:id/events", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const subId = String(req.params.id);
      const db = adminApp.firestore();

      const snap = await db.collection("submission_events")
        .where("submissionId", "==", subId)
        .where("userId", "==", userId)
        .orderBy("createdAt", "asc")
        .get();

      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "user/submissions/events", code: "INTERNAL", messageKo: "진행 상태 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 7) POST /v1/user/submissions/:id/cancel
  app.post("/v1/user/submissions/:id/cancel", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const subId = String(req.params.id);
      const db = adminApp.firestore();
      const docRef = db.collection("user_submissions").doc(subId);
      
      const snap = await docRef.get();
      if (!snap.exists || snap.data()?.userId !== userId) {
        return fail(res, 404, "NOT_FOUND", "제출 내역을 찾을 수 없습니다.");
      }

      const status = snap.data()?.status;
      if (["completed", "failed", "cancelled"].includes(status)) {
        return fail(res, 400, "FAILED_PRECONDITION", "이미 종료된 제출건은 취소할 수 없습니다.");
      }

      const batch = db.batch();
      
      let newStatus = "cancelled";
      let eventType = "cancelled";
      let msg = "사용자에 의해 취소되었습니다.";

      // 만약 이미 진행 중이라면 워커가 안전하게 종료할 수 있도록 상태만 변경
      if (status === "processing") {
        newStatus = "cancel_requested";
        eventType = "cancel_requested";
        msg = "취소가 요청되었습니다. 진행 중인 작업을 안전하게 중단합니다.";
      }

      batch.update(docRef, {
        status: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const eventRef = db.collection("submission_events").doc();
      const event: SubmissionEvent = {
        submissionId: subId,
        userId,
        type: eventType as any,
        message: msg,
        createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };
      batch.set(eventRef, event);

      await batch.commit();

      return ok(res, { message: msg, status: newStatus });
    } catch (err: any) {
      logError({ endpoint: "user/submissions/cancel", code: "INTERNAL", messageKo: "취소 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 8) POST /v1/user/submissions/:id/evidences/:evidenceId/download-url
  app.post("/v1/user/submissions/:id/evidences/:evidenceId/download-url", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const subId = String(req.params.id);
      const eId = String(req.params.evidenceId);
      const db = adminApp.firestore();

      const subSnap = await db.collection("user_submissions").doc(subId).get();
      if (!subSnap.exists || subSnap.data()?.userId !== userId) {
        return fail(res, 404, "NOT_FOUND", "접근할 수 없는 제출 내역입니다.");
      }

      const subData = subSnap.data() as UserSubmission;
      if (!subData.caseId) {
        return fail(res, 404, "NOT_FOUND", "파트너 케이스와 연결되지 않았습니다.");
      }

      const evidenceRef = db.collection("evidences").doc(eId);
      const evSnap = await evidenceRef.get();

      if (!evSnap.exists || evSnap.data()?.caseId !== subData.caseId) {
        return fail(res, 404, "NOT_FOUND", "접근할 수 없는 증거물입니다.");
      }

      const evData = evSnap.data();
      if (!evData?.storagePath) {
        return fail(res, 404, "NOT_FOUND", "스토리지 경로가 없습니다.");
      }

      const bucket = adminApp.storage().bucket();
      const file = bucket.file(evData.storagePath);
      const [exists] = await file.exists();
      
      if (!exists) {
        return fail(res, 404, "NOT_FOUND", "파일이 삭제되었거나 존재하지 않습니다.");
      }

      const [downloadUrl] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 15 * 60 * 1000 // 15분
      });

      return ok(res, { downloadUrl });
    } catch (err: any) {
      logError({ endpoint: "user/submissions/evidence-download-url", code: "INTERNAL", messageKo: "다운로드 URL 발급 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

}