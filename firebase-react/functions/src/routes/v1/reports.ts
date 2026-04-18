import type express from "express";
import type * as admin from "firebase-admin";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, WidthType } from "docx";

import { requireAuth, isOps, partnerIdOf } from "../../lib/auth";
import { fail } from "../../lib/http";
import { caseRef } from "../../lib/firestore";

function fmtTs(v: any) {
  if (!v) return "-";
  try {
    const d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
    return d.toISOString();
  } catch {
    return String(v);
  }
}

function tableFromRows(rows: string[][]) {
  const tableRows = rows.map(
    (r) =>
      new TableRow({
        children: r.map(
          (c) =>
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [new Paragraph(String(c ?? ""))]
            })
        )
      })
  );
  return new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

export function registerReportRoutes(app: express.Express, adminApp: typeof admin) {
  // Gate 일일 집계 API (운영용)
  app.get("/v1/ops/reports/pilot-gate/daily", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

    const dateParam = String(req.query.date || "");
    const targetDateStr = dateParam ? dateParam : new Date().toLocaleDateString("en-CA").split("/").reverse().join("-");
    const targetDate = new Date(targetDateStr);
    
    if (isNaN(targetDate.getTime())) {
      return fail(res, 400, "INVALID_ARGUMENT", "날짜 형식이 잘못되었습니다. YYYY-MM-DD");
    }

    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    const snapshot = await adminApp.firestore()
      .collection("pilot_gate_evidence")
      .where("validatedAt", ">=", adminApp.firestore.Timestamp.fromDate(startOfDay))
      .where("validatedAt", "<=", adminApp.firestore.Timestamp.fromDate(endOfDay))
      .get();

    const docs = snapshot.docs.map(d => d.data());

    const total = docs.length;
    const okCount = docs.filter(d => d.ok === true || d.status === "ok").length;
    const failCount = total - okCount;

    const missingCount: Record<string, number> = {};
    const failCases = new Set<string>();

    for (const d of docs) {
      if (d.ok === false || d.status === "fail") {
        failCases.add(d.caseId);
        if (Array.isArray(d.missing)) {
          for (const m of d.missing) {
            missingCount[m] = (missingCount[m] || 0) + 1;
          }
        }
      }
    }

    const topMissing = Object.entries(missingCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => `${e[0]}(${e[1]}건)`);

    const sampleFailCaseIds = Array.from(failCases).slice(0, 3);

    let copyText = `[${targetDateStr} Gate 집계] 총 ${total}건 (성공: ${okCount}건, 실패: ${failCount}건)`;
    if (failCount > 0) {
      copyText += `\n- 주요 누락서류: ${topMissing.join(", ") || "없음"}`;
      copyText += `\n- 실패 샘플(최대3건): ${sampleFailCaseIds.join(", ") || "없음"}`;
    }

    return res.status(200).send({
      ok: true,
      data: {
        total,
        ok: okCount,
        fail: failCount,
        topMissing,
        sampleFailCaseIds,
        copyText
      }
    });
  });

  // Gate 백로그 후보 생성 API (운영용)
  app.post("/v1/ops/reports/pilot-gate/backlog", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

    const { date, topN = 3 } = req.body;
    const targetDateStr = date ? String(date) : new Date().toLocaleDateString("en-CA").split("/").reverse().join("-");
    const targetDate = new Date(targetDateStr);
    
    if (isNaN(targetDate.getTime())) {
      return fail(res, 400, "INVALID_ARGUMENT", "날짜 형식이 잘못되었습니다. YYYY-MM-DD");
    }

    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    const snapshot = await adminApp.firestore()
      .collection("pilot_gate_evidence")
      .where("validatedAt", ">=", adminApp.firestore.Timestamp.fromDate(startOfDay))
      .where("validatedAt", "<=", adminApp.firestore.Timestamp.fromDate(endOfDay))
      .get();

    const docs = snapshot.docs.map(d => d.data());

    const missingStats: Record<string, { impactCount: number, evidenceIds: Set<string>, sampleCaseIds: Set<string> }> = {};
    for (const d of docs) {
      if (d.ok === false || d.status === "fail") {
        const evId = d.evidenceId;
        const caseId = d.caseId;
        for (const m of (d.missing || [])) {
          if (!missingStats[m]) missingStats[m] = { impactCount: 0, evidenceIds: new Set(), sampleCaseIds: new Set() };
          missingStats[m].impactCount++;
          missingStats[m].evidenceIds.add(evId);
          missingStats[m].sampleCaseIds.add(caseId);
        }
      }
    }

    const items = Object.entries(missingStats).map(([slotId, stats]) => {
      let sevNum = 3;
      if (slotId === "slot_filing_receipt") sevNum = 1;
      else if (slotId.endsWith("_signed")) sevNum = 2;

      return {
        title: `[게이트 누락] ${slotId} 검증 실패 자동화 대응`,
        severity: `Sev${sevNum}`,
        owner: "ops",
        eta: "TBD",
        impactCount: stats.impactCount,
        evidenceIds: Array.from(stats.evidenceIds).slice(0, 3),
        sampleCaseIds: Array.from(stats.sampleCaseIds).slice(0, 3),
        reproSteps: `1. 파트너 콘솔에서 ${slotId} 업로드 누락 또는 API 오류 확인\n2. ${slotId} 제출 로직 디버깅`,
        acceptanceCriteria: `1. ${slotId} 파일이 정상적으로 Storage에 업로드됨\n2. Gate 검증 API 호출 시 missing 배열에 ${slotId}가 포함되지 않음\n3. ok: true 달성`
      };
    });

    items.sort((a, b) => a.severity.localeCompare(b.severity) || b.impactCount - a.impactCount);
    const resultItems = items.slice(0, Number(topN));

    return res.status(200).send({
      ok: true,
      data: { items: resultItems }
    });
  });

  // 케이스 종료 리포트(DOCX) - 케이스 참여자/ops
  app.get("/v1/cases/:caseId/reports/closing.docx", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const cs = await caseRef(adminApp, caseId).get();
    if (!cs.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cs.data() as any;

    const canRead = isOps(auth) || c.ownerUid === auth.uid || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canRead) return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    const [wfSnap, docsSnap, timelineSnap, quotesSnap, paySnap, refundSnap, filingSnap] = await Promise.all([
      adminApp.firestore().doc(`cases/${caseId}/workflow/main`).get(),
      adminApp.firestore().collection(`cases/${caseId}/documents`).orderBy("updatedAt", "desc").limit(200).get(),
      adminApp.firestore().collection(`cases/${caseId}/timeline`).orderBy("occurredAt", "desc").limit(50).get(),
      adminApp.firestore().collection(`cases/${caseId}/quotes`).orderBy("updatedAt", "desc").limit(50).get(),
      adminApp.firestore().collection(`cases/${caseId}/payments`).orderBy("updatedAt", "desc").limit(50).get(),
      adminApp.firestore().collection(`cases/${caseId}/refunds`).orderBy("updatedAt", "desc").limit(50).get(),
      adminApp.firestore().doc(`cases/${caseId}/filing/main`).get()
    ]);

    const wf = wfSnap.exists ? (wfSnap.data() as any) : null;
    const filing = filingSnap.exists ? (filingSnap.data() as any) : null;
    const docs = docsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
    const events = timelineSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
    const quotes = quotesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
    const payments = paySnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
    const refunds = refundSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

    const children: any[] = [];
    children.push(new Paragraph({ text: "케이스 종료 리포트", heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph({ text: `caseId: ${caseId}` }));
    children.push(new Paragraph({ text: `casePackId: ${c.casePackId ?? "-"}` }));
    children.push(new Paragraph({ text: `status: ${c.status ?? "-"}` }));
    children.push(new Paragraph({ text: `ownerUid: ${c.ownerUid ?? "-"}` }));
    children.push(new Paragraph({ text: `partnerId: ${c.partnerId ?? "-"}` }));
    children.push(new Paragraph({ text: `createdAt: ${fmtTs(c.createdAt)}` }));
    children.push(new Paragraph({ text: `updatedAt: ${fmtTs(c.updatedAt)}` }));
    children.push(new Paragraph({ text: "" }));

    children.push(new Paragraph({ text: "업무 프로세스", heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: `stage: ${wf?.stage ?? "-"}` }));
    children.push(new Paragraph({ text: "" }));

    children.push(new Paragraph({ text: "접수 정보", heading: HeadingLevel.HEADING_2 }));
    if (!filing) {
      children.push(new Paragraph({ text: "접수 정보 없음" }));
    } else {
      children.push(new Paragraph({ text: `receiptNo: ${filing.receiptNo ?? "-"}` }));
      children.push(new Paragraph({ text: `jurisdictionKo: ${filing.jurisdictionKo ?? "-"}` }));
      children.push(new Paragraph({ text: `submittedDate: ${filing.submittedDate ?? "-"}` }));
      if (filing.memoKo) children.push(new Paragraph({ text: `memoKo: ${filing.memoKo}` }));
    }
    children.push(new Paragraph({ text: "" }));

    children.push(new Paragraph({ text: "문서", heading: HeadingLevel.HEADING_2 }));
    const docRows: string[][] = [["slotId", "status", "fileName", "reviewDecision", "issueCodes", "updatedAt"]];
    for (const d of docs) {
      const v = d.latestVersionId ? d.versions?.[d.latestVersionId] : null;
      docRows.push([
        String(d.slotId ?? ""),
        String(d.status ?? ""),
        String(v?.fileName ?? ""),
        String(d.review?.decision ?? ""),
        Array.isArray(d.review?.issueCodes) ? d.review.issueCodes.join("|") : "",
        fmtTs(d.updatedAt)
      ]);
    }
    children.push(tableFromRows(docRows));
    children.push(new Paragraph({ text: "" }));

    children.push(new Paragraph({ text: "견적", heading: HeadingLevel.HEADING_2 }));
    const quoteRows: string[][] = [["quoteId", "status", "priceMin", "priceMax", "currency", "updatedAt"]];
    for (const q of quotes) {
      quoteRows.push([
        String(q.quoteId ?? q.id ?? ""),
        String(q.status ?? ""),
        String(q.priceRange?.min ?? ""),
        String(q.priceRange?.max ?? ""),
        String(q.priceRange?.currency ?? ""),
        fmtTs(q.updatedAt)
      ]);
    }
    children.push(tableFromRows(quoteRows));
    children.push(new Paragraph({ text: "" }));

    children.push(new Paragraph({ text: "결제", heading: HeadingLevel.HEADING_2 }));
    const payRows: string[][] = [["paymentId", "status", "amount", "currency", "capturedAt", "updatedAt"]];
    for (const p of payments) {
      payRows.push([
        String(p.paymentId ?? p.id ?? ""),
        String(p.status ?? ""),
        String(p.amount?.amount ?? ""),
        String(p.amount?.currency ?? ""),
        fmtTs(p.capturedAt),
        fmtTs(p.updatedAt)
      ]);
    }
    children.push(tableFromRows(payRows));
    children.push(new Paragraph({ text: "" }));

    children.push(new Paragraph({ text: "환불", heading: HeadingLevel.HEADING_2 }));
    const rRows: string[][] = [["refundId", "status", "amount", "currency", "executedAt", "updatedAt"]];
    for (const r of refunds) {
      rRows.push([
        String(r.refundId ?? r.id ?? ""),
        String(r.status ?? ""),
        String(r.amount?.amount ?? ""),
        String(r.amount?.currency ?? ""),
        fmtTs(r.executedAt),
        fmtTs(r.updatedAt)
      ]);
    }
    children.push(tableFromRows(rRows));
    children.push(new Paragraph({ text: "" }));

    children.push(new Paragraph({ text: "타임라인(최근 50)", heading: HeadingLevel.HEADING_2 }));
    const eRows: string[][] = [["type", "summaryKo", "occurredAt"]];
    for (const e of events) {
      eRows.push([String(e.type ?? ""), String(e.summaryKo ?? ""), fmtTs(e.occurredAt)]);
    }
    children.push(tableFromRows(eRows));

    const doc = new Document({ sections: [{ properties: {}, children }] });
    const buf = await Packer.toBuffer(doc);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="closing_report_${caseId}.docx"`);
    return res.status(200).send(buf);
  });
}

