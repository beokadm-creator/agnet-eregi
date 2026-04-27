import * as admin from "firebase-admin";
import { logOpsEvent } from "./ops_audit";

// 티켓 데이터 스키마 정의
export interface OpsTicket {
  gateKey: string;
  status: "pending" | "running" | "open" | "resolved" | "dead";
  title: string;
  description: string;
  incidentId?: string;
  assignedTo?: string;
  priority: "low" | "medium" | "high" | "critical";
  attempts?: number;
  maxAttempts?: number;
  lastError?: { message: string };
  nextRunAt?: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export async function processOpsTickets(adminApp: typeof admin) {
  const db = adminApp.firestore();
  const now = adminApp.firestore.Timestamp.now();

  // 처리 기한이 도래한 pending 상태의 티켓을 가져옴 (한 번에 10개 처리)
  const snap = await db.collection("ops_tickets")
    .where("status", "==", "pending")
    .where("nextRunAt", "<=", now)
    .limit(10)
    .get();

  if (snap.empty) return;

  for (const doc of snap.docs) {
    const ticket = doc.data() as OpsTicket;
    const ticketId = doc.id;

    // 1. 트랜잭션을 통해 중복 처리(Race condition) 방지 및 running 상태로 전환
    try {
      await db.runTransaction(async (t) => {
        const freshSnap = await t.get(doc.ref);
        if (freshSnap.data()?.status !== "pending") {
          throw new Error("Ticket is no longer pending");
        }
        t.update(doc.ref, { 
          status: "running", 
          updatedAt: adminApp.firestore.FieldValue.serverTimestamp() 
        });
      });
    } catch (e) {
      console.warn(`[processOpsTickets] Ticket ${ticketId} skipped:`, e);
      continue;
    }

    let success = false;
    let errorMessage = "";
    let externalTicketId = "";

    // 2. 실제 티켓 발급/동기화 로직 수행 (GitHub Issue 연동)
    try {
      const githubToken = process.env.GITHUB_TOKEN;
      if (!githubToken) throw new Error("GITHUB_TOKEN이 설정되지 않았습니다.");

      const owner = process.env.GITHUB_OWNER || "beokadm-creator";
      const repo = process.env.GITHUB_REPO || "agentregi";

      // GitHub REST API를 통한 이슈 생성
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${githubToken}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: `[${ticket.gateKey}] ${ticket.title}`,
          body: `${ticket.description}\n\n- Incident ID: ${ticket.incidentId || 'N/A'}\n- Priority: ${ticket.priority}`,
          labels: ["ops-ticket", ticket.priority]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`GitHub Issue 생성 실패 (${response.status}): ${errText}`);
      }

      const result = await response.json();
      externalTicketId = result.number.toString(); // GitHub Issue Number 저장
      success = true; 
    } catch (e: any) {
      errorMessage = e.message || "Unknown error occurred during ticket processing";
      success = false;
    }

    // 3. 결과에 따른 후처리 및 Audit Log 기록
    if (success) {
      await doc.ref.update({
        status: "open",
        externalTicketId: externalTicketId || null,
        updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
      });

      await logOpsEvent(db, "ops_ticket.created", "SUCCESS", "system", `ticket_${ticketId}`, ticket.gateKey || "unknown", {
        ticketId, title: ticket.title, externalTicketId
      });
    } else {
      const newAttempts = (ticket.attempts || 0) + 1;
      const maxAttempts = ticket.maxAttempts || 5;
      
      if (newAttempts >= maxAttempts) {
        // 최대 재시도 횟수 초과 시 Dead Letter 큐로 이동
        await doc.ref.update({
          status: "dead",
          attempts: newAttempts,
          lastError: { message: errorMessage },
          updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
        });

        await logOpsEvent(db, "ops_ticket.dead", "FAIL", "system", `ticket_${ticketId}`, ticket.gateKey || "unknown", {
          ticketId, error: errorMessage
        });
      } else {
        // 지수 백오프(Exponential Backoff)를 적용하여 다음 재시도 시간 계산 (예: 2분, 4분, 8분...)
        const backoffMs = Math.pow(2, newAttempts) * 60 * 1000;
        const nextRun = admin.firestore.Timestamp.fromMillis(Date.now() + backoffMs);

        await doc.ref.update({
          status: "pending",
          attempts: newAttempts,
          nextRunAt: nextRun,
          lastError: { message: errorMessage },
          updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  }
}