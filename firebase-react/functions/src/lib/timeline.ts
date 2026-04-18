import type * as admin from "firebase-admin";

import { caseTimelineRef } from "./firestore";

type Actor =
  | { type: "user"; uid: string }
  | { type: "partner"; uid?: string; partnerId: string }
  | { type: "ops"; uid: string }
  | { type: "system"; id: string };

export type TimelineEvent = {
  type: string;
  occurredAt: admin.firestore.FieldValue;
  actor: Actor;
  summaryKo: string;
  meta?: Record<string, any>;
};

// PII 가드(최소): 키 기반 차단. (프로덕에서는 더 엄격하게)
const PII_KEYS = ["residentId", "rrn", "accountNumber", "cardNumber", "ocrText", "documentUrl"];

export async function writeTimelineEvent(
  adminApp: typeof admin,
  caseId: string,
  eventId: string,
  event: TimelineEvent
) {
  const meta = event.meta ?? {};
  for (const k of Object.keys(meta)) {
    if (PII_KEYS.includes(k)) {
      throw new Error(`타임라인 meta에 PII 키는 금지입니다: ${k}`);
    }
  }
  await caseTimelineRef(adminApp, caseId, eventId).set({
    ...event,
    meta
  });
}

