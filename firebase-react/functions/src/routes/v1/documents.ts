import type express from "express";
import type * as admin from "firebase-admin";
import crypto from "node:crypto";

import { requireAuth, isOps, partnerIdOf } from "../../lib/auth";
import { fail, ok } from "../../lib/http";
import { withIdempotency } from "../../lib/idempotency";
import { caseRef } from "../../lib/firestore";
import { writeTimelineEvent } from "../../lib/timeline";
import { decideCaseStatusByDocumentComplete, decideCaseStatusByDocumentReview, type CaseStatus } from "../../lib/case_status";
import { resolveReviewIssues } from "../../lib/doc_review";
import { workflowRef } from "../../lib/workflow";
import { getCasePackConfig, getSlotTitleKo, isKnownSlot } from "../../lib/casepack";
import { ensureTask, setTaskStatus } from "../../lib/tasks";
import { nextStage, requiredSlotsForStage, validateStagePrerequisites } from "../../lib/workflow";
import { tryAutoAdvanceAfterDraftFiling, tryAutoCompleteAfterFiling } from "../../lib/workflow_auto";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { officerChangeFormRef } from "../../lib/forms";

function docRef(adminApp: typeof admin, caseId: string, documentId: string) {
  return adminApp.firestore().doc(`cases/${caseId}/documents/${documentId}`);
}

type DocumentStatus = "uploading" | "uploaded" | "needs_fix" | "ok";

export function registerDocumentRoutes(app: express.Express, adminApp: typeof admin) {
  // 업로드 인텐트 발급(서버가 메타/식별자 생성)
  app.post("/v1/cases/:caseId/documents/upload-intent", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const { slotId, fileName, mimeType, sizeBytes } = req.body ?? {};
    if (!slotId || !fileName || !mimeType) return fail(res, 400, "INVALID_ARGUMENT", "slotId/fileName/mimeType가 필요합니다.");

    const cSnap = await caseRef(adminApp, caseId).get();
    if (!cSnap.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cSnap.data() as any;
    const canUpload = isOps(auth) || c.ownerUid === auth.uid || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canUpload) return fail(res, 403, "FORBIDDEN", "문서 업로드 권한이 없습니다.");
    if (!isKnownSlot(String(c.casePackId), String(slotId))) {
      return fail(res, 400, "INVALID_ARGUMENT", "등록되지 않은 문서 슬롯입니다.");
    }

    const result = await withIdempotency(adminApp, req, res, "documents.upload_intent", async () => {
      const documentId = crypto.randomUUID();
      const versionId = crypto.randomUUID();
      const now = adminApp.firestore.FieldValue.serverTimestamp();
      const storagePath = `cases/${caseId}/documents/${documentId}/${versionId}`;

      await docRef(adminApp, caseId, documentId).set({
        caseId,
        documentId,
        ownerUid: c.ownerUid,
        partnerId: c.partnerId,
        slotId: String(slotId),
        status: "uploading" as DocumentStatus,
        latestVersionId: versionId,
        versions: {
          [versionId]: {
            versionId,
            fileName: String(fileName),
            mimeType: String(mimeType),
            sizeBytes: Number(sizeBytes ?? 0),
            storagePath,
            kind: "initial",
            status: "uploading",
            createdAt: now
          }
        },
        createdByUid: auth.uid,
        createdAt: now,
        updatedAt: now
      });

      return { documentId, versionId, storagePath };
    });

    if (!result) return;
    return ok(res, result);
  });

  // 문서 목록(케이스 참여자)
  app.get("/v1/cases/:caseId/documents", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const cSnap = await caseRef(adminApp, caseId).get();
    if (!cSnap.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cSnap.data() as any;
    const canRead = isOps(auth) || c.ownerUid === auth.uid || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canRead) return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    const snap = await adminApp
      .firestore()
      .collection(`cases/${caseId}/documents`)
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  function renderMinutesTemplateKo(input: any) {
    const companyName = String(input?.companyName ?? "회사명");
    const meetingDate = String(input?.meetingDate ?? "2026-01-01");
    const resolutionKo = String(input?.resolutionKo ?? "임원 변경의 건");
    return `# ${companyName} 의사록/결의서(초안)\n\n- 일자: ${meetingDate}\n- 안건: ${resolutionKo}\n\n## 결의 내용\n${resolutionKo}\n\n## 서명/날인\n(서명/날인란)\n`;
  }

  function renderPoaTemplateKo(input: any) {
    const principalName = String(input?.principalName ?? "위임인");
    const agentName = String(input?.agentName ?? "수임인(법무사)");
    const scopeKo = String(input?.scopeKo ?? "임원 변경 등기 신청 관련 일체");
    return `# 위임장(초안)\n\n- 위임인: ${principalName}\n- 수임인: ${agentName}\n- 위임 범위: ${scopeKo}\n\n## 서명/날인\n(서명/날인란)\n`;
  }

  function renderApplicationTemplateKo(input: any) {
    const companyName = String(input?.companyName ?? "회사명");
    const meetingDate = String(input?.meetingDate ?? "2026-01-01");
    const officers = Array.isArray(input?.officers) ? input.officers : [];
    const appointed = officers.filter((o: any) => String(o.changeType) === "appoint" || String(o.changeType) === "reappoint");
    const resigned = officers.filter((o: any) => String(o.changeType) === "resign");
    return `# 등기신청서(초안)\n\n- 법인명: ${companyName}\n- 결의일: ${meetingDate}\n\n## 신청 취지\n임원 변경 등기 신청\n\n## 변경 내역\n### 선임/중임\n${appointed.map((o: any) => `- ${o.roleKo} ${o.nameKo} (효력일 ${o.effectiveDate})`).join("\n") || "- 없음"}\n\n### 사임\n${resigned.map((o: any) => `- ${o.roleKo} ${o.nameKo} (효력일 ${o.effectiveDate})`).join("\n") || "- 없음"}\n`;
  }

  function renderAcceptanceTemplateKo(input: any) {
    const companyName = String(input?.companyName ?? "회사명");
    const officers = Array.isArray(input?.officers) ? input.officers : [];
    const targets = officers.filter((o: any) => ["appoint", "reappoint"].includes(String(o.changeType)));
    return `# 취임승낙서(초안)\n\n법인명: ${companyName}\n\n## 취임승낙 대상\n${targets.map((o: any) => `- ${o.roleKo} ${o.nameKo} (효력일 ${o.effectiveDate})`).join("\n") || "- 없음"}\n\n본인은 위 직위에 취임함을 승낙합니다.\n\n서명/날인: ____________________\n`;
  }

  function renderResignationTemplateKo(input: any) {
    const companyName = String(input?.companyName ?? "회사명");
    const officers = Array.isArray(input?.officers) ? input.officers : [];
    const targets = officers.filter((o: any) => String(o.changeType) === "resign");
    return `# 사임서(초안)\n\n법인명: ${companyName}\n\n## 사임 대상\n${targets.map((o: any) => `- ${o.roleKo} ${o.nameKo} (효력일 ${o.effectiveDate})`).join("\n") || "- 없음"}\n\n본인은 위 직위에서 사임합니다.\n\n서명/날인: ____________________\n`;
  }

  function renderRepChangeTemplateKo(input: any) {
    const companyName = String(input?.companyName ?? "회사명");
    const meetingDate = String(input?.meetingDate ?? "2026-01-01");
    const officers = Array.isArray(input?.officers) ? input.officers : [];
    const reps = officers.filter((o: any) => (o?.isRepresentative === true || String(o?.roleKo ?? "").includes("대표")) && ["appoint", "reappoint", "resign"].includes(String(o?.changeType)));
    return `# 대표이사 변경 확인서(초안)\n\n법인명: ${companyName}\n결의일: ${meetingDate}\n\n## 변경 대상\n${reps.map((o: any) => `- ${o.roleKo} ${o.nameKo} (${o.changeType}, 효력일 ${o.effectiveDate})`).join("\n") || "- 없음"}\n\n본 확인서는 대표이사 변경과 관련하여 제출 서류의 사실관계를 확인하기 위해 작성되었습니다.\n\n서명/날인: ____________________\n`;
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
    children.push(tableFromRows([
      ["항목", "내용"],
      ["일자", meetingDate],
      ["안건", "임원 변경의 건"]
    ]));
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
    const companyName = String(input?.companyName ?? "");
    const officers = Array.isArray(input?.officers) ? input.officers : [];

    const children: any[] = [];
    children.push(new Paragraph({ text: "위임장", heading: HeadingLevel.HEADING_1 }));
    if (companyName) children.push(new Paragraph({ text: companyName, heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: "" }));
    children.push(tableFromRows([
      ["항목", "내용"],
      ["위임인", principalName],
      ["수임인", agentName],
      ["위임 범위", scopeKo]
    ]));
    children.push(new Paragraph({ text: "" }));
    if (officers.length > 0) {
      children.push(new Paragraph({ text: "변경 임원(참고)", heading: HeadingLevel.HEADING_2 }));
      const rows: string[][] = [["성명", "직위", "구분", "효력일"]];
      for (const o of officers.slice(0, 20)) {
        const ct = String(o.changeType || "");
        const ctKo = ct === "appoint" ? "선임" : ct === "resign" ? "사임" : ct === "reappoint" ? "중임" : ct;
        rows.push([String(o.nameKo ?? ""), String(o.roleKo ?? ""), ctKo, String(o.effectiveDate ?? "")]);
      }
      children.push(tableFromRows(rows));
      children.push(new Paragraph({ text: "" }));
    }
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
    children.push(tableFromRows([
      ["항목", "내용"],
      ["신청 취지", "임원 변경 등기 신청"],
      ["결의일", meetingDate]
    ]));
    children.push(new Paragraph({ text: "" }));

    children.push(new Paragraph({ text: "변경 내역", heading: HeadingLevel.HEADING_2 }));
    const rows: string[][] = [["구분", "직위", "성명", "효력일", "비고"]];
    for (const o of appointed) {
      const ct = String(o.changeType || "");
      const ctKo = ct === "appoint" ? "선임" : "중임";
      rows.push([ctKo, String(o.roleKo ?? ""), String(o.nameKo ?? ""), String(o.effectiveDate ?? ""), o.isRepresentative ? "대표" : ""]);
    }
    for (const o of resigned) {
      rows.push(["사임", String(o.roleKo ?? ""), String(o.nameKo ?? ""), String(o.effectiveDate ?? ""), o.isRepresentative ? "대표" : ""]);
    }
    if (rows.length === 1) rows.push(["-", "-", "-", "-", "-"]);
    children.push(tableFromRows(rows));
    children.push(new Paragraph({ text: "" }));

    children.push(new Paragraph({ text: "첨부서류", heading: HeadingLevel.HEADING_2 }));
    // export 엔드포인트에서 실제 상태를 주입할 수 있게 placeholder 유지(없는 경우 예시로 표시)
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
    children.push(tableFromRows([
      ["항목", "내용"],
      ["결의일", meetingDate],
      ["목적", "대표이사 변경 관련 사실 확인"]
    ]));
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

  // 파트너/ops: 등기 서류 템플릿 생성(초안) - 서버가 "generated 문서"로 기록
  app.post("/v1/cases/:caseId/templates/generate", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const { template, input } = req.body ?? {};
    const templateType = String(template || "");
    if (!templateType) return fail(res, 400, "INVALID_ARGUMENT", "template가 필요합니다.");

    const cSnap = await caseRef(adminApp, caseId).get();
    if (!cSnap.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cSnap.data() as any;
    const canWrite = isOps(auth) || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canWrite) return fail(res, 403, "FORBIDDEN", "권한이 없습니다.");

    const packId = String(c.casePackId ?? "");
    const slotId =
      templateType === "minutes"
        ? "slot_minutes"
        : templateType === "poa"
          ? "slot_power_of_attorney"
          : templateType === "application"
            ? "slot_registration_application"
            : templateType === "acceptance"
              ? "slot_acceptance_letter"
              : templateType === "resignation"
                ? "slot_resignation_letter"
                : templateType === "rep_change"
                  ? "slot_representative_change_statement"
                : null;
    if (!slotId) return fail(res, 400, "INVALID_ARGUMENT", "지원하지 않는 template 입니다.");

    // input 미제공 시, 케이스 폼 값으로 보완(법무사 실무용)
    let mergedInput = input ?? null;
    if (!mergedInput) {
      const fSnap = await officerChangeFormRef(adminApp, caseId).get();
      if (fSnap.exists) mergedInput = fSnap.data() as any;
    }
    const contentKo =
      templateType === "minutes"
        ? renderMinutesTemplateKo(mergedInput)
        : templateType === "poa"
          ? renderPoaTemplateKo(mergedInput)
          : templateType === "application"
            ? renderApplicationTemplateKo(mergedInput)
            : templateType === "acceptance"
              ? renderAcceptanceTemplateKo(mergedInput)
              : templateType === "resignation"
                ? renderResignationTemplateKo(mergedInput)
                : renderRepChangeTemplateKo(mergedInput);
    const fileName = `${templateType}_${new Date().toISOString().slice(0, 10)}.md`;
    const documentId = `gen_${slotId}`; // 중복 방지(슬롯당 1개 문서, 버전만 증가)

    const result = await withIdempotency(adminApp, req, res, "templates.generate", async () => {
      const now = adminApp.firestore.FieldValue.serverTimestamp();
      const versionId = crypto.randomUUID();

      await docRef(adminApp, caseId, documentId).set(
        {
          caseId,
          documentId,
          ownerUid: c.ownerUid,
          partnerId: c.partnerId,
          slotId,
          // 생성된 초안은 곧바로 "제출 완료"로 보지 않고, 서명/날인 확보 + 검토 OK가 필요함
          status: "uploaded" as DocumentStatus,
          latestVersionId: versionId,
          versions: {
            [versionId]: {
              versionId,
              fileName,
              mimeType: "text/markdown",
              sizeBytes: contentKo.length,
              storagePath: null,
              kind: "generated",
              status: "uploaded",
              template: templateType,
              templateInput: mergedInput ?? null,
              generatedContentKo: contentKo,
              createdAt: now,
              completedAt: now
            }
          },
          createdByUid: auth.uid,
          createdAt: now,
          updatedAt: now
        },
        { merge: true }
      );

      const slotTitle = getSlotTitleKo(packId, slotId) ?? slotId;
      const signTaskId = `sign_${slotId}`;
      await ensureTask(adminApp, {
        caseId,
        taskId: signTaskId,
        partnerId: String(c.partnerId),
        titleKo: `${slotTitle} 서명/날인 확보`,
        type: "signature_collect"
      });

      const eventId = crypto.randomUUID();
      await writeTimelineEvent(adminApp, caseId, eventId, {
        type: "TEMPLATE_GENERATED",
        occurredAt: now,
        actor: isOps(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
        summaryKo: "서류 템플릿(초안)이 생성되었습니다.",
        meta: { template: templateType, slotId, documentId, versionId }
      });

      return { documentId, versionId };
    });

    if (!result) return;
    return ok(res, result);
  });

  // 파트너/ops: 생성된 템플릿 DOCX로 내보내기(다운로드)
  app.get("/v1/cases/:caseId/templates/:template/export.docx", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const templateType = String(req.params.template || "");
    const cSnap = await caseRef(adminApp, caseId).get();
    if (!cSnap.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cSnap.data() as any;
    const canRead = isOps(auth) || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canRead) return fail(res, 403, "FORBIDDEN", "권한이 없습니다.");

    const slotId =
      templateType === "minutes"
        ? "slot_minutes"
        : templateType === "poa"
          ? "slot_power_of_attorney"
          : templateType === "application"
            ? "slot_registration_application"
            : templateType === "acceptance"
              ? "slot_acceptance_letter"
              : templateType === "resignation"
                ? "slot_resignation_letter"
                : templateType === "rep_change"
                  ? "slot_representative_change_statement"
                : null;
    if (!slotId) return fail(res, 400, "INVALID_ARGUMENT", "지원하지 않는 template 입니다.");

    const documentId = `gen_${slotId}`;
    const snap = await docRef(adminApp, caseId, documentId).get();
    if (!snap.exists) return fail(res, 404, "NOT_FOUND", "생성된 템플릿 문서를 찾을 수 없습니다.");
    const d = snap.data() as any;
    const v = d.versions?.[d.latestVersionId];
    const md = v?.generatedContentKo;
    const input = v?.templateInput ?? null;

    let buf: Buffer;
    if (templateType === "minutes") {
      buf = await minutesDocxBuffer(input ?? {});
    } else if (templateType === "poa") {
      buf = await poaDocxBuffer(input ?? {});
    } else if (templateType === "application") {
      // 첨부서류 목록을 실제 슬롯/상태 기반으로 구성(문서 작업 품질)
      const packId = String(c.casePackId ?? "");
      const slotsA = await requiredSlotsForStage(adminApp, { caseId, casePackId: packId, stage: "docs_review" as any });
      const slotsB = await requiredSlotsForStage(adminApp, { caseId, casePackId: packId, stage: "draft_filing" as any });
      const slots = Array.from(new Set([...slotsA, ...slotsB]));
      const docsSnap = await adminApp.firestore().collection(`cases/${caseId}/documents`).get();
      const docs = docsSnap.docs.map((d0) => d0.data() as any);
      const bySlot = new Map<string, any>();
      for (const d0 of docs) bySlot.set(String(d0.slotId), d0);
      const statusKoOf = (s: string) =>
        s === "ok" ? "완료" : s === "needs_fix" ? "보완 필요" : s === "uploaded" ? "검토 필요" : s === "uploading" ? "업로드 중" : "미제출";
      const attachments = slots.map((slotId) => {
        const d0 = bySlot.get(String(slotId));
        const st = d0 ? String(d0.status ?? "") : "missing";
        return { slotId, titleKo: getSlotTitleKo(packId, String(slotId)) ?? String(slotId), status: st, statusKo: statusKoOf(st) };
      });
      buf = await applicationDocxBuffer({ ...(input ?? {}), _attachments: attachments });
    } else if (templateType === "acceptance") {
      buf = await acceptanceDocxBuffer(input ?? {});
    } else if (templateType === "resignation") {
      buf = await resignationDocxBuffer(input ?? {});
    } else if (templateType === "rep_change") {
      buf = await repChangeDocxBuffer(input ?? {});
    } else if (md) {
      // fallback
      buf = await markdownToDocxBuffer(String(md));
    } else {
      return fail(res, 404, "NOT_FOUND", "생성된 템플릿 콘텐츠가 없습니다.");
    }

    const fileName = `${templateType}_${caseId}.docx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(buf);
  });

  // 보완 제출(새 버전 생성)
  app.post("/v1/cases/:caseId/documents/:documentId/submit-fix", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const documentId = req.params.documentId;
    const { fileName, mimeType, sizeBytes } = req.body ?? {};
    if (!fileName || !mimeType) return fail(res, 400, "INVALID_ARGUMENT", "fileName/mimeType가 필요합니다.");

    const cSnap = await caseRef(adminApp, caseId).get();
    if (!cSnap.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cSnap.data() as any;
    if (!(isOps(auth) || c.ownerUid === auth.uid)) return fail(res, 403, "FORBIDDEN", "사용자만 보완 제출할 수 있습니다.");

    const result = await withIdempotency(adminApp, req, res, "documents.submit_fix", async () => {
      const ref = docRef(adminApp, caseId, documentId);
      const snap = await ref.get();
      if (!snap.exists) throw new Error("NOT_FOUND");
      const d = snap.data() as any;

      const versionId = crypto.randomUUID();
      const now = adminApp.firestore.FieldValue.serverTimestamp();
      const storagePath = `cases/${caseId}/documents/${documentId}/${versionId}`;

      await ref.set(
        {
          status: "uploading",
          latestVersionId: versionId,
          versions: {
            [versionId]: {
              versionId,
              fileName: String(fileName),
              mimeType: String(mimeType),
              sizeBytes: Number(sizeBytes ?? 0),
              storagePath,
              kind: "fix",
              status: "uploading",
              createdAt: now
            }
          },
          updatedAt: now
        },
        { merge: true }
      );

      const eventId = crypto.randomUUID();
      await writeTimelineEvent(adminApp, caseId, eventId, {
        type: "FIX_SUBMITTED",
        occurredAt: now,
        actor: { type: "user", uid: auth.uid },
        summaryKo: "문서 보완이 제출되었습니다.",
        meta: { documentId, versionId, slotId: d.slotId }
      });

      return { documentId, versionId, storagePath };
    }).catch((e: any) => {
      if (String(e?.message) === "NOT_FOUND") {
        fail(res, 404, "NOT_FOUND", "문서를 찾을 수 없습니다.");
        return null;
      }
      fail(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
      return null;
    });

    if (!result) return;
    return ok(res, result);
  });

  // 업로드 완료 확정(무결성/타임라인)
  app.post("/v1/cases/:caseId/documents/:documentId/versions/:versionId/complete", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const documentId = req.params.documentId;
    const versionId = req.params.versionId;
    const { sha256, sizeBytes } = req.body ?? {};
    if (!sha256) return fail(res, 400, "INVALID_ARGUMENT", "sha256가 필요합니다.");

    const cSnap = await caseRef(adminApp, caseId).get();
    if (!cSnap.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cSnap.data() as any;
    const canUpload = isOps(auth) || c.ownerUid === auth.uid || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canUpload) return fail(res, 403, "FORBIDDEN", "권한이 없습니다.");

    const result = await withIdempotency(adminApp, req, res, "documents.complete", async () => {
      const ref = docRef(adminApp, caseId, documentId);
      const now = adminApp.firestore.FieldValue.serverTimestamp();

      const txResult = await adminApp.firestore().runTransaction(async (tx) => {
        const [docSnap, caseSnap] = await Promise.all([tx.get(ref), tx.get(caseRef(adminApp, caseId))]);
        if (!docSnap.exists) throw new Error("NOT_FOUND");
        if (!caseSnap.exists) throw new Error("CASE_NOT_FOUND");
        const d = docSnap.data() as any;
        const cs = caseSnap.data() as any;
        const v = d.versions?.[versionId];
        if (!v) throw new Error("INVALID_ARGUMENT:versionId를 찾을 수 없습니다.");

        const fromCaseStatus = String(cs.status || "new") as CaseStatus;
        const toCaseStatus = decideCaseStatusByDocumentComplete(fromCaseStatus);

        tx.set(
          ref,
          {
            status: "uploaded",
            latestVersionId: versionId,
            versions: {
              [versionId]: {
                ...v,
                sha256: String(sha256),
                sizeBytes: Number(sizeBytes ?? v.sizeBytes ?? 0),
                status: "uploaded",
                completedAt: now
              }
            },
            updatedAt: now
          },
          { merge: true }
        );

        if (toCaseStatus && toCaseStatus !== fromCaseStatus) {
          tx.set(
            caseRef(adminApp, caseId),
            {
              status: toCaseStatus,
              updatedAt: now,
              summary: {
                ...(cs.summary ?? {}),
                lastEventKo: "보완 제출 완료"
              }
            },
            { merge: true }
          );
        }

        return { d, v, fromCaseStatus, toCaseStatus };
      });

      // 타임라인
      const eventId = crypto.randomUUID();
      await writeTimelineEvent(adminApp, caseId, eventId, {
        type: "DOCUMENT_UPLOADED",
        occurredAt: now,
        actor: c.ownerUid === auth.uid ? { type: "user", uid: auth.uid } : (partnerIdOf(auth) ? { type: "partner", partnerId: c.partnerId, uid: auth.uid } : { type: "ops", uid: auth.uid }),
        summaryKo: "문서가 업로드되었습니다.",
        meta: { documentId, versionId, slotId: txResult.d.slotId, mimeType: txResult.v.mimeType, sizeBytes: Number(sizeBytes ?? txResult.v.sizeBytes ?? 0) }
      });

      if (txResult.toCaseStatus && txResult.toCaseStatus !== txResult.fromCaseStatus) {
        const eventId2 = crypto.randomUUID();
        await writeTimelineEvent(adminApp, caseId, eventId2, {
          type: "CASE_STATUS_CHANGED",
          occurredAt: now,
          actor: { type: "user", uid: auth.uid },
          summaryKo: "케이스 상태가 변경되었습니다.",
          meta: { from: txResult.fromCaseStatus, to: txResult.toCaseStatus, by: "document_complete", documentId }
        });
      }

      return { status: "uploaded", documentId, versionId, caseStatus: txResult.toCaseStatus ?? txResult.fromCaseStatus };
    }).catch((e: any) => {
      const msg = String(e?.message || e);
      if (msg === "NOT_FOUND") {
        fail(res, 404, "NOT_FOUND", "문서를 찾을 수 없습니다.");
        return null;
      }
      if (msg === "CASE_NOT_FOUND") {
        fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
        return null;
      }
      if (msg.startsWith("INVALID_ARGUMENT:")) {
        fail(res, 400, "INVALID_ARGUMENT", msg.replace("INVALID_ARGUMENT:", ""));
        return null;
      }
      fail(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
      return null;
    });

    if (!result) return;
    return ok(res, result);
  });

  // 파트너: 문서 검토
  app.post("/v1/cases/:caseId/documents/:documentId/review", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;

    const caseId = req.params.caseId;
    const documentId = req.params.documentId;
    const { decision, issueSummariesKo, issueCodes } = req.body ?? {};
    if (decision !== "ok" && decision !== "needs_fix") return fail(res, 400, "INVALID_ARGUMENT", "decision(ok|needs_fix)가 필요합니다.");

    const cSnap = await caseRef(adminApp, caseId).get();
    if (!cSnap.exists) return fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
    const c = cSnap.data() as any;
    const canReview = isOps(auth) || (partnerIdOf(auth) && c.partnerId === partnerIdOf(auth));
    if (!canReview) return fail(res, 403, "FORBIDDEN", "문서 검토 권한이 없습니다.");

    const result = await withIdempotency(adminApp, req, res, "documents.review", async () => {
      const ref = docRef(adminApp, caseId, documentId);
      const now = adminApp.firestore.FieldValue.serverTimestamp();
      const status: DocumentStatus = decision === "ok" ? "ok" : "needs_fix";

      // 1) 문서/케이스 상태를 트랜잭션으로 정합성 있게 갱신
      const txResult = await adminApp.firestore().runTransaction(async (tx) => {
        const [docSnap, caseSnap, wfSnap] = await Promise.all([
          tx.get(ref),
          tx.get(caseRef(adminApp, caseId)),
          tx.get(workflowRef(adminApp, caseId))
        ]);
        if (!docSnap.exists) throw new Error("NOT_FOUND");
        if (!caseSnap.exists) throw new Error("CASE_NOT_FOUND");

        const d = docSnap.data() as any;
        const cs = caseSnap.data() as any;
        const fromCaseStatus = String(cs.status || "new") as CaseStatus;
        const toCaseStatus = decideCaseStatusByDocumentReview(fromCaseStatus, decision);

        const codes = Array.isArray(issueCodes) ? issueCodes.map(String).filter(Boolean).slice(0, 10) : [];
        const resolved = decision === "needs_fix"
          ? resolveReviewIssues({ casePackId: String(cs.casePackId ?? c.casePackId), slotId: String(d.slotId), issueCodes: codes })
          : { ok: true as const, issues: [] as any[] };
        if (!resolved.ok) throw new Error(`INVALID_ARGUMENT:${resolved.reasonKo}`);

        // 1.5) 워크플로우 체크리스트 자동 연결(문서 OK -> 체크리스트 자동 체크)
        // v1: docs_review 단계
        // - slot_id_card OK => chk_id_card_legible
        // - slot_corp_registry OK => chk_registry_recent
        // filing_submitted 단계
        // - slot_filing_receipt OK => chk_submission_receipt
        if (wfSnap.exists) {
          const wf = wfSnap.data() as any;
          const stage = String(wf.stage || "intake");
          const patch: Record<string, boolean> = {};
          const slotId = String(d.slotId);
          if (stage === "docs_review") {
            if (slotId === "slot_id_card") patch["chk_id_card_legible"] = decision === "ok";
            if (slotId === "slot_corp_registry") patch["chk_registry_recent"] = decision === "ok";
          }
          if (stage === "filing_submitted") {
            if (slotId === "slot_filing_receipt") patch["chk_submission_receipt"] = decision === "ok";
          }
          if (Object.keys(patch).length > 0) {
            tx.set(workflowRef(adminApp, caseId), { checklist: patch, updatedAt: now }, { merge: true });
          }
        }

        tx.set(
          ref,
          {
            status,
            reviewedByUid: auth.uid,
            reviewedAt: now,
            review: {
              decision,
              issueCodes: codes,
              issues: resolved.issues ?? [],
              issueCount: Array.isArray(issueSummariesKo) ? issueSummariesKo.length : 0,
              issueSummariesKo: Array.isArray(issueSummariesKo) ? issueSummariesKo.slice(0, 3) : []
            },
            updatedAt: now
          },
          { merge: true }
        );

        if (toCaseStatus && toCaseStatus !== fromCaseStatus) {
          tx.set(
            caseRef(adminApp, caseId),
            {
              status: toCaseStatus,
              updatedAt: now,
              summary: {
                ...(cs.summary ?? {}),
                lastEventKo: decision === "needs_fix" ? "문서 보완 요청" : "문서 승인"
              }
            },
            { merge: true }
          );
        }

        return { d, fromCaseStatus, toCaseStatus };
      });

      // 2) 타임라인 기록(트랜잭션 밖)
      const issueCount = Array.isArray(issueSummariesKo) ? issueSummariesKo.length : 0;
      const issueSummariesKoTop = Array.isArray(issueSummariesKo) ? issueSummariesKo.slice(0, 3) : [];

      const eventId = crypto.randomUUID();
      await writeTimelineEvent(adminApp, caseId, eventId, {
        type: decision === "ok" ? "DOCUMENT_REVIEWED_OK" : "DOCUMENT_REVIEWED_NEEDS_FIX",
        occurredAt: now,
        actor: isOps(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
        summaryKo: decision === "ok" ? "문서가 승인되었습니다." : "문서 보완이 필요합니다.",
        meta: {
          documentId,
          slotId: txResult.d.slotId,
          issueCount,
          issueSummariesKo: issueSummariesKoTop,
          issueCodes: Array.isArray(issueCodes) ? issueCodes.map(String).filter(Boolean).slice(0, 10) : []
        }
      });

      if (txResult.toCaseStatus && txResult.toCaseStatus !== txResult.fromCaseStatus) {
        const eventId2 = crypto.randomUUID();
        await writeTimelineEvent(adminApp, caseId, eventId2, {
          type: "CASE_STATUS_CHANGED",
          occurredAt: now,
          actor: isOps(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
          summaryKo: "케이스 상태가 변경되었습니다.",
          meta: { from: txResult.fromCaseStatus, to: txResult.toCaseStatus, by: "document_review", documentId }
        });
      }

      // 3) 태스크 자동 연결(보완요청/해제)
      // - needs_fix: 해당 문서 보완 관련 태스크를 open으로 생성(중복 방지: 안정적인 taskId 사용)
      // - ok: 동일 태스크가 있으면 done 처리
      const slotId = String(txResult.d.slotId);
      const packId = String(c.casePackId ?? "");
      const cfg = getCasePackConfig(packId);
      const slotTitle = (cfg?.slotTitlesKo as any)?.[slotId] ?? slotId;
      const fixTaskId = `docfix_${documentId}`;
      if (decision === "needs_fix") {
        await ensureTask(adminApp, {
          caseId,
          taskId: fixTaskId,
          partnerId: String(c.partnerId),
          titleKo: `${slotTitle} 보완 요청 처리`,
          type: "document_fix"
        });
      } else {
        await setTaskStatus(adminApp, { caseId, taskId: fixTaskId, status: "done" });
      }

      // 3.5) 생성 템플릿(서명/날인 확보) 태스크 자동 완료 처리
      // - templates.generate에서 sign_{slotId}를 open으로 만들었고,
      // - v2: "서명본(slot_*_signed)"이 ok일 때 sign 태스크를 done 처리한다.
      const baseToSigned: Record<string, string> = {
        slot_minutes: "slot_minutes_signed",
        slot_power_of_attorney: "slot_power_of_attorney_signed",
        slot_registration_application: "slot_registration_application_signed",
        slot_acceptance_letter: "slot_acceptance_letter_signed",
        slot_resignation_letter: "slot_resignation_letter_signed"
      };
      const signedToBase: Record<string, string> = Object.fromEntries(Object.entries(baseToSigned).map(([b, s]) => [s, b]));

      // (a) 템플릿(초안) 자체에 대한 검토는 가능하되, sign 태스크는 서명본 ok에서만 완료 처리
      if (baseToSigned[slotId]) {
        const signTaskId = `sign_${slotId}`;
        if (decision === "needs_fix") {
          await ensureTask(adminApp, {
            caseId,
            taskId: signTaskId,
            partnerId: String(c.partnerId),
            titleKo: `${slotTitle} 서명/날인 확보`,
            type: "signature_collect"
          });
        }
        if (decision === "ok") {
          const eventId = crypto.randomUUID();
          await writeTimelineEvent(adminApp, caseId, eventId, {
            type: "SIGNATURE_EVIDENCE_PENDING",
            occurredAt: now,
            actor: isOps(auth)
              ? { type: "ops", uid: auth.uid }
              : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
            summaryKo: `서류 검토 OK(서명본 업로드 필요): ${slotTitle}`,
            meta: { slotId, requiredSignedSlotId: baseToSigned[slotId] }
          });
        }
      }

      // (b) 서명본 review가 ok면 sign 태스크 done + 타임라인 기록
      if (signedToBase[slotId]) {
        const baseSlotId = signedToBase[slotId];
        const baseTitle = getSlotTitleKo(String(c.casePackId ?? ""), baseSlotId) ?? baseSlotId;
        const signTaskId = `sign_${baseSlotId}`;
        if (decision === "ok") {
          await setTaskStatus(adminApp, { caseId, taskId: signTaskId, status: "done" });
          const eventId = crypto.randomUUID();
          await writeTimelineEvent(adminApp, caseId, eventId, {
            type: "SIGNATURE_TASK_COMPLETED",
            occurredAt: now,
            actor: isOps(auth)
              ? { type: "ops", uid: auth.uid }
              : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
            summaryKo: `서명/날인 확보 완료: ${baseTitle}`,
            meta: { baseSlotId, evidenceSlotId: slotId, taskId: signTaskId, via: "documents.review.ok" }
          });

          // UX 개선: 서명본이 OK이면, 대응되는 "초안 문서"도 자동으로 OK 처리(단계 전진 조건 충족)
          // (초안 문서가 아직 review ok가 아니더라도, 서명본이 OK이면 최종적으로 OK로 간주)
          const baseDocs = await adminApp
            .firestore()
            .collection(`cases/${caseId}/documents`)
            .where("slotId", "==", baseSlotId)
            .limit(1)
            .get();
          if (!baseDocs.empty) {
            const baseDoc = baseDocs.docs[0];
            await baseDoc.ref.set(
              {
                status: "ok",
                review: { decision: "ok", issueCodes: [], issueSummariesKo: [], auto: true, viaEvidenceSlotId: slotId },
                updatedAt: now
              },
              { merge: true }
            );
            const eventId2 = crypto.randomUUID();
            await writeTimelineEvent(adminApp, caseId, eventId2, {
              type: "DOCUMENT_AUTO_APPROVED",
              occurredAt: now,
              actor: isOps(auth)
                ? { type: "ops", uid: auth.uid }
                : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
              summaryKo: `서류 자동 OK 처리(서명본 기반): ${baseTitle}`,
              meta: { baseSlotId, viaEvidenceSlotId: slotId }
            });
          }
        } else {
          await ensureTask(adminApp, {
            caseId,
            taskId: signTaskId,
            partnerId: String(c.partnerId),
            titleKo: `${baseTitle} 서명/날인 확보`,
            type: "signature_collect"
          });
          const eventId = crypto.randomUUID();
          await writeTimelineEvent(adminApp, caseId, eventId, {
            type: "SIGNATURE_TASK_REOPENED",
            occurredAt: now,
            actor: isOps(auth)
              ? { type: "ops", uid: auth.uid }
              : { type: "partner", partnerId: c.partnerId, uid: auth.uid },
            summaryKo: `서명/날인 보완 필요: ${baseTitle}`,
            meta: { baseSlotId, evidenceSlotId: slotId, taskId: signTaskId, via: "documents.review.needs_fix" }
          });
        }
      }

      // 3.8) 서명본 OK로 draft_filing 완료 조건이 충족되면 자동 전진(draft_filing -> filing_submitted)
      if (signedToBase[slotId] && decision === "ok") {
        await tryAutoAdvanceAfterDraftFiling(adminApp, {
          caseId,
          actor: isOps(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid }
        });
      }

      // 4) 다음 단계 전진 가능 태스크(advance_{stage}) 자동 동기화 (자동 전진 이후 stage 재조회)
      const wfSnap = await workflowRef(adminApp, caseId).get();
      const stage = String((wfSnap.exists ? (wfSnap.data() as any).stage : "intake") || "intake");
      const packId2 = String(c.casePackId ?? "");
      const ns = nextStage(packId2, stage as any);
      if (ns) {
        const prereq = await validateStagePrerequisites(adminApp, { caseId, casePackId: packId2, stage: stage as any });
        const taskId = `advance_${stage}`;
        if (prereq.ok) {
          await ensureTask(adminApp, {
            caseId,
            taskId,
            partnerId: String(c.partnerId),
            titleKo: `다음 단계 진행: ${stage} → ${ns}`,
            type: "advance_stage"
          });
        } else {
          await setTaskStatus(adminApp, { caseId, taskId, status: "done" });
        }
      }

      // (참고) review ok 시 자동 완료/전진 시도는 기존 로직에서 처리됨(접수증 등)

      // 5) 접수증(slot_filing_receipt) OK 처리 후 자동 완료 시도
      if (decision === "ok" && String(txResult.d.slotId) === "slot_filing_receipt") {
        const auto = await tryAutoCompleteAfterFiling(adminApp, {
          caseId,
          actor: isOps(auth) ? { type: "ops", uid: auth.uid } : { type: "partner", partnerId: c.partnerId, uid: auth.uid }
        });
        // 자동 완료가 안 된 경우에도 advance_filing_submitted 태스크를 즉시 동기화해서
        // 파트너 업무 큐에서 "이제 완료 가능" 상태가 바로 보이게 한다.
        if (!auto.advanced) {
          const wf2 = await workflowRef(adminApp, caseId).get();
          const stage2 = String(wf2.exists ? (wf2.data() as any).stage : "");
          if (stage2 === "filing_submitted") {
            const packId3 = String(c.casePackId ?? "");
            const ns2 = nextStage(packId3, "filing_submitted" as any);
            if (ns2) {
              const prereq2 = await validateStagePrerequisites(adminApp, { caseId, casePackId: packId3, stage: "filing_submitted" as any });
              if (prereq2.ok) {
                await ensureTask(adminApp, {
                  caseId,
                  taskId: "advance_filing_submitted",
                  partnerId: String(c.partnerId),
                  titleKo: `다음 단계 진행: filing_submitted → ${ns2}`,
                  type: "advance_stage"
                });
              } else {
                await setTaskStatus(adminApp, { caseId, taskId: "advance_filing_submitted", status: "done" });
              }
            }
          }
        }
      }

      return { status, caseStatus: txResult.toCaseStatus ?? txResult.fromCaseStatus };
    }).catch((e: any) => {
      if (String(e?.message) === "NOT_FOUND") {
        fail(res, 404, "NOT_FOUND", "문서를 찾을 수 없습니다.");
        return null;
      }
      if (String(e?.message) === "CASE_NOT_FOUND") {
        fail(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
        return null;
      }
      fail(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
      return null;
    });

    if (!result) return;
    return ok(res, result);
  });
}
