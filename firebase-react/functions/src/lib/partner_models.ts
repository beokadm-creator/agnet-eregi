import * as admin from "firebase-admin";

export type CaseStatus = "draft" | "collecting" | "packaging" | "ready" | "failed" | "completed";

export interface PartnerCase {
  id?: string;
  partnerId: string;
  status: CaseStatus;
  title: string;
  submissionId?: string; // User Web과 연동을 위한 필드
  closingReport?: {
    status: "not_generated" | "ready" | "failed";
    artifactPath?: string;
    checksumSha256?: string;
    error?: { message: string };
    updatedAt?: admin.firestore.Timestamp;
  };
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export type EvidenceStatus = "pending" | "uploaded" | "validated" | "failed";

export interface CaseEvidence {
  id?: string;
  caseId: string;
  partnerId: string; // for security scope
  type: string;
  fileUrl: string;      // 실제 파일 접근 URL(임시 또는 캐싱용, 또는 파일명)
  storagePath?: string; // 스토리지 내부 경로 (예: evidence/{partnerId}/{caseId}/{evidenceId}/{filename})
  status: EvidenceStatus;
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
  scanStatus?: "clean" | "infected" | "unknown";
  source?: "partner" | "user"; // 업로드 출처
  requestId?: string;          // 증거 요청 ID
  itemCode?: string;           // 증거 요청 항목 코드
  createdAt: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
}

export interface EvidenceRequestItem {
  code: string;
  titleKo: string;
  required: boolean;
  status: "open" | "fulfilled";
  evidenceId?: string;
  fulfilledAt?: admin.firestore.Timestamp;
}

export interface EvidenceRequest {
  id?: string;
  partnerId: string;
  caseId: string;
  submissionId?: string;
  status: "open" | "fulfilled" | "cancelled";
  items: EvidenceRequestItem[];
  messageToUserKo: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  fulfilledAt?: admin.firestore.Timestamp;
}

export type PackageStatus = "queued" | "building" | "ready" | "failed";

export interface CasePackage {
  id?: string;
  caseId: string;
  partnerId: string; // for security scope
  status: PackageStatus;
  artifactPath?: string;
  artifactUrl?: string;
  checksumSha256?: string;
  validation?: {
    status: "not_run" | "pass" | "fail";
    missing: Array<{ code: string; messageKo: string }>;
    validatedAt?: admin.firestore.Timestamp;
  };
  error?: {
    category: string;
    message: string;
  };
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export type RBACRole = "owner" | "admin" | "editor" | "viewer" | "billing" | "agent";

export interface Organization {
  id?: string;
  name: string;
  ownerId: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface Workspace {
  id?: string;
  organizationId: string;
  name: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface PartnerMember {
  id?: string;
  userId: string;
  organizationId: string;
  workspaceIds?: string[];
  role: RBACRole;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}
