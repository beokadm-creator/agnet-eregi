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
      const { inputType, payload, partnerId, submitNow, sessionId } = req.body;

      if (!inputType) {
        return fail(res, 400, "INVALID_ARGUMENT", "inputType이 필요합니다.");
      }
      
      const pId = partnerId || "default_partner";
      const db = adminApp.firestore();

      let finalPayload = payload || {};

      if (sessionId) {
        const sessionSnap = await db.collection("funnel_sessions").doc(sessionId).get();
        if (sessionSnap.exists) {
          const sessionData = sessionSnap.data();
          if (sessionData?.status === "converted") {
            return fail(res, 400, "FAILED_PRECONDITION", "이미 전환된 세션입니다.");
          }
          // Merge funnel answers into payload if payload is empty or combine them
          if (!payload || Object.keys(payload).length === 0) {
            finalPayload = sessionData?.answers || {};
          }
          await sessionSnap.ref.update({ status: "converted" });
        }
      }

      const docRef = db.collection("user_submissions").doc();
      
      const newSubmission: UserSubmission = {
        userId,
        partnerId: pId,
        status: submitNow ? "submitted" : "draft",
        input: {
          type: inputType,
          payload: finalPayload
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

  // 9) POST /v1/user/submissions/:id/package/download-url
  app.post("/v1/user/submissions/:id/package/download-url", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const subId = String(req.params.id);
      const db = adminApp.firestore();

      const subSnap = await db.collection("user_submissions").doc(subId).get();
      if (!subSnap.exists || subSnap.data()?.userId !== userId) {
        return fail(res, 404, "NOT_FOUND", "접근할 수 없는 제출 내역입니다.");
      }

      const subData = subSnap.data() as UserSubmission;
      if (!subData.caseId || !subData.packageId) {
        return fail(res, 404, "NOT_FOUND", "패키지가 생성되지 않았습니다.");
      }

      const pkgSnap = await db.collection("packages").doc(subData.packageId).get();
      if (!pkgSnap.exists || pkgSnap.data()?.caseId !== subData.caseId) {
        return fail(res, 404, "NOT_FOUND", "접근할 수 없는 패키지입니다.");
      }

      const pkg = pkgSnap.data() as any;
      if (pkg.status !== "ready") {
        return fail(res, 400, "FAILED_PRECONDITION", "ready 상태의 패키지만 다운로드할 수 있습니다.");
      }

      if (!pkg.artifactPath || !pkg.checksumSha256) {
        return fail(res, 500, "INTERNAL", "artifactPath 또는 checksumSha256 누락");
      }

      const bucket = adminApp.storage().bucket();
      const file = bucket.file(pkg.artifactPath);
      const [exists] = await file.exists();

      if (!exists) {
        return fail(res, 404, "NOT_FOUND", "아티팩트 파일이 존재하지 않습니다.");
      }

      const [downloadUrl] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 15 * 60 * 1000
      });

      return ok(res, { downloadUrl, checksumSha256: pkg.checksumSha256 });
    } catch (err: any) {
      logError({ endpoint: "user/submissions/package-download-url", code: "INTERNAL", messageKo: "패키지 다운로드 URL 발급 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 10) GET /v1/user/submissions/:id/evidence-requests
  app.get("/v1/user/submissions/:id/evidence-requests", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const subId = String(req.params.id);
      const db = adminApp.firestore();

      const subSnap = await db.collection("user_submissions").doc(subId).get();
      if (!subSnap.exists || subSnap.data()?.userId !== userId) {
        return fail(res, 404, "NOT_FOUND", "제출 내역을 찾을 수 없습니다.");
      }

      const caseId = subSnap.data()?.caseId;
      if (!caseId) {
        return ok(res, { items: [] });
      }

      const snap = await db.collection("evidence_requests")
        .where("caseId", "==", caseId)
        .orderBy("createdAt", "desc")
        .get();

      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return ok(res, { items });
    } catch (err: any) {
      logError({ endpoint: "user/evidence-requests/list", code: "INTERNAL", messageKo: "추가 서류 요청 목록 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 11) GET /v1/user/submissions/:id/evidence-requests/:requestId
  app.get("/v1/user/submissions/:id/evidence-requests/:requestId", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const subId = String(req.params.id);
      const rId = String(req.params.requestId);
      const db = adminApp.firestore();

      const subSnap = await db.collection("user_submissions").doc(subId).get();
      if (!subSnap.exists || subSnap.data()?.userId !== userId) {
        return fail(res, 404, "NOT_FOUND", "제출 내역을 찾을 수 없습니다.");
      }

      const caseId = subSnap.data()?.caseId;
      if (!caseId) {
        return fail(res, 404, "NOT_FOUND", "요청을 찾을 수 없습니다.");
      }

      const reqSnap = await db.collection("evidence_requests").doc(rId).get();
      if (!reqSnap.exists || reqSnap.data()?.caseId !== caseId) {
        return fail(res, 404, "NOT_FOUND", "접근할 수 없는 요청입니다.");
      }

      return ok(res, { evidenceRequest: { id: reqSnap.id, ...reqSnap.data() } });
    } catch (err: any) {
      logError({ endpoint: "user/evidence-requests/get", code: "INTERNAL", messageKo: "추가 서류 요청 상세 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 12) POST /v1/user/submissions/:id/evidences/upload-url
  app.post("/v1/user/submissions/:id/evidences/upload-url", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const subId = String(req.params.id);
      const { filename, contentType, sizeBytes, type, requestId, itemCode } = req.body;

      if (!filename || !contentType || !sizeBytes || !type) {
        return fail(res, 400, "INVALID_ARGUMENT", "filename, contentType, sizeBytes, type이 필요합니다.");
      }

      if (sizeBytes > 25 * 1024 * 1024) {
        return fail(res, 400, "INVALID_ARGUMENT", "파일 크기는 25MB 이하여야 합니다.");
      }

      const allowedMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
      if (!allowedMimeTypes.includes(contentType)) {
        return fail(res, 400, "INVALID_ARGUMENT", "허용되지 않는 파일 형식입니다.");
      }

      const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const db = adminApp.firestore();
      
      const subSnap = await db.collection("user_submissions").doc(subId).get();
      if (!subSnap.exists || subSnap.data()?.userId !== userId) {
        return fail(res, 404, "NOT_FOUND", "접근할 수 없는 제출 내역입니다.");
      }

      const caseId = subSnap.data()?.caseId;
      const partnerId = subSnap.data()?.partnerId;
      if (!caseId || !partnerId) {
        return fail(res, 400, "FAILED_PRECONDITION", "케이스가 생성되지 않았습니다.");
      }

      if (requestId) {
        if (!itemCode) {
          return fail(res, 400, "INVALID_ARGUMENT", "requestId가 제공된 경우 itemCode도 필수입니다.");
        }
        const reqSnap = await db.collection("evidence_requests").doc(requestId).get();
        if (!reqSnap.exists || reqSnap.data()?.caseId !== caseId || reqSnap.data()?.status !== "open") {
          return fail(res, 400, "FAILED_PRECONDITION", "유효하지 않거나 이미 처리된 요청입니다.");
        }
        
        const items = reqSnap.data()?.items || [];
        const item = items.find((i: any) => i.code === itemCode);
        if (!item) {
          return fail(res, 400, "INVALID_ARGUMENT", "해당 요청에 존재하지 않는 항목 코드입니다.");
        }
        
        if (item.status === "fulfilled") {
          return fail(res, 409, "CONFLICT", "이미 제출 완료된 항목입니다.");
        }
      }

      const evidenceRef = db.collection("evidences").doc();
      const storagePath = `evidence/${partnerId}/${caseId}/${evidenceRef.id}/${safeFilename}`;

      const newEvidence = {
        caseId,
        partnerId,
        type,
        fileUrl: safeFilename,
        storagePath,
        status: "pending",
        filename: safeFilename,
        contentType,
        sizeBytes,
        source: "user",
        requestId: requestId || null,
        itemCode: itemCode || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await evidenceRef.set(newEvidence);

      const bucket = adminApp.storage().bucket();
      const file = bucket.file(storagePath);
      const [uploadUrl] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 15 * 60 * 1000,
        contentType
      });

      return ok(res, { uploadUrl, evidenceId: evidenceRef.id, storagePath });
    } catch (err: any) {
      logError({ endpoint: "user/evidences/upload-url", code: "INTERNAL", messageKo: "업로드 URL 발급 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 13) POST /v1/user/submissions/:id/evidences/:evidenceId/complete
  app.post("/v1/user/submissions/:id/evidences/:evidenceId/complete", async (req: express.Request, res: express.Response) => {
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

      const caseId = subSnap.data()?.caseId;
      if (!caseId) {
        return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
      }

      const evidenceRef = db.collection("evidences").doc(eId);
      const evSnap = await evidenceRef.get();
      if (!evSnap.exists || evSnap.data()?.caseId !== caseId) {
        return fail(res, 404, "NOT_FOUND", "접근할 수 없는 증거물입니다.");
      }

      const evData = evSnap.data();
      const bucket = adminApp.storage().bucket();
      const file = bucket.file(evData?.storagePath);
      const [exists] = await file.exists();

      if (!exists) {
        await evidenceRef.update({ status: "failed", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return fail(res, 404, "NOT_FOUND", "스토리지에 파일이 업로드되지 않았습니다.");
      }

      await evidenceRef.update({
        status: "uploaded",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 만약 특정 evidence request에 연결된 항목이라면 해당 request item 상태 업데이트
      if (evData?.requestId && evData?.itemCode) {
        const reqRef = db.collection("evidence_requests").doc(evData.requestId);
        const reqSnap = await reqRef.get();
        
        if (reqSnap.exists && reqSnap.data()?.status === "open") {
          const items = reqSnap.data()?.items || [];
          let allFulfilled = true;
          
          const updatedItems = items.map((item: any) => {
            if (item.code === evData.itemCode) {
              item.status = "fulfilled";
              item.evidenceId = eId;
            }
            if (item.status !== "fulfilled") {
              allFulfilled = false;
            }
            return item;
          });
          
          await reqRef.update({
            items: updatedItems,
            status: allFulfilled ? "fulfilled" : "open",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // 전체 항목이 제출되었으면 파트너에게 알림 발송
          if (allFulfilled) {
            const { enqueueNotification } = require("../../lib/notify_trigger");
            await enqueueNotification(adminApp, { partnerId: evData.partnerId }, "evidence.fulfilled", {
              caseId,
              submissionId: subId,
              requestId: evData.requestId
            });

            // 타임라인 이벤트 추가
            const eventRef = db.collection("submission_events").doc();
            await eventRef.set({
              submissionId: subId,
              userId,
              type: "processing_progress",
              message: "모든 보완 요청 서류가 제출되었습니다.",
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }

      return ok(res, { message: "업로드 완료 확정됨", status: "uploaded" });
    } catch (err: any) {
      logError({ endpoint: "user/evidences/complete", code: "INTERNAL", messageKo: "업로드 완료 처리 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 14) GET /v1/user/submissions/:id/b2g
  app.get("/v1/user/submissions/:id/b2g", async (req: express.Request, res: express.Response) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const userId = auth.uid;
      const subId = String(req.params.id);
      const db = adminApp.firestore();

      const subSnap = await db.collection("user_submissions").doc(subId).get();
      if (!subSnap.exists || subSnap.data()?.userId !== userId) {
        return fail(res, 404, "NOT_FOUND", "제출 내역을 찾을 수 없습니다.");
      }

      const caseId = subSnap.data()?.caseId;
      if (!caseId) {
        return ok(res, { items: [], fees: [] });
      }

      const b2gSnap = await db.collection("b2g_submissions")
        .where("caseId", "==", caseId)
        .get();

      const items = b2gSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      items.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

      const feesSnap = await db.collection("b2g_fee_payments")
        .where("caseId", "==", caseId)
        .get();

      const fees = feesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fees.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

      return ok(res, { items, fees });
    } catch (err: any) {
      logError({ endpoint: "user/submissions/b2g", code: "INTERNAL", messageKo: "B2G 제출 내역 조회 실패", err });
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

}
