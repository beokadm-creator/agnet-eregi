import * as admin from "firebase-admin";

export type SubmissionStatus = "draft" | "submitted" | "processing" | "completed" | "failed" | "cancelled" | "cancel_requested";

export interface UserSubmission {
  id?: string;
  userId: string;
  partnerId?: string; // 파트너에게 제출할 대상인 경우
  caseId?: string;    // 처리 완료 후 파트너 쪽에 생성된 케이스 ID
  status: SubmissionStatus;
  input: {
    type: string;
    payload: any;
  };
  result?: {
    summary?: string;
    artifactUrl?: string;
    error?: {
      category: string;
      message: string;
    };
  };
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export type SubmissionEventType = "submitted" | "processing_started" | "processing_progress" | "completed" | "failed" | "cancelled" | "cancel_requested";

export interface SubmissionEvent {
  id?: string;
  submissionId: string;
  userId: string; // 보안 검증용
  type: SubmissionEventType;
  message: string;
  meta?: any;
  createdAt: admin.firestore.Timestamp;
}
