import * as admin from "firebase-admin";
import { logOpsEvent } from "./ops_audit";

export interface RetentionPolicy {
  collection: string;
  filters: {
    field: string;
    op: FirebaseFirestore.WhereFilterOp;
    value: any;
  }[];
  dateField: string;
  daysToKeep: number;
  /**
   * Firestore 쿼리 제약(inequality filter 1개 제한 등) 때문에,
   * 쿼리로 못 거르는 조건은 애플리케이션 레벨에서 제외한다.
   */
  excludeActions?: string[];
}

export function getRetentionPolicies(now: Date = new Date()): RetentionPolicy[] {
  const IMPORTANT_AUDIT_ACTIONS = ["ops_playbook.run", "ops_gate_settings.update", "ops_circuit_breaker.reset"];
  return [
    {
      collection: "ops_audit_events",
      // Firestore에서 action not-in + createdAt range는 제약상 불가(inequality 2개).
      // createdAt만으로 90일 초과를 조회한 뒤, 중요한 액션은 삭제에서 제외한다.
      filters: [],
      dateField: "createdAt",
      daysToKeep: 90,
      excludeActions: IMPORTANT_AUDIT_ACTIONS
    },
    {
      collection: "ops_audit_events",
      filters: [
        { field: "action", op: "in", value: IMPORTANT_AUDIT_ACTIONS }
      ],
      dateField: "createdAt",
      daysToKeep: 180
    },
    {
      collection: "ops_alert_jobs",
      filters: [{ field: "status", op: "==", value: "done" }],
      dateField: "createdAt",
      daysToKeep: 14
    },
    {
      collection: "ops_alert_jobs",
      filters: [{ field: "status", op: "==", value: "dead" }],
      dateField: "createdAt",
      daysToKeep: 30
    },
    {
      collection: "ops_retry_jobs",
      filters: [{ field: "status", op: "in", value: ["success", "failed", "done"] }],
      dateField: "createdAt",
      daysToKeep: 14
    },
    {
      collection: "ops_retry_jobs",
      filters: [{ field: "status", op: "==", value: "dead" }],
      dateField: "createdAt",
      daysToKeep: 30
    },
    {
      collection: "ops_incidents",
      filters: [
        { field: "status", op: "==", value: "closed" },
        // Firestore에서 severity != critical + startAt range는 제약상 불가(inequality 2개).
        // 현재 severity는 warn/critical 이므로 warn만 명시적으로 보관정책 적용.
        { field: "severity", op: "==", value: "warn" }
      ],
      dateField: "startAt",
      daysToKeep: 180
    },
    {
      collection: "ops_incidents",
      filters: [
        { field: "status", op: "==", value: "closed" },
        { field: "severity", op: "==", value: "critical" }
      ],
      dateField: "startAt",
      daysToKeep: 365
    },
    {
      collection: "ops_incident_summaries",
      filters: [],
      dateField: "createdAt",
      daysToKeep: 365
    }
  ];
}

export async function executeDataRetention(
  adminApp: typeof admin,
  actorUid: string = "system_worker",
  dryRun: boolean = true
) {
  const db = adminApp.firestore();
  const policies = getRetentionPolicies();
  
  const results = {
    dryRun,
    deletedCountsByCollection: {} as Record<string, number>,
    scannedCountsByCollection: {} as Record<string, number>,
    errors: [] as string[]
  };

  const MAX_DELETES_PER_RUN = 2000;
  let totalDeleted = 0;

  for (const policy of policies) {
    if (!results.deletedCountsByCollection[policy.collection]) {
      results.deletedCountsByCollection[policy.collection] = 0;
      results.scannedCountsByCollection[policy.collection] = 0;
    }

    if (totalDeleted >= MAX_DELETES_PER_RUN) break;

    try {
      let query: FirebaseFirestore.Query = db.collection(policy.collection);
      
      for (const filter of policy.filters) {
        query = query.where(filter.field, filter.op, filter.value);
      }

      const cutoffDate = admin.firestore.Timestamp.fromMillis(Date.now() - policy.daysToKeep * 24 * 60 * 60 * 1000);
      query = query.where(policy.dateField, "<", cutoffDate).limit(500);

      const snap = await query.get();
      let docs = snap.docs;
      // 쿼리로 못 거른 제외 조건은 애플리케이션 레벨에서 필터링한다.
      if (policy.collection === "ops_audit_events" && policy.excludeActions && policy.excludeActions.length > 0) {
        docs = docs.filter((d) => {
          const action = (d.data() as any)?.action;
          return action ? !policy.excludeActions!.includes(String(action)) : true;
        });
      }

      results.scannedCountsByCollection[policy.collection] += snap.size;

      if (docs.length > 0) {
        if (dryRun) {
          results.deletedCountsByCollection[policy.collection] += docs.length;
          totalDeleted += docs.length;
        } else {
          const batch = db.batch();
          for (const doc of docs) {
            batch.delete(doc.ref);
          }
          await batch.commit();
          results.deletedCountsByCollection[policy.collection] += docs.length;
          totalDeleted += docs.length;
        }
      }
    } catch (e: any) {
      console.error(`Retention error on ${policy.collection}:`, e);
      results.errors.push(`${policy.collection}: ${e.message}`);
    }
  }

  await logOpsEvent(adminApp, {
    gateKey: "system",
    action: "ops_retention.run",
    status: results.errors.length === 0 ? "success" : "fail",
    actorUid,
    requestId: `retention_${Date.now()}`,
    summary: `Data retention ${dryRun ? "dry-run" : "execution"} completed. Total processed: ${totalDeleted}`,
    target: results
  });

  return results;
}
