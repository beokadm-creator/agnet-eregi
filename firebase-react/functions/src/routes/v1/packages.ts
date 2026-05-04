import { requireOpsRole } from "../../lib/ops_rbac";
import type express from "express";
import type * as admin from "firebase-admin";
import JSZip from "jszip";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

import { requireAuth, isOps, partnerIdOf } from "../../lib/auth";
import { fail, logError } from "../../lib/http";
import { caseRef } from "../../lib/firestore";
import { requiredSlotsForStage } from "../../lib/workflow";
import { getSlotTitleKo } from "../../lib/casepack";

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

async function markdownToDocxBuffer(markdown: string) {
  const lines = String(markdown ?? "").split("\n");
  const paragraphs: Paragraph[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\r/g, "");
    if (line.startsWith("# ")) {
      paragraphs.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith("## ")) {
      paragraphs.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (line.trim() === "") {
      paragraphs.push(new Paragraph({ text: "" }));
    } else {
      paragraphs.push(new Paragraph({ text: line }));
    }
  }
  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  return await Packer.toBuffer(doc);
}

async function minutesDocxBuffer(input: any) {
  const companyName = String(input?.companyName ?? "회사명");
  const meetingDate = String(input?.meetingDate ?? "2026-01-01");
  const resolutionKo = String(input?.resolutionKo ?? "");
  const officers = Array.isArray(input?.officers) ? input.officers : [];
  const resolutionTextKo = resolutionKo.trim()
    ? resolutionKo.trim()
    : officers.length > 0
      ? `다음과 같이 임원 변경을 결의한다.\n${officers
          .slice(0, 20)
          .map((o: any) => {
            const ct = String(o.changeType || "");
            const ctKo = ct === "appoint" ? "선임" : ct === "resign" ? "사임" : ct === "reappoint" ? "중임" : ct;
            const rep = o.isRepresentative ? " (대표이사)" : "";
            return `- ${String(o.roleKo ?? "")} ${String(o.nameKo ?? "")}${rep}: ${ctKo} (효력일 ${String(o.effectiveDate ?? "")})`;
          })
          .join("\n")}`
      : "임원 변경의 건";

  const children: any[] = [];
  children.push(new Paragraph({ text: "의사록/결의서", heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: companyName, heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ text: "" }));
  children.push(
    tableFromRows([
      ["항목", "내용"],
      ["일자", meetingDate],
      ["안건", "임원 변경의 건"]
    ])
  );
  children.push(new Paragraph({ text: "" }));

  if (officers.length > 0) {
    children.push(new Paragraph({ text: "변경 임원", heading: HeadingLevel.HEADING_2 }));
    const rows: string[][] = [["성명", "직위", "구분", "효력일", "생년월일", "주소", "대표"]];
    for (const o of officers.slice(0, 20)) {
      const ct = String(o.changeType || "");
      const ctKo = ct === "appoint" ? "선임" : ct === "resign" ? "사임" : ct === "reappoint" ? "중임" : ct;
      rows.push([
        String(o.nameKo ?? ""),
        String(o.roleKo ?? ""),
        ctKo,
        String(o.effectiveDate ?? ""),
        String(o.birthDate ?? ""),
        String(o.addressKo ?? ""),
        o.isRepresentative ? "Y" : ""
      ]);
    }
    children.push(tableFromRows(rows));
    children.push(new Paragraph({ text: "" }));
  }

  children.push(new Paragraph({ text: "결의 내용", heading: HeadingLevel.HEADING_2 }));
  for (const line of resolutionTextKo.split("\n")) {
    children.push(new Paragraph({ text: line }));
  }
  children.push(new Paragraph({ text: "" }));
  children.push(new Paragraph({ text: "서명/날인", heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ children: [new TextRun({ text: "성명: ", bold: true }), new TextRun({ text: "____________________", underline: {} })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "서명(또는 인): ", bold: true }), new TextRun({ text: "____________________", underline: {} })] }));

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBuffer(doc);
}

async function poaDocxBuffer(input: any) {
  const principalName = String(input?.principalName ?? "위임인");
  const agentName = String(input?.agentName ?? "수임인(법무사)");
  const scopeKo = String(input?.scopeKo ?? "임원 변경 등기 신청 관련 일체");

  const children: any[] = [];
  children.push(new Paragraph({ text: "위임장", heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: "" }));
  children.push(
    tableFromRows([
      ["항목", "내용"],
      ["위임인", principalName],
      ["수임인", agentName],
      ["위임 범위", scopeKo]
    ])
  );
  children.push(new Paragraph({ text: "" }));
  children.push(new Paragraph({ text: "서명/날인", heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ children: [new TextRun({ text: "위임인 성명: ", bold: true }), new TextRun({ text: "____________________", underline: {} })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "서명(또는 인): ", bold: true }), new TextRun({ text: "____________________", underline: {} })] }));

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBuffer(doc);
}

async function applicationDocxBuffer(input: any) {
  const companyName = String(input?.companyName ?? "회사명");
  const meetingDate = String(input?.meetingDate ?? "2026-01-01");
  const officers = Array.isArray(input?.officers) ? input.officers : [];
  const appointed = officers.filter((o: any) => ["appoint", "reappoint"].includes(String(o.changeType)));
  const resigned = officers.filter((o: any) => String(o.changeType) === "resign");

  const children: any[] = [];
  children.push(new Paragraph({ text: "등기신청서", heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: companyName, heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ text: "" }));
  children.push(
    tableFromRows([
      ["항목", "내용"],
      ["신청 취지", "임원 변경 등기 신청"],
      ["결의일", meetingDate]
    ])
  );
  children.push(new Paragraph({ text: "" }));

  children.push(new Paragraph({ text: "변경 내역", heading: HeadingLevel.HEADING_2 }));
  const rows: string[][] = [["구분", "직위", "성명", "효력일", "비고"]];
  for (const o of appointed) {
    const ct = String(o.changeType || "");
    const ctKo = ct === "appoint" ? "선임" : "중임";
    rows.push([ctKo, String(o.roleKo ?? ""), String(o.nameKo ?? ""), String(o.effectiveDate ?? ""), o.isRepresentative ? "대표" : ""]);
  }
  for (const o of resigned) rows.push(["사임", String(o.roleKo ?? ""), String(o.nameKo ?? ""), String(o.effectiveDate ?? ""), o.isRepresentative ? "대표" : ""]);
  if (rows.length === 1) rows.push(["-", "-", "-", "-", "-"]);
  children.push(tableFromRows(rows));
  children.push(new Paragraph({ text: "" }));

  children.push(new Paragraph({ text: "첨부서류", heading: HeadingLevel.HEADING_2 }));
  const attachments = Array.isArray((input as any)?._attachments) ? (input as any)._attachments : null;
  if (attachments && attachments.length > 0) {
    const rows2: string[][] = [["서류", "상태"]];
    for (const a of attachments) rows2.push([String(a.titleKo ?? a.slotId ?? ""), String(a.statusKo ?? a.status ?? "")]);
    children.push(tableFromRows(rows2));
  } else {
    children.push(new Paragraph({ text: "- 의사록/결의서" }));
    children.push(new Paragraph({ text: "- 위임장" }));
    if (appointed.length > 0) children.push(new Paragraph({ text: "- 취임승낙서" }));
    if (resigned.length > 0) children.push(new Paragraph({ text: "- 사임서" }));
    children.push(new Paragraph({ text: "- 법인등기부등본, 인감증명서 등" }));
  }
  children.push(new Paragraph({ text: "" }));

  children.push(new Paragraph({ text: "신청인(대리인) 서명", heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ children: [new TextRun({ text: "성명: ", bold: true }), new TextRun({ text: "____________________", underline: {} })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "서명(또는 인): ", bold: true }), new TextRun({ text: "____________________", underline: {} })] }));

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBuffer(doc);
}

async function acceptanceDocxBuffer(input: any) {
  const companyName = String(input?.companyName ?? "회사명");
  const officers = Array.isArray(input?.officers) ? input.officers : [];
  const targets = officers.filter((o: any) => ["appoint", "reappoint"].includes(String(o.changeType)));

  const children: any[] = [];
  children.push(new Paragraph({ text: "취임승낙서", heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: companyName, heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ text: "" }));
  children.push(new Paragraph({ text: "취임 대상", heading: HeadingLevel.HEADING_2 }));
  const rows: string[][] = [["직위", "성명", "구분", "효력일"]];
  for (const o of targets) {
    const ct = String(o.changeType || "");
    const ctKo = ct === "appoint" ? "선임" : "중임";
    rows.push([String(o.roleKo ?? ""), String(o.nameKo ?? ""), ctKo, String(o.effectiveDate ?? "")]);
  }
  if (rows.length === 1) rows.push(["-", "-", "-", "-"]);
  children.push(tableFromRows(rows));
  children.push(new Paragraph({ text: "" }));
  children.push(new Paragraph({ text: "본인은 위 직위에 취임함을 승낙합니다." }));
  children.push(new Paragraph({ text: "" }));
  children.push(new Paragraph({ text: "서명/날인", heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ children: [new TextRun({ text: "성명: ", bold: true }), new TextRun({ text: "____________________", underline: {} })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "서명(또는 인): ", bold: true }), new TextRun({ text: "____________________", underline: {} })] }));

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBuffer(doc);
}

async function resignationDocxBuffer(input: any) {
  const companyName = String(input?.companyName ?? "회사명");
  const officers = Array.isArray(input?.officers) ? input.officers : [];
  const targets = officers.filter((o: any) => String(o.changeType) === "resign");

  const children: any[] = [];
  children.push(new Paragraph({ text: "사임서", heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: companyName, heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ text: "" }));
  children.push(new Paragraph({ text: "사임 대상", heading: HeadingLevel.HEADING_2 }));
  const rows: string[][] = [["직위", "성명", "효력일"]];
  for (const o of targets) rows.push([String(o.roleKo ?? ""), String(o.nameKo ?? ""), String(o.effectiveDate ?? "")]);
  if (rows.length === 1) rows.push(["-", "-", "-"]);
  children.push(tableFromRows(rows));
  children.push(new Paragraph({ text: "" }));
  children.push(new Paragraph({ text: "본인은 위 직위에서 사임합니다." }));
  children.push(new Paragraph({ text: "" }));
  children.push(new Paragraph({ text: "서명/날인", heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ children: [new TextRun({ text: "성명: ", bold: true }), new TextRun({ text: "____________________", underline: {} })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "서명(또는 인): ", bold: true }), new TextRun({ text: "____________________", underline: {} })] }));

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBuffer(doc);
}

async function repChangeDocxBuffer(input: any) {
  const companyName = String(input?.companyName ?? "회사명");
  const meetingDate = String(input?.meetingDate ?? "2026-01-01");
  const officers = Array.isArray(input?.officers) ? input.officers : [];
  const reps = officers.filter((o: any) => (o?.isRepresentative === true || String(o?.roleKo ?? "").includes("대표")) && ["appoint", "reappoint", "resign"].includes(String(o?.changeType)));

  const children: any[] = [];
  children.push(new Paragraph({ text: "대표이사 변경 확인서", heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: companyName, heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ text: "" }));
  children.push(
    tableFromRows([
      ["항목", "내용"],
      ["결의일", meetingDate],
      ["목적", "대표이사 변경 관련 사실 확인"]
    ])
  );
  children.push(new Paragraph({ text: "" }));
  children.push(new Paragraph({ text: "변경 대상", heading: HeadingLevel.HEADING_2 }));
  const rows: string[][] = [["직위", "성명", "구분", "효력일"]];
  for (const o of reps.slice(0, 20)) {
    const ct = String(o.changeType || "");
    const ctKo = ct === "appoint" ? "선임" : ct === "reappoint" ? "중임" : ct === "resign" ? "사임" : ct;
    rows.push([String(o.roleKo ?? ""), String(o.nameKo ?? ""), ctKo, String(o.effectiveDate ?? "")]);
  }
  if (rows.length === 1) rows.push(["-", "-", "-", "-"]);
  children.push(tableFromRows(rows));
  children.push(new Paragraph({ text: "" }));
  children.push(new Paragraph({ text: "서명/날인", heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ children: [new TextRun({ text: "성명: ", bold: true }), new TextRun({ text: "____________________", underline: {} })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "서명(또는 인): ", bold: true }), new TextRun({ text: "____________________", underline: {} })] }));

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBuffer(doc);
}

async function buildWorkflowProofDocx(adminApp: typeof admin, caseId: string) {
  const [wfSnap, tasksSnap] = await Promise.all([
    adminApp.firestore().doc(`cases/${caseId}/workflow/main`).get(),
    adminApp.firestore().collection(`cases/${caseId}/tasks`).orderBy("updatedAt", "desc").limit(200).get()
  ]);
  const wf = wfSnap.exists ? (wfSnap.data() as any) : null;
  const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

  const children: any[] = [];
  children.push(new Paragraph({ text: "업무 체크리스트/태스크 증빙", heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: `caseId: ${caseId}` }));
  children.push(new Paragraph({ text: "" }));

  children.push(new Paragraph({ text: "워크플로우", heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ text: `stage: ${wf?.stage ?? "-"}` }));

  const checklist = wf?.checklist ?? {};
  const keys = Object.keys(checklist);
  const chkRows: string[][] = [["itemId", "done"]];
  for (const k of keys) chkRows.push([k, String(Boolean(checklist[k]))]);
  children.push(tableFromRows(chkRows));
  children.push(new Paragraph({ text: "" }));

  children.push(new Paragraph({ text: "태스크", heading: HeadingLevel.HEADING_2 }));
  const taskRows: string[][] = [["taskId", "titleKo", "status", "updatedAt"]];
  for (const t of tasks) {
    taskRows.push([String(t.taskId ?? t.id ?? ""), String(t.titleKo ?? ""), String(t.status ?? ""), fmtTs(t.updatedAt)]);
  }
  children.push(tableFromRows(taskRows));

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBuffer(doc);
}

async function buildFilingSummaryDocx(adminApp: typeof admin, caseId: string) {
  const snap = await adminApp.firestore().doc(`cases/${caseId}/filing/main`).get();
  const f = snap.exists ? (snap.data() as any) : null;

  const children: any[] = [];
  children.push(new Paragraph({ text: "등기 제출 요약", heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: `caseId: ${caseId}` }));
  children.push(new Paragraph({ text: "" }));

  if (!f) {
    children.push(new Paragraph({ text: "접수 정보 없음" }));
  } else {
    children.push(new Paragraph({ text: `접수번호: ${f.receiptNo ?? "-"}` }));
    children.push(new Paragraph({ text: `관할: ${f.jurisdictionKo ?? "-"}` }));
    children.push(new Paragraph({ text: `접수일: ${f.submittedDate ?? "-"}` }));
    if (f.memoKo) children.push(new Paragraph({ text: `메모: ${f.memoKo}` }));
    children.push(new Paragraph({ text: "" }));
    children.push(new Paragraph({ text: "시각 정보", heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: `createdAt: ${fmtTs(f.createdAt)}` }));
    children.push(new Paragraph({ text: `updatedAt: ${fmtTs(f.updatedAt)}` }));
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBuffer(doc);
}

async function buildSignedEvidenceReportDocx(adminApp: typeof admin, params: { caseId: string; casePackId: string }) {
  const { caseId, casePackId } = params;
  const slots = await requiredSlotsForStage(adminApp, { caseId, casePackId, stage: "draft_filing" as any });
  const signedSlots = slots.filter((s) => String(s).endsWith("_signed"));

  const docsSnap = await adminApp.firestore().collection(`cases/${caseId}/documents`).get();
  const docs = docsSnap.docs.map((d) => d.data() as any);
  const bySlot = new Map<string, any>();
  for (const d of docs) bySlot.set(String(d.slotId), d);

  const statusKoOf = (s: string) =>
    s === "ok" ? "완료" : s === "needs_fix" ? "보완 필요" : s === "uploaded" ? "검토 필요" : s === "uploading" ? "업로드 중" : "미제출";

  const rows: string[][] = [["서명본 슬롯", "서류명", "상태"]];
  for (const slotId of signedSlots) {
    const d = bySlot.get(String(slotId));
    const st = d ? String(d.status ?? "") : "missing";
    rows.push([String(slotId), getSlotTitleKo(casePackId, String(slotId)) ?? String(slotId), statusKoOf(st)]);
  }
  if (rows.length === 1) rows.push(["-", "-", "-"]);

  const children: any[] = [];
  children.push(new Paragraph({ text: "서명본 제출 현황", heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: `caseId: ${caseId}` }));
  children.push(new Paragraph({ text: "" }));
  children.push(tableFromRows(rows));
  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBuffer(doc);
}

async function buildClosingReportDocx(adminApp: typeof admin, caseId: string, c: any) {
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
  for (const e of events) eRows.push([String(e.type ?? ""), String(e.summaryKo ?? ""), fmtTs(e.occurredAt)]);
  children.push(tableFromRows(eRows));

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBuffer(doc);
}

async function validatePackageContents(adminApp: typeof admin, params: { caseId: string; casePackId: string }) {
  const { caseId, casePackId } = params;
  const slots = await requiredSlotsForStage(adminApp, { caseId, casePackId, stage: "draft_filing" as any });
  const signedSlots = slots.filter((s) => String(s).endsWith("_signed"));

  const docsSnap = await adminApp.firestore().collection(`cases/${caseId}/documents`).get();
  const docs = docsSnap.docs.map((d) => d.data() as any);
  const bySlot = new Map<string, any>();
  for (const d of docs) bySlot.set(String(d.slotId), d);

  const missing: string[] = [];
  const signed: { slotId: string; ok: boolean; path: string | null; exists: boolean }[] = [];

  const bucket = adminApp.storage().bucket();

  for (const s of signedSlots) {
    const d = bySlot.get(s);
    const v = d?.latestVersionId ? d?.versions?.[d.latestVersionId] : null;
    const p = v?.storagePath;
    
    let exists = false;
    if (p) {
      const [ex] = await bucket.file(String(p)).exists();
      exists = ex;
    }
    
    const isOk = d?.status === "ok" && exists;
    if (!isOk) missing.push(s);
    signed.push({ slotId: s, ok: d?.status === "ok", path: p || null, exists });
  }

  // filing receipt
  const fr = bySlot.get("slot_filing_receipt");
  const frV = fr?.latestVersionId ? fr?.versions?.[fr.latestVersionId] : null;
  const frP = frV?.storagePath;
  let frExists = false;
  if (frP) {
    const [ex] = await bucket.file(String(frP)).exists();
    frExists = ex;
  }
  const frOk = fr?.status === "ok" && frExists;
  if (!frOk) missing.push("slot_filing_receipt");

  return {
    ok: missing.length === 0,
    missing,
    signed,
    filingReceipt: { ok: fr?.status === "ok", path: frP || null, exists: frExists }
  };
}

export function registerPackageRoutes(app: express.Express, adminApp: typeof admin) {
  app.get("/v1/cases/:caseId/packages/validate", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
  
      const caseId = req.params.caseId;
      const cs = await caseRef(adminApp, caseId).get();
      if (!cs.exists) {
        logError({ endpoint: "/v1/cases/:caseId/packages/validate", caseId, code: "NOT_FOUND", messageKo: "케이스를 찾을 수 없습니다." });
        return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
      }
      const c = cs.data() as any;
  
      const canRead = isOps(auth) || c.ownerUid === auth.uid || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
      if (!canRead) {
        logError({ endpoint: "/v1/cases/:caseId/packages/validate", caseId, code: "FORBIDDEN", messageKo: "접근 권한이 없습니다." });
        return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
      }
  
      const casePackId = String(c.casePackId ?? "");
      const required = await requiredSlotsForStage(adminApp, { caseId, casePackId, stage: "draft_filing" as any });
      const signedSlots = required.filter((s) => String(s).endsWith("_signed"));
  
      const docsSnap = await adminApp.firestore().collection(`cases/${caseId}/documents`).get();
      const docs = docsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const bySlot = new Map<string, any>();
      for (const d of docs) bySlot.set(String(d.slotId), d);
  
      const bucket = adminApp.storage().bucket();
      const signed = [];
      for (const slotId of signedSlots) {
        const d = bySlot.get(String(slotId));
        const v = d?.latestVersionId ? d?.versions?.[d.latestVersionId] : null;
        const storagePath = v?.storagePath ? String(v.storagePath) : null;
        const fileName = v?.fileName ? String(v.fileName) : null;
        const status = d?.status ? String(d.status) : "missing";
  
        let exists = false;
        if (storagePath) {
          try {
            const [ok] = await bucket.file(storagePath).exists();
            exists = Boolean(ok);
          } catch {
            exists = false;
          }
        }
  
        signed.push({ slotId, status, fileName, storagePath, exists });
      }
  
      const receiptDoc = bySlot.get("slot_filing_receipt");
      const receiptV = receiptDoc?.latestVersionId ? receiptDoc?.versions?.[receiptDoc.latestVersionId] : null;
      const receiptPath = receiptV?.storagePath ? String(receiptV.storagePath) : null;
      const receiptName = receiptV?.fileName ? String(receiptV.fileName) : null;
      const receiptStatus = receiptDoc?.status ? String(receiptDoc.status) : "missing";
      let receiptExists = false;
      if (receiptPath) {
        try {
          const [ok] = await bucket.file(receiptPath).exists();
          receiptExists = Boolean(ok);
        } catch {
          receiptExists = false;
        }
      }
  
      const missing = signed.filter((x) => x.status !== "ok" || !x.storagePath || !x.exists).map((x) => x.slotId);
      const ok = missing.length === 0 && receiptStatus === "ok" && Boolean(receiptPath) && receiptExists;
  
      const evidenceId = `ev_${Date.now()}_${caseId.slice(-6)}`;
      await adminApp.firestore().collection("pilot_gate_evidence").doc(evidenceId).set({
        caseId,
        evidenceId,
        ok,
        status: ok ? "ok" : "fail",
        missing,
        signed,
        filingReceipt: { slotId: "slot_filing_receipt", status: receiptStatus, fileName: receiptName, storagePath: receiptPath, exists: receiptExists },
        validatedAt: adminApp.firestore.FieldValue.serverTimestamp(),
        actorUid: auth.uid,
        env: process.env.FUNCTIONS_EMULATOR === "true" ? "local" : "staging"
      });
  
      res.setHeader("Content-Type", "application/json");
      return res.status(200).send({
        ok: true,
        data: {
          ok,
          evidenceId,
          signed,
          filingReceipt: { slotId: "slot_filing_receipt", status: receiptStatus, fileName: receiptName, storagePath: receiptPath, exists: receiptExists },
          missing
        }
      });
    } catch (err: any) {
      const caseId = req.params.caseId || "unknown";
      logError({ endpoint: "/v1/cases/:caseId/packages/validate", caseId, code: "INTERNAL", messageKo: "검증 중 시스템 오류가 발생했습니다.", err });
      return fail(res, 500, "INTERNAL", "검증 중 시스템 오류가 발생했습니다.");
    }
  });
 
  // 제출 패키지 ZIP (접수증 + 생성 템플릿(DOCX) + 종료리포트(DOCX) + 메타데이터)
  app.get("/v1/cases/:caseId/packages/submission.zip", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;

      const caseId = req.params.caseId;
      const cs = await caseRef(adminApp, caseId).get();
      if (!cs.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
      const c = cs.data() as any;

      const canRead = isOps(auth) || c.ownerUid === auth.uid || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
      if (!canRead) return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

      const docsSnap = await adminApp.firestore().collection(`cases/${caseId}/documents`).get();
      const docs = docsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const bySlot = new Map<string, any>();
      for (const d of docs) bySlot.set(String(d.slotId), d);

      const zip = new JSZip();
      const validation = await validatePackageContents(adminApp, { caseId, casePackId: String(c.casePackId ?? "") });
      
      // 가장 최근 evidenceId 조회 (존재한다면)
      const evSnap = await adminApp.firestore().collection("pilot_gate_evidence")
        .where("caseId", "==", caseId)
        .orderBy("validatedAt", "desc")
        .limit(1)
        .get();
      const evidenceId = evSnap.empty ? null : evSnap.docs[0].id;
      
      zip.file("meta.json", JSON.stringify({ 
        caseId, 
        casePackId: c.casePackId ?? null, 
        generatedAt: new Date().toISOString(),
        evidenceId,
        validation 
      }, null, 2));

      // 종료 리포트
      const closing = await buildClosingReportDocx(adminApp, caseId, c);
      zip.file(`reports/closing_report_${caseId}.docx`, closing);

      // 제출 요약(접수 정보)
      const filingSummary = await buildFilingSummaryDocx(adminApp, caseId);
      zip.file(`reports/filing_summary_${caseId}.docx`, filingSummary);

      // 서명본 제출 현황(누락 체크)
      const signedReport = await buildSignedEvidenceReportDocx(adminApp, { caseId, casePackId: String(c.casePackId ?? "") });
      zip.file(`reports/signed_evidence_${caseId}.docx`, signedReport);

      // 템플릿: minutes / poa / application / acceptance / resignation
      for (const t of [
        { template: "minutes", slotId: "slot_minutes", file: "templates/minutes.docx" },
        { template: "poa", slotId: "slot_power_of_attorney", file: "templates/power_of_attorney.docx" },
        { template: "application", slotId: "slot_registration_application", file: "templates/registration_application.docx" },
        { template: "acceptance", slotId: "slot_acceptance_letter", file: "templates/acceptance_letter.docx" },
        { template: "resignation", slotId: "slot_resignation_letter", file: "templates/resignation_letter.docx" },
        { template: "rep_change", slotId: "slot_representative_change_statement", file: "templates/representative_change_statement.docx" }
      ]) {
        const d = bySlot.get(t.slotId);
        const v = d?.latestVersionId ? d?.versions?.[d.latestVersionId] : null;
        const md = v?.generatedContentKo;
        const input = v?.templateInput ?? null;
        if (t.template === "minutes" && (md || input)) {
          zip.file(t.file, await minutesDocxBuffer(input ?? {}));
        } else if (t.template === "poa" && (md || input)) {
          zip.file(t.file, await poaDocxBuffer(input ?? {}));
        } else if (t.template === "application" && (md || input)) {
          const packId = String(c.casePackId ?? "");
          const slotsA = await requiredSlotsForStage(adminApp, { caseId, casePackId: packId, stage: "docs_review" as any });
          const slotsB = await requiredSlotsForStage(adminApp, { caseId, casePackId: packId, stage: "draft_filing" as any });
          const slots = Array.from(new Set([...slotsA, ...slotsB]));
          const statusKoOf = (s: string) =>
            s === "ok" ? "완료" : s === "needs_fix" ? "보완 필요" : s === "uploaded" ? "검토 필요" : s === "uploading" ? "업로드 중" : "미제출";
          const attachments = slots.map((slotId) => {
            const d0 = bySlot.get(String(slotId));
            const st = d0 ? String(d0.status ?? "") : "missing";
            return { slotId, titleKo: getSlotTitleKo(packId, String(slotId)) ?? String(slotId), status: st, statusKo: statusKoOf(st) };
          });
          zip.file(t.file, await applicationDocxBuffer({ ...(input ?? {}), _attachments: attachments }));
        } else if (t.template === "acceptance" && (md || input)) {
          zip.file(t.file, await acceptanceDocxBuffer(input ?? {}));
        } else if (t.template === "resignation" && (md || input)) {
          zip.file(t.file, await resignationDocxBuffer(input ?? {}));
        } else if (t.template === "rep_change" && (md || input)) {
          zip.file(t.file, await repChangeDocxBuffer(input ?? {}));
        } else if (md) {
          zip.file(t.file, await markdownToDocxBuffer(String(md)));
        } else {
          zip.file(t.file.replace(".docx", ".txt"), `템플릿이 생성되지 않았습니다: ${t.template}`);
        }
      }

      // 업무 증빙(체크리스트/태스크)
      const proof = await buildWorkflowProofDocx(adminApp, caseId);
      zip.file(`reports/workflow_proof_${caseId}.docx`, proof);

      // 접수증(원본 파일)
      const receiptDoc = bySlot.get("slot_filing_receipt");
      const receiptV = receiptDoc?.latestVersionId ? receiptDoc?.versions?.[receiptDoc.latestVersionId] : null;
      const receiptPath = receiptV?.storagePath;
      const receiptName = receiptV?.fileName || "filing_receipt";
      if (receiptPath) {
        try {
          const bucket = adminApp.storage().bucket();
          const [buf] = await bucket.file(String(receiptPath)).download();
          zip.file(`filing/${receiptName}`, buf);
        } catch (e: any) {
          zip.file("filing/receipt_download_failed.txt", `접수증 다운로드 실패: ${String(e?.message || e)}`);
        }
      } else {
        zip.file("filing/receipt_missing.txt", "접수증이 업로드되지 않았습니다.");
      }

      // 서명본(원본 파일) 포함
      for (const s of [
        "slot_minutes_signed",
        "slot_power_of_attorney_signed",
        "slot_registration_application_signed",
        "slot_acceptance_letter_signed",
        "slot_resignation_letter_signed"
      ]) {
        const d = bySlot.get(s);
        const v = d?.latestVersionId ? d?.versions?.[d.latestVersionId] : null;
        const p = v?.storagePath;
        const name = v?.fileName || `${s}.pdf`;
        if (!p) {
          zip.file(`signed/${s}_missing.txt`, `서명본이 업로드되지 않았습니다: ${s}`);
          continue;
        }
        try {
          const bucket = adminApp.storage().bucket();
          const [buf] = await bucket.file(String(p)).download();
          zip.file(`signed/${name}`, buf);
        } catch (e: any) {
          zip.file(`signed/${s}_download_failed.txt`, `서명본 다운로드 실패: ${String(e?.message || e)}`);
        }
      }

      const out = await zip.generateAsync({ type: "nodebuffer" });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="submission_package_${caseId}.zip"`);
      return res.status(200).send(out);
    } catch (err: any) {
      console.error("ZIP Generation Failed:", err);
      return fail(res, 500, "INTERNAL", `패키지 생성 중 오류가 발생했습니다: ${err.message || "알 수 없는 오류"}`);
    }
  });

  // 운영 재시도 엔드포인트 (submission.zip 재생성)
  app.post("/v1/ops/cases/:caseId/packages/regenerate", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) {
        logError({ endpoint: "/v1/ops/cases/:caseId/packages/regenerate", caseId: req.params.caseId, code: "FORBIDDEN", messageKo: "운영자만 접근 가능합니다." });
        return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      }
      const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_operator", undefined);
      if (!hasRole) return;

      const caseId = req.params.caseId;
      const cs = await caseRef(adminApp, caseId).get();
      if (!cs.exists) {
        logError({ endpoint: "/v1/ops/cases/:caseId/packages/regenerate", caseId, code: "NOT_FOUND", messageKo: "케이스를 찾을 수 없습니다." });
        return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
      }

      // 실제로는 별도의 큐나 비동기 워크플로우를 트리거할 수 있지만, 
      // MVP에서는 즉시 생성 여부를 테스트하는 것으로 대체
      const validation = await validatePackageContents(adminApp, { caseId, casePackId: String(cs.data()?.casePackId ?? "") });
      
      return res.status(200).send({
        ok: true,
        data: {
          messageKo: "패키지 재생성(또는 검증)이 완료되었습니다.",
          validation
        }
      });
    } catch (err: any) {
      const caseId = req.params.caseId || "unknown";
      logError({ endpoint: "/v1/ops/cases/:caseId/packages/regenerate", caseId, code: "INTERNAL", messageKo: "재생성 실패", err });
      console.error("Regenerate Failed:", err);
      return fail(res, 500, "INTERNAL", `재생성 실패: ${err.message || "알 수 없는 오류"}`);
    }
  });
}
