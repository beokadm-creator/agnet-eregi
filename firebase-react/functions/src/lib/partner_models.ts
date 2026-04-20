import * as admin from "firebase-admin";

export type CaseStatus = "draft" | "collecting" | "packaging" | "ready" | "failed";

export interface PartnerCase {
  id?: string;
  partnerId: string;
  status: CaseStatus;
  title: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export type EvidenceStatus = "uploaded" | "validated" | "failed";

export interface CaseEvidence {
  id?: string;
  caseId: string;
  partnerId: string; // for security scope
  type: string;
  fileUrl: string;
  status: EvidenceStatus;
  createdAt: admin.firestore.Timestamp;
}

export type PackageStatus = "queued" | "building" | "ready" | "failed";

export interface CasePackage {
  id?: string;
  caseId: string;
  partnerId: string; // for security scope
  status: PackageStatus;
  artifactUrl?: string;
  error?: {
    category: string;
    message: string;
  };
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}
