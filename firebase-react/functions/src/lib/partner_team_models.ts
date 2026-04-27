import * as admin from "firebase-admin";

export type PartnerRole = "owner" | "admin" | "editor" | "viewer";

export interface PartnerTeamMember {
  id?: string;
  partnerId: string;
  userId: string;
  email: string;
  role: PartnerRole;
  status: "active" | "suspended";
  joinedAt: admin.firestore.Timestamp;
  invitedBy: string; // 초대한 사람의 userId
  updatedAt: admin.firestore.Timestamp;
}

export type InvitationStatus = "pending" | "accepted" | "canceled" | "expired";

export interface PartnerTeamInvitation {
  id?: string;
  partnerId: string;
  email: string; // 초대받을 이메일
  role: PartnerRole;
  token: string; // 수락 링크에 포함될 난수 토큰
  status: InvitationStatus;
  invitedBy: string; // 초대한 사람의 userId
  expiresAt: admin.firestore.Timestamp; // 보통 생성일로부터 7일
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}
