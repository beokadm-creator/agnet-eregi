"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPackageRoutes = registerPackageRoutes;
const jszip_1 = __importDefault(require("jszip"));
const docx_1 = require("docx");
const auth_1 = require("../../lib/auth");
const http_1 = require("../../lib/http");
const firestore_1 = require("../../lib/firestore");
const workflow_1 = require("../../lib/workflow");
const casepack_1 = require("../../lib/casepack");
function fmtTs(v) {
    if (!v)
        return "-";
    try {
        const d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
        return d.toISOString();
    }
    catch (_a) {
        return String(v);
    }
}
function tableFromRows(rows) {
    const tableRows = rows.map((r) => new docx_1.TableRow({
        children: r.map((c) => new docx_1.TableCell({
            width: { size: 50, type: docx_1.WidthType.PERCENTAGE },
            children: [new docx_1.Paragraph(String(c !== null && c !== void 0 ? c : ""))]
        }))
    }));
    return new docx_1.Table({ rows: tableRows, width: { size: 100, type: docx_1.WidthType.PERCENTAGE } });
}
async function markdownToDocxBuffer(markdown) {
    const lines = String(markdown !== null && markdown !== void 0 ? markdown : "").split("\n");
    const paragraphs = [];
    for (const raw of lines) {
        const line = raw.replace(/\r/g, "");
        if (line.startsWith("# ")) {
            paragraphs.push(new docx_1.Paragraph({ text: line.slice(2), heading: docx_1.HeadingLevel.HEADING_1 }));
        }
        else if (line.startsWith("## ")) {
            paragraphs.push(new docx_1.Paragraph({ text: line.slice(3), heading: docx_1.HeadingLevel.HEADING_2 }));
        }
        else if (line.trim() === "") {
            paragraphs.push(new docx_1.Paragraph({ text: "" }));
        }
        else {
            paragraphs.push(new docx_1.Paragraph({ text: line }));
        }
    }
    const doc = new docx_1.Document({ sections: [{ properties: {}, children: paragraphs }] });
    return await docx_1.Packer.toBuffer(doc);
}
async function minutesDocxBuffer(input) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const companyName = String((_a = input === null || input === void 0 ? void 0 : input.companyName) !== null && _a !== void 0 ? _a : "회사명");
    const meetingDate = String((_b = input === null || input === void 0 ? void 0 : input.meetingDate) !== null && _b !== void 0 ? _b : "2026-01-01");
    const resolutionKo = String((_c = input === null || input === void 0 ? void 0 : input.resolutionKo) !== null && _c !== void 0 ? _c : "");
    const officers = Array.isArray(input === null || input === void 0 ? void 0 : input.officers) ? input.officers : [];
    const resolutionTextKo = resolutionKo.trim()
        ? resolutionKo.trim()
        : officers.length > 0
            ? `다음과 같이 임원 변경을 결의한다.\n${officers
                .slice(0, 20)
                .map((o) => {
                var _a, _b, _c;
                const ct = String(o.changeType || "");
                const ctKo = ct === "appoint" ? "선임" : ct === "resign" ? "사임" : ct === "reappoint" ? "중임" : ct;
                const rep = o.isRepresentative ? " (대표이사)" : "";
                return `- ${String((_a = o.roleKo) !== null && _a !== void 0 ? _a : "")} ${String((_b = o.nameKo) !== null && _b !== void 0 ? _b : "")}${rep}: ${ctKo} (효력일 ${String((_c = o.effectiveDate) !== null && _c !== void 0 ? _c : "")})`;
            })
                .join("\n")}`
            : "임원 변경의 건";
    const children = [];
    children.push(new docx_1.Paragraph({ text: "의사록/결의서", heading: docx_1.HeadingLevel.HEADING_1 }));
    children.push(new docx_1.Paragraph({ text: companyName, heading: docx_1.HeadingLevel.HEADING_2 }));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(tableFromRows([
        ["항목", "내용"],
        ["일자", meetingDate],
        ["안건", "임원 변경의 건"]
    ]));
    children.push(new docx_1.Paragraph({ text: "" }));
    if (officers.length > 0) {
        children.push(new docx_1.Paragraph({ text: "변경 임원", heading: docx_1.HeadingLevel.HEADING_2 }));
        const rows = [["성명", "직위", "구분", "효력일", "생년월일", "주소", "대표"]];
        for (const o of officers.slice(0, 20)) {
            const ct = String(o.changeType || "");
            const ctKo = ct === "appoint" ? "선임" : ct === "resign" ? "사임" : ct === "reappoint" ? "중임" : ct;
            rows.push([
                String((_d = o.nameKo) !== null && _d !== void 0 ? _d : ""),
                String((_e = o.roleKo) !== null && _e !== void 0 ? _e : ""),
                ctKo,
                String((_f = o.effectiveDate) !== null && _f !== void 0 ? _f : ""),
                String((_g = o.birthDate) !== null && _g !== void 0 ? _g : ""),
                String((_h = o.addressKo) !== null && _h !== void 0 ? _h : ""),
                o.isRepresentative ? "Y" : ""
            ]);
        }
        children.push(tableFromRows(rows));
        children.push(new docx_1.Paragraph({ text: "" }));
    }
    children.push(new docx_1.Paragraph({ text: "결의 내용", heading: docx_1.HeadingLevel.HEADING_2 }));
    for (const line of resolutionTextKo.split("\n")) {
        children.push(new docx_1.Paragraph({ text: line }));
    }
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "서명/날인", heading: docx_1.HeadingLevel.HEADING_2 }));
    children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "성명: ", bold: true }), new docx_1.TextRun({ text: "____________________", underline: {} })] }));
    children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "서명(또는 인): ", bold: true }), new docx_1.TextRun({ text: "____________________", underline: {} })] }));
    const doc = new docx_1.Document({ sections: [{ properties: {}, children }] });
    return await docx_1.Packer.toBuffer(doc);
}
async function poaDocxBuffer(input) {
    var _a, _b, _c;
    const principalName = String((_a = input === null || input === void 0 ? void 0 : input.principalName) !== null && _a !== void 0 ? _a : "위임인");
    const agentName = String((_b = input === null || input === void 0 ? void 0 : input.agentName) !== null && _b !== void 0 ? _b : "수임인(법무사)");
    const scopeKo = String((_c = input === null || input === void 0 ? void 0 : input.scopeKo) !== null && _c !== void 0 ? _c : "임원 변경 등기 신청 관련 일체");
    const children = [];
    children.push(new docx_1.Paragraph({ text: "위임장", heading: docx_1.HeadingLevel.HEADING_1 }));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(tableFromRows([
        ["항목", "내용"],
        ["위임인", principalName],
        ["수임인", agentName],
        ["위임 범위", scopeKo]
    ]));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "서명/날인", heading: docx_1.HeadingLevel.HEADING_2 }));
    children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "위임인 성명: ", bold: true }), new docx_1.TextRun({ text: "____________________", underline: {} })] }));
    children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "서명(또는 인): ", bold: true }), new docx_1.TextRun({ text: "____________________", underline: {} })] }));
    const doc = new docx_1.Document({ sections: [{ properties: {}, children }] });
    return await docx_1.Packer.toBuffer(doc);
}
async function applicationDocxBuffer(input) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const companyName = String((_a = input === null || input === void 0 ? void 0 : input.companyName) !== null && _a !== void 0 ? _a : "회사명");
    const meetingDate = String((_b = input === null || input === void 0 ? void 0 : input.meetingDate) !== null && _b !== void 0 ? _b : "2026-01-01");
    const officers = Array.isArray(input === null || input === void 0 ? void 0 : input.officers) ? input.officers : [];
    const appointed = officers.filter((o) => ["appoint", "reappoint"].includes(String(o.changeType)));
    const resigned = officers.filter((o) => String(o.changeType) === "resign");
    const children = [];
    children.push(new docx_1.Paragraph({ text: "등기신청서", heading: docx_1.HeadingLevel.HEADING_1 }));
    children.push(new docx_1.Paragraph({ text: companyName, heading: docx_1.HeadingLevel.HEADING_2 }));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(tableFromRows([
        ["항목", "내용"],
        ["신청 취지", "임원 변경 등기 신청"],
        ["결의일", meetingDate]
    ]));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "변경 내역", heading: docx_1.HeadingLevel.HEADING_2 }));
    const rows = [["구분", "직위", "성명", "효력일", "비고"]];
    for (const o of appointed) {
        const ct = String(o.changeType || "");
        const ctKo = ct === "appoint" ? "선임" : "중임";
        rows.push([ctKo, String((_c = o.roleKo) !== null && _c !== void 0 ? _c : ""), String((_d = o.nameKo) !== null && _d !== void 0 ? _d : ""), String((_e = o.effectiveDate) !== null && _e !== void 0 ? _e : ""), o.isRepresentative ? "대표" : ""]);
    }
    for (const o of resigned)
        rows.push(["사임", String((_f = o.roleKo) !== null && _f !== void 0 ? _f : ""), String((_g = o.nameKo) !== null && _g !== void 0 ? _g : ""), String((_h = o.effectiveDate) !== null && _h !== void 0 ? _h : ""), o.isRepresentative ? "대표" : ""]);
    if (rows.length === 1)
        rows.push(["-", "-", "-", "-", "-"]);
    children.push(tableFromRows(rows));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "첨부서류", heading: docx_1.HeadingLevel.HEADING_2 }));
    const attachments = Array.isArray(input === null || input === void 0 ? void 0 : input._attachments) ? input._attachments : null;
    if (attachments && attachments.length > 0) {
        const rows2 = [["서류", "상태"]];
        for (const a of attachments)
            rows2.push([String((_k = (_j = a.titleKo) !== null && _j !== void 0 ? _j : a.slotId) !== null && _k !== void 0 ? _k : ""), String((_m = (_l = a.statusKo) !== null && _l !== void 0 ? _l : a.status) !== null && _m !== void 0 ? _m : "")]);
        children.push(tableFromRows(rows2));
    }
    else {
        children.push(new docx_1.Paragraph({ text: "- 의사록/결의서" }));
        children.push(new docx_1.Paragraph({ text: "- 위임장" }));
        if (appointed.length > 0)
            children.push(new docx_1.Paragraph({ text: "- 취임승낙서" }));
        if (resigned.length > 0)
            children.push(new docx_1.Paragraph({ text: "- 사임서" }));
        children.push(new docx_1.Paragraph({ text: "- 법인등기부등본, 인감증명서 등" }));
    }
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "신청인(대리인) 서명", heading: docx_1.HeadingLevel.HEADING_2 }));
    children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "성명: ", bold: true }), new docx_1.TextRun({ text: "____________________", underline: {} })] }));
    children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "서명(또는 인): ", bold: true }), new docx_1.TextRun({ text: "____________________", underline: {} })] }));
    const doc = new docx_1.Document({ sections: [{ properties: {}, children }] });
    return await docx_1.Packer.toBuffer(doc);
}
async function acceptanceDocxBuffer(input) {
    var _a, _b, _c, _d;
    const companyName = String((_a = input === null || input === void 0 ? void 0 : input.companyName) !== null && _a !== void 0 ? _a : "회사명");
    const officers = Array.isArray(input === null || input === void 0 ? void 0 : input.officers) ? input.officers : [];
    const targets = officers.filter((o) => ["appoint", "reappoint"].includes(String(o.changeType)));
    const children = [];
    children.push(new docx_1.Paragraph({ text: "취임승낙서", heading: docx_1.HeadingLevel.HEADING_1 }));
    children.push(new docx_1.Paragraph({ text: companyName, heading: docx_1.HeadingLevel.HEADING_2 }));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "취임 대상", heading: docx_1.HeadingLevel.HEADING_2 }));
    const rows = [["직위", "성명", "구분", "효력일"]];
    for (const o of targets) {
        const ct = String(o.changeType || "");
        const ctKo = ct === "appoint" ? "선임" : "중임";
        rows.push([String((_b = o.roleKo) !== null && _b !== void 0 ? _b : ""), String((_c = o.nameKo) !== null && _c !== void 0 ? _c : ""), ctKo, String((_d = o.effectiveDate) !== null && _d !== void 0 ? _d : "")]);
    }
    if (rows.length === 1)
        rows.push(["-", "-", "-", "-"]);
    children.push(tableFromRows(rows));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "본인은 위 직위에 취임함을 승낙합니다." }));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "서명/날인", heading: docx_1.HeadingLevel.HEADING_2 }));
    children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "성명: ", bold: true }), new docx_1.TextRun({ text: "____________________", underline: {} })] }));
    children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "서명(또는 인): ", bold: true }), new docx_1.TextRun({ text: "____________________", underline: {} })] }));
    const doc = new docx_1.Document({ sections: [{ properties: {}, children }] });
    return await docx_1.Packer.toBuffer(doc);
}
async function resignationDocxBuffer(input) {
    var _a, _b, _c, _d;
    const companyName = String((_a = input === null || input === void 0 ? void 0 : input.companyName) !== null && _a !== void 0 ? _a : "회사명");
    const officers = Array.isArray(input === null || input === void 0 ? void 0 : input.officers) ? input.officers : [];
    const targets = officers.filter((o) => String(o.changeType) === "resign");
    const children = [];
    children.push(new docx_1.Paragraph({ text: "사임서", heading: docx_1.HeadingLevel.HEADING_1 }));
    children.push(new docx_1.Paragraph({ text: companyName, heading: docx_1.HeadingLevel.HEADING_2 }));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "사임 대상", heading: docx_1.HeadingLevel.HEADING_2 }));
    const rows = [["직위", "성명", "효력일"]];
    for (const o of targets)
        rows.push([String((_b = o.roleKo) !== null && _b !== void 0 ? _b : ""), String((_c = o.nameKo) !== null && _c !== void 0 ? _c : ""), String((_d = o.effectiveDate) !== null && _d !== void 0 ? _d : "")]);
    if (rows.length === 1)
        rows.push(["-", "-", "-"]);
    children.push(tableFromRows(rows));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "본인은 위 직위에서 사임합니다." }));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "서명/날인", heading: docx_1.HeadingLevel.HEADING_2 }));
    children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "성명: ", bold: true }), new docx_1.TextRun({ text: "____________________", underline: {} })] }));
    children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "서명(또는 인): ", bold: true }), new docx_1.TextRun({ text: "____________________", underline: {} })] }));
    const doc = new docx_1.Document({ sections: [{ properties: {}, children }] });
    return await docx_1.Packer.toBuffer(doc);
}
async function repChangeDocxBuffer(input) {
    var _a, _b, _c, _d, _e;
    const companyName = String((_a = input === null || input === void 0 ? void 0 : input.companyName) !== null && _a !== void 0 ? _a : "회사명");
    const meetingDate = String((_b = input === null || input === void 0 ? void 0 : input.meetingDate) !== null && _b !== void 0 ? _b : "2026-01-01");
    const officers = Array.isArray(input === null || input === void 0 ? void 0 : input.officers) ? input.officers : [];
    const reps = officers.filter((o) => { var _a; return ((o === null || o === void 0 ? void 0 : o.isRepresentative) === true || String((_a = o === null || o === void 0 ? void 0 : o.roleKo) !== null && _a !== void 0 ? _a : "").includes("대표")) && ["appoint", "reappoint", "resign"].includes(String(o === null || o === void 0 ? void 0 : o.changeType)); });
    const children = [];
    children.push(new docx_1.Paragraph({ text: "대표이사 변경 확인서", heading: docx_1.HeadingLevel.HEADING_1 }));
    children.push(new docx_1.Paragraph({ text: companyName, heading: docx_1.HeadingLevel.HEADING_2 }));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(tableFromRows([
        ["항목", "내용"],
        ["결의일", meetingDate],
        ["목적", "대표이사 변경 관련 사실 확인"]
    ]));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "변경 대상", heading: docx_1.HeadingLevel.HEADING_2 }));
    const rows = [["직위", "성명", "구분", "효력일"]];
    for (const o of reps.slice(0, 20)) {
        const ct = String(o.changeType || "");
        const ctKo = ct === "appoint" ? "선임" : ct === "reappoint" ? "중임" : ct === "resign" ? "사임" : ct;
        rows.push([String((_c = o.roleKo) !== null && _c !== void 0 ? _c : ""), String((_d = o.nameKo) !== null && _d !== void 0 ? _d : ""), ctKo, String((_e = o.effectiveDate) !== null && _e !== void 0 ? _e : "")]);
    }
    if (rows.length === 1)
        rows.push(["-", "-", "-", "-"]);
    children.push(tableFromRows(rows));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "서명/날인", heading: docx_1.HeadingLevel.HEADING_2 }));
    children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "성명: ", bold: true }), new docx_1.TextRun({ text: "____________________", underline: {} })] }));
    children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "서명(또는 인): ", bold: true }), new docx_1.TextRun({ text: "____________________", underline: {} })] }));
    const doc = new docx_1.Document({ sections: [{ properties: {}, children }] });
    return await docx_1.Packer.toBuffer(doc);
}
async function buildWorkflowProofDocx(adminApp, caseId) {
    var _a, _b, _c, _d, _e, _f;
    const [wfSnap, tasksSnap] = await Promise.all([
        adminApp.firestore().doc(`cases/${caseId}/workflow/main`).get(),
        adminApp.firestore().collection(`cases/${caseId}/tasks`).orderBy("updatedAt", "desc").limit(200).get()
    ]);
    const wf = wfSnap.exists ? wfSnap.data() : null;
    const tasks = tasksSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
    const children = [];
    children.push(new docx_1.Paragraph({ text: "업무 체크리스트/태스크 증빙", heading: docx_1.HeadingLevel.HEADING_1 }));
    children.push(new docx_1.Paragraph({ text: `caseId: ${caseId}` }));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "워크플로우", heading: docx_1.HeadingLevel.HEADING_2 }));
    children.push(new docx_1.Paragraph({ text: `stage: ${(_a = wf === null || wf === void 0 ? void 0 : wf.stage) !== null && _a !== void 0 ? _a : "-"}` }));
    const checklist = (_b = wf === null || wf === void 0 ? void 0 : wf.checklist) !== null && _b !== void 0 ? _b : {};
    const keys = Object.keys(checklist);
    const chkRows = [["itemId", "done"]];
    for (const k of keys)
        chkRows.push([k, String(Boolean(checklist[k]))]);
    children.push(tableFromRows(chkRows));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "태스크", heading: docx_1.HeadingLevel.HEADING_2 }));
    const taskRows = [["taskId", "titleKo", "status", "updatedAt"]];
    for (const t of tasks) {
        taskRows.push([String((_d = (_c = t.taskId) !== null && _c !== void 0 ? _c : t.id) !== null && _d !== void 0 ? _d : ""), String((_e = t.titleKo) !== null && _e !== void 0 ? _e : ""), String((_f = t.status) !== null && _f !== void 0 ? _f : ""), fmtTs(t.updatedAt)]);
    }
    children.push(tableFromRows(taskRows));
    const doc = new docx_1.Document({ sections: [{ properties: {}, children }] });
    return await docx_1.Packer.toBuffer(doc);
}
async function buildFilingSummaryDocx(adminApp, caseId) {
    var _a, _b, _c;
    const snap = await adminApp.firestore().doc(`cases/${caseId}/filing/main`).get();
    const f = snap.exists ? snap.data() : null;
    const children = [];
    children.push(new docx_1.Paragraph({ text: "등기 제출 요약", heading: docx_1.HeadingLevel.HEADING_1 }));
    children.push(new docx_1.Paragraph({ text: `caseId: ${caseId}` }));
    children.push(new docx_1.Paragraph({ text: "" }));
    if (!f) {
        children.push(new docx_1.Paragraph({ text: "접수 정보 없음" }));
    }
    else {
        children.push(new docx_1.Paragraph({ text: `접수번호: ${(_a = f.receiptNo) !== null && _a !== void 0 ? _a : "-"}` }));
        children.push(new docx_1.Paragraph({ text: `관할: ${(_b = f.jurisdictionKo) !== null && _b !== void 0 ? _b : "-"}` }));
        children.push(new docx_1.Paragraph({ text: `접수일: ${(_c = f.submittedDate) !== null && _c !== void 0 ? _c : "-"}` }));
        if (f.memoKo)
            children.push(new docx_1.Paragraph({ text: `메모: ${f.memoKo}` }));
        children.push(new docx_1.Paragraph({ text: "" }));
        children.push(new docx_1.Paragraph({ text: "시각 정보", heading: docx_1.HeadingLevel.HEADING_2 }));
        children.push(new docx_1.Paragraph({ text: `createdAt: ${fmtTs(f.createdAt)}` }));
        children.push(new docx_1.Paragraph({ text: `updatedAt: ${fmtTs(f.updatedAt)}` }));
    }
    const doc = new docx_1.Document({ sections: [{ properties: {}, children }] });
    return await docx_1.Packer.toBuffer(doc);
}
async function buildSignedEvidenceReportDocx(adminApp, params) {
    var _a, _b;
    const { caseId, casePackId } = params;
    const slots = await (0, workflow_1.requiredSlotsForStage)(adminApp, { caseId, casePackId, stage: "draft_filing" });
    const signedSlots = slots.filter((s) => String(s).endsWith("_signed"));
    const docsSnap = await adminApp.firestore().collection(`cases/${caseId}/documents`).get();
    const docs = docsSnap.docs.map((d) => d.data());
    const bySlot = new Map();
    for (const d of docs)
        bySlot.set(String(d.slotId), d);
    const statusKoOf = (s) => s === "ok" ? "완료" : s === "needs_fix" ? "보완 필요" : s === "uploaded" ? "검토 필요" : s === "uploading" ? "업로드 중" : "미제출";
    const rows = [["서명본 슬롯", "서류명", "상태"]];
    for (const slotId of signedSlots) {
        const d = bySlot.get(String(slotId));
        const st = d ? String((_a = d.status) !== null && _a !== void 0 ? _a : "") : "missing";
        rows.push([String(slotId), (_b = (0, casepack_1.getSlotTitleKo)(casePackId, String(slotId))) !== null && _b !== void 0 ? _b : String(slotId), statusKoOf(st)]);
    }
    if (rows.length === 1)
        rows.push(["-", "-", "-"]);
    const children = [];
    children.push(new docx_1.Paragraph({ text: "서명본 제출 현황", heading: docx_1.HeadingLevel.HEADING_1 }));
    children.push(new docx_1.Paragraph({ text: `caseId: ${caseId}` }));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(tableFromRows(rows));
    const doc = new docx_1.Document({ sections: [{ properties: {}, children }] });
    return await docx_1.Packer.toBuffer(doc);
}
async function buildClosingReportDocx(adminApp, caseId, c) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15;
    const [wfSnap, docsSnap, timelineSnap, quotesSnap, paySnap, refundSnap, filingSnap] = await Promise.all([
        adminApp.firestore().doc(`cases/${caseId}/workflow/main`).get(),
        adminApp.firestore().collection(`cases/${caseId}/documents`).orderBy("updatedAt", "desc").limit(200).get(),
        adminApp.firestore().collection(`cases/${caseId}/timeline`).orderBy("occurredAt", "desc").limit(50).get(),
        adminApp.firestore().collection(`cases/${caseId}/quotes`).orderBy("updatedAt", "desc").limit(50).get(),
        adminApp.firestore().collection(`cases/${caseId}/payments`).orderBy("updatedAt", "desc").limit(50).get(),
        adminApp.firestore().collection(`cases/${caseId}/refunds`).orderBy("updatedAt", "desc").limit(50).get(),
        adminApp.firestore().doc(`cases/${caseId}/filing/main`).get()
    ]);
    const wf = wfSnap.exists ? wfSnap.data() : null;
    const filing = filingSnap.exists ? filingSnap.data() : null;
    const docs = docsSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
    const events = timelineSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
    const quotes = quotesSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
    const payments = paySnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
    const refunds = refundSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
    const children = [];
    children.push(new docx_1.Paragraph({ text: "케이스 종료 리포트", heading: docx_1.HeadingLevel.HEADING_1 }));
    children.push(new docx_1.Paragraph({ text: `caseId: ${caseId}` }));
    children.push(new docx_1.Paragraph({ text: `casePackId: ${(_a = c.casePackId) !== null && _a !== void 0 ? _a : "-"}` }));
    children.push(new docx_1.Paragraph({ text: `status: ${(_b = c.status) !== null && _b !== void 0 ? _b : "-"}` }));
    children.push(new docx_1.Paragraph({ text: `ownerUid: ${(_c = c.ownerUid) !== null && _c !== void 0 ? _c : "-"}` }));
    children.push(new docx_1.Paragraph({ text: `partnerId: ${(_d = c.partnerId) !== null && _d !== void 0 ? _d : "-"}` }));
    children.push(new docx_1.Paragraph({ text: `createdAt: ${fmtTs(c.createdAt)}` }));
    children.push(new docx_1.Paragraph({ text: `updatedAt: ${fmtTs(c.updatedAt)}` }));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "업무 프로세스", heading: docx_1.HeadingLevel.HEADING_2 }));
    children.push(new docx_1.Paragraph({ text: `stage: ${(_e = wf === null || wf === void 0 ? void 0 : wf.stage) !== null && _e !== void 0 ? _e : "-"}` }));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "접수 정보", heading: docx_1.HeadingLevel.HEADING_2 }));
    if (!filing) {
        children.push(new docx_1.Paragraph({ text: "접수 정보 없음" }));
    }
    else {
        children.push(new docx_1.Paragraph({ text: `receiptNo: ${(_f = filing.receiptNo) !== null && _f !== void 0 ? _f : "-"}` }));
        children.push(new docx_1.Paragraph({ text: `jurisdictionKo: ${(_g = filing.jurisdictionKo) !== null && _g !== void 0 ? _g : "-"}` }));
        children.push(new docx_1.Paragraph({ text: `submittedDate: ${(_h = filing.submittedDate) !== null && _h !== void 0 ? _h : "-"}` }));
        if (filing.memoKo)
            children.push(new docx_1.Paragraph({ text: `memoKo: ${filing.memoKo}` }));
    }
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "문서", heading: docx_1.HeadingLevel.HEADING_2 }));
    const docRows = [["slotId", "status", "fileName", "reviewDecision", "issueCodes", "updatedAt"]];
    for (const d of docs) {
        const v = d.latestVersionId ? (_j = d.versions) === null || _j === void 0 ? void 0 : _j[d.latestVersionId] : null;
        docRows.push([
            String((_k = d.slotId) !== null && _k !== void 0 ? _k : ""),
            String((_l = d.status) !== null && _l !== void 0 ? _l : ""),
            String((_m = v === null || v === void 0 ? void 0 : v.fileName) !== null && _m !== void 0 ? _m : ""),
            String((_p = (_o = d.review) === null || _o === void 0 ? void 0 : _o.decision) !== null && _p !== void 0 ? _p : ""),
            Array.isArray((_q = d.review) === null || _q === void 0 ? void 0 : _q.issueCodes) ? d.review.issueCodes.join("|") : "",
            fmtTs(d.updatedAt)
        ]);
    }
    children.push(tableFromRows(docRows));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "견적", heading: docx_1.HeadingLevel.HEADING_2 }));
    const quoteRows = [["quoteId", "status", "priceMin", "priceMax", "currency", "updatedAt"]];
    for (const q of quotes) {
        quoteRows.push([
            String((_s = (_r = q.quoteId) !== null && _r !== void 0 ? _r : q.id) !== null && _s !== void 0 ? _s : ""),
            String((_t = q.status) !== null && _t !== void 0 ? _t : ""),
            String((_v = (_u = q.priceRange) === null || _u === void 0 ? void 0 : _u.min) !== null && _v !== void 0 ? _v : ""),
            String((_x = (_w = q.priceRange) === null || _w === void 0 ? void 0 : _w.max) !== null && _x !== void 0 ? _x : ""),
            String((_z = (_y = q.priceRange) === null || _y === void 0 ? void 0 : _y.currency) !== null && _z !== void 0 ? _z : ""),
            fmtTs(q.updatedAt)
        ]);
    }
    children.push(tableFromRows(quoteRows));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "결제", heading: docx_1.HeadingLevel.HEADING_2 }));
    const payRows = [["paymentId", "status", "amount", "currency", "capturedAt", "updatedAt"]];
    for (const p of payments) {
        payRows.push([
            String((_1 = (_0 = p.paymentId) !== null && _0 !== void 0 ? _0 : p.id) !== null && _1 !== void 0 ? _1 : ""),
            String((_2 = p.status) !== null && _2 !== void 0 ? _2 : ""),
            String((_4 = (_3 = p.amount) === null || _3 === void 0 ? void 0 : _3.amount) !== null && _4 !== void 0 ? _4 : ""),
            String((_6 = (_5 = p.amount) === null || _5 === void 0 ? void 0 : _5.currency) !== null && _6 !== void 0 ? _6 : ""),
            fmtTs(p.capturedAt),
            fmtTs(p.updatedAt)
        ]);
    }
    children.push(tableFromRows(payRows));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "환불", heading: docx_1.HeadingLevel.HEADING_2 }));
    const rRows = [["refundId", "status", "amount", "currency", "executedAt", "updatedAt"]];
    for (const r of refunds) {
        rRows.push([
            String((_8 = (_7 = r.refundId) !== null && _7 !== void 0 ? _7 : r.id) !== null && _8 !== void 0 ? _8 : ""),
            String((_9 = r.status) !== null && _9 !== void 0 ? _9 : ""),
            String((_11 = (_10 = r.amount) === null || _10 === void 0 ? void 0 : _10.amount) !== null && _11 !== void 0 ? _11 : ""),
            String((_13 = (_12 = r.amount) === null || _12 === void 0 ? void 0 : _12.currency) !== null && _13 !== void 0 ? _13 : ""),
            fmtTs(r.executedAt),
            fmtTs(r.updatedAt)
        ]);
    }
    children.push(tableFromRows(rRows));
    children.push(new docx_1.Paragraph({ text: "" }));
    children.push(new docx_1.Paragraph({ text: "타임라인(최근 50)", heading: docx_1.HeadingLevel.HEADING_2 }));
    const eRows = [["type", "summaryKo", "occurredAt"]];
    for (const e of events)
        eRows.push([String((_14 = e.type) !== null && _14 !== void 0 ? _14 : ""), String((_15 = e.summaryKo) !== null && _15 !== void 0 ? _15 : ""), fmtTs(e.occurredAt)]);
    children.push(tableFromRows(eRows));
    const doc = new docx_1.Document({ sections: [{ properties: {}, children }] });
    return await docx_1.Packer.toBuffer(doc);
}
async function validatePackageContents(adminApp, params) {
    var _a, _b;
    const { caseId, casePackId } = params;
    const slots = await (0, workflow_1.requiredSlotsForStage)(adminApp, { caseId, casePackId, stage: "draft_filing" });
    const signedSlots = slots.filter((s) => String(s).endsWith("_signed"));
    const docsSnap = await adminApp.firestore().collection(`cases/${caseId}/documents`).get();
    const docs = docsSnap.docs.map((d) => d.data());
    const bySlot = new Map();
    for (const d of docs)
        bySlot.set(String(d.slotId), d);
    const missing = [];
    const signed = [];
    const bucket = adminApp.storage().bucket();
    for (const s of signedSlots) {
        const d = bySlot.get(s);
        const v = (d === null || d === void 0 ? void 0 : d.latestVersionId) ? (_a = d === null || d === void 0 ? void 0 : d.versions) === null || _a === void 0 ? void 0 : _a[d.latestVersionId] : null;
        const p = v === null || v === void 0 ? void 0 : v.storagePath;
        let exists = false;
        if (p) {
            const [ex] = await bucket.file(String(p)).exists();
            exists = ex;
        }
        const isOk = (d === null || d === void 0 ? void 0 : d.status) === "ok" && exists;
        if (!isOk)
            missing.push(s);
        signed.push({ slotId: s, ok: (d === null || d === void 0 ? void 0 : d.status) === "ok", path: p || null, exists });
    }
    // filing receipt
    const fr = bySlot.get("slot_filing_receipt");
    const frV = (fr === null || fr === void 0 ? void 0 : fr.latestVersionId) ? (_b = fr === null || fr === void 0 ? void 0 : fr.versions) === null || _b === void 0 ? void 0 : _b[fr.latestVersionId] : null;
    const frP = frV === null || frV === void 0 ? void 0 : frV.storagePath;
    let frExists = false;
    if (frP) {
        const [ex] = await bucket.file(String(frP)).exists();
        frExists = ex;
    }
    const frOk = (fr === null || fr === void 0 ? void 0 : fr.status) === "ok" && frExists;
    if (!frOk)
        missing.push("slot_filing_receipt");
    return {
        ok: missing.length === 0,
        missing,
        signed,
        filingReceipt: { ok: (fr === null || fr === void 0 ? void 0 : fr.status) === "ok", path: frP || null, exists: frExists }
    };
}
function registerPackageRoutes(app, adminApp) {
    app.get("/v1/cases/:caseId/packages/validate", async (req, res) => {
        var _a, _b, _c;
        try {
            const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
            if (!auth)
                return;
            const caseId = req.params.caseId;
            const cs = await (0, firestore_1.caseRef)(adminApp, caseId).get();
            if (!cs.exists) {
                (0, http_1.logError)({ endpoint: "/v1/cases/:caseId/packages/validate", caseId, code: "NOT_FOUND", messageKo: "케이스를 찾을 수 없습니다." });
                return (0, http_1.fail)(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
            }
            const c = cs.data();
            const canRead = (0, auth_1.isOps)(auth) || c.ownerUid === auth.uid || ((0, auth_1.partnerIdOf)(auth) && c.partnerId === (0, auth_1.partnerIdOf)(auth));
            if (!canRead) {
                (0, http_1.logError)({ endpoint: "/v1/cases/:caseId/packages/validate", caseId, code: "FORBIDDEN", messageKo: "접근 권한이 없습니다." });
                return (0, http_1.fail)(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
            }
            const casePackId = String((_a = c.casePackId) !== null && _a !== void 0 ? _a : "");
            const required = await (0, workflow_1.requiredSlotsForStage)(adminApp, { caseId, casePackId, stage: "draft_filing" });
            const signedSlots = required.filter((s) => String(s).endsWith("_signed"));
            const docsSnap = await adminApp.firestore().collection(`cases/${caseId}/documents`).get();
            const docs = docsSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
            const bySlot = new Map();
            for (const d of docs)
                bySlot.set(String(d.slotId), d);
            const bucket = adminApp.storage().bucket();
            const signed = [];
            for (const slotId of signedSlots) {
                const d = bySlot.get(String(slotId));
                const v = (d === null || d === void 0 ? void 0 : d.latestVersionId) ? (_b = d === null || d === void 0 ? void 0 : d.versions) === null || _b === void 0 ? void 0 : _b[d.latestVersionId] : null;
                const storagePath = (v === null || v === void 0 ? void 0 : v.storagePath) ? String(v.storagePath) : null;
                const fileName = (v === null || v === void 0 ? void 0 : v.fileName) ? String(v.fileName) : null;
                const status = (d === null || d === void 0 ? void 0 : d.status) ? String(d.status) : "missing";
                let exists = false;
                if (storagePath) {
                    try {
                        const [ok] = await bucket.file(storagePath).exists();
                        exists = Boolean(ok);
                    }
                    catch (_d) {
                        exists = false;
                    }
                }
                signed.push({ slotId, status, fileName, storagePath, exists });
            }
            const receiptDoc = bySlot.get("slot_filing_receipt");
            const receiptV = (receiptDoc === null || receiptDoc === void 0 ? void 0 : receiptDoc.latestVersionId) ? (_c = receiptDoc === null || receiptDoc === void 0 ? void 0 : receiptDoc.versions) === null || _c === void 0 ? void 0 : _c[receiptDoc.latestVersionId] : null;
            const receiptPath = (receiptV === null || receiptV === void 0 ? void 0 : receiptV.storagePath) ? String(receiptV.storagePath) : null;
            const receiptName = (receiptV === null || receiptV === void 0 ? void 0 : receiptV.fileName) ? String(receiptV.fileName) : null;
            const receiptStatus = (receiptDoc === null || receiptDoc === void 0 ? void 0 : receiptDoc.status) ? String(receiptDoc.status) : "missing";
            let receiptExists = false;
            if (receiptPath) {
                try {
                    const [ok] = await bucket.file(receiptPath).exists();
                    receiptExists = Boolean(ok);
                }
                catch (_e) {
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
        }
        catch (err) {
            const caseId = req.params.caseId || "unknown";
            (0, http_1.logError)({ endpoint: "/v1/cases/:caseId/packages/validate", caseId, code: "INTERNAL", messageKo: "검증 중 시스템 오류가 발생했습니다.", err });
            return (0, http_1.fail)(res, 500, "INTERNAL", "검증 중 시스템 오류가 발생했습니다.");
        }
    });
    // 제출 패키지 ZIP (접수증 + 생성 템플릿(DOCX) + 종료리포트(DOCX) + 메타데이터)
    app.get("/v1/cases/:caseId/packages/submission.zip", async (req, res) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        try {
            const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
            if (!auth)
                return;
            const caseId = req.params.caseId;
            const cs = await (0, firestore_1.caseRef)(adminApp, caseId).get();
            if (!cs.exists)
                return (0, http_1.fail)(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
            const c = cs.data();
            const canRead = (0, auth_1.isOps)(auth) || c.ownerUid === auth.uid || ((0, auth_1.partnerIdOf)(auth) && c.partnerId === (0, auth_1.partnerIdOf)(auth));
            if (!canRead)
                return (0, http_1.fail)(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
            const docsSnap = await adminApp.firestore().collection(`cases/${caseId}/documents`).get();
            const docs = docsSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
            const bySlot = new Map();
            for (const d of docs)
                bySlot.set(String(d.slotId), d);
            const zip = new jszip_1.default();
            const validation = await validatePackageContents(adminApp, { caseId, casePackId: String((_a = c.casePackId) !== null && _a !== void 0 ? _a : "") });
            // 가장 최근 evidenceId 조회 (존재한다면)
            const evSnap = await adminApp.firestore().collection("pilot_gate_evidence")
                .where("caseId", "==", caseId)
                .orderBy("validatedAt", "desc")
                .limit(1)
                .get();
            const evidenceId = evSnap.empty ? null : evSnap.docs[0].id;
            zip.file("meta.json", JSON.stringify({
                caseId,
                casePackId: (_b = c.casePackId) !== null && _b !== void 0 ? _b : null,
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
            const signedReport = await buildSignedEvidenceReportDocx(adminApp, { caseId, casePackId: String((_c = c.casePackId) !== null && _c !== void 0 ? _c : "") });
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
                const v = (d === null || d === void 0 ? void 0 : d.latestVersionId) ? (_d = d === null || d === void 0 ? void 0 : d.versions) === null || _d === void 0 ? void 0 : _d[d.latestVersionId] : null;
                const md = v === null || v === void 0 ? void 0 : v.generatedContentKo;
                const input = (_e = v === null || v === void 0 ? void 0 : v.templateInput) !== null && _e !== void 0 ? _e : null;
                if (t.template === "minutes" && (md || input)) {
                    zip.file(t.file, await minutesDocxBuffer(input !== null && input !== void 0 ? input : {}));
                }
                else if (t.template === "poa" && (md || input)) {
                    zip.file(t.file, await poaDocxBuffer(input !== null && input !== void 0 ? input : {}));
                }
                else if (t.template === "application" && (md || input)) {
                    const packId = String((_f = c.casePackId) !== null && _f !== void 0 ? _f : "");
                    const slotsA = await (0, workflow_1.requiredSlotsForStage)(adminApp, { caseId, casePackId: packId, stage: "docs_review" });
                    const slotsB = await (0, workflow_1.requiredSlotsForStage)(adminApp, { caseId, casePackId: packId, stage: "draft_filing" });
                    const slots = Array.from(new Set([...slotsA, ...slotsB]));
                    const statusKoOf = (s) => s === "ok" ? "완료" : s === "needs_fix" ? "보완 필요" : s === "uploaded" ? "검토 필요" : s === "uploading" ? "업로드 중" : "미제출";
                    const attachments = slots.map((slotId) => {
                        var _a, _b;
                        const d0 = bySlot.get(String(slotId));
                        const st = d0 ? String((_a = d0.status) !== null && _a !== void 0 ? _a : "") : "missing";
                        return { slotId, titleKo: (_b = (0, casepack_1.getSlotTitleKo)(packId, String(slotId))) !== null && _b !== void 0 ? _b : String(slotId), status: st, statusKo: statusKoOf(st) };
                    });
                    zip.file(t.file, await applicationDocxBuffer(Object.assign(Object.assign({}, (input !== null && input !== void 0 ? input : {})), { _attachments: attachments })));
                }
                else if (t.template === "acceptance" && (md || input)) {
                    zip.file(t.file, await acceptanceDocxBuffer(input !== null && input !== void 0 ? input : {}));
                }
                else if (t.template === "resignation" && (md || input)) {
                    zip.file(t.file, await resignationDocxBuffer(input !== null && input !== void 0 ? input : {}));
                }
                else if (t.template === "rep_change" && (md || input)) {
                    zip.file(t.file, await repChangeDocxBuffer(input !== null && input !== void 0 ? input : {}));
                }
                else if (md) {
                    zip.file(t.file, await markdownToDocxBuffer(String(md)));
                }
                else {
                    zip.file(t.file.replace(".docx", ".txt"), `템플릿이 생성되지 않았습니다: ${t.template}`);
                }
            }
            // 업무 증빙(체크리스트/태스크)
            const proof = await buildWorkflowProofDocx(adminApp, caseId);
            zip.file(`reports/workflow_proof_${caseId}.docx`, proof);
            // 접수증(원본 파일)
            const receiptDoc = bySlot.get("slot_filing_receipt");
            const receiptV = (receiptDoc === null || receiptDoc === void 0 ? void 0 : receiptDoc.latestVersionId) ? (_g = receiptDoc === null || receiptDoc === void 0 ? void 0 : receiptDoc.versions) === null || _g === void 0 ? void 0 : _g[receiptDoc.latestVersionId] : null;
            const receiptPath = receiptV === null || receiptV === void 0 ? void 0 : receiptV.storagePath;
            const receiptName = (receiptV === null || receiptV === void 0 ? void 0 : receiptV.fileName) || "filing_receipt";
            if (receiptPath) {
                try {
                    const bucket = adminApp.storage().bucket();
                    const [buf] = await bucket.file(String(receiptPath)).download();
                    zip.file(`filing/${receiptName}`, buf);
                }
                catch (e) {
                    zip.file("filing/receipt_download_failed.txt", `접수증 다운로드 실패: ${String((e === null || e === void 0 ? void 0 : e.message) || e)}`);
                }
            }
            else {
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
                const v = (d === null || d === void 0 ? void 0 : d.latestVersionId) ? (_h = d === null || d === void 0 ? void 0 : d.versions) === null || _h === void 0 ? void 0 : _h[d.latestVersionId] : null;
                const p = v === null || v === void 0 ? void 0 : v.storagePath;
                const name = (v === null || v === void 0 ? void 0 : v.fileName) || `${s}.pdf`;
                if (!p) {
                    zip.file(`signed/${s}_missing.txt`, `서명본이 업로드되지 않았습니다: ${s}`);
                    continue;
                }
                try {
                    const bucket = adminApp.storage().bucket();
                    const [buf] = await bucket.file(String(p)).download();
                    zip.file(`signed/${name}`, buf);
                }
                catch (e) {
                    zip.file(`signed/${s}_download_failed.txt`, `서명본 다운로드 실패: ${String((e === null || e === void 0 ? void 0 : e.message) || e)}`);
                }
            }
            const out = await zip.generateAsync({ type: "nodebuffer" });
            res.setHeader("Content-Type", "application/zip");
            res.setHeader("Content-Disposition", `attachment; filename="submission_package_${caseId}.zip"`);
            return res.status(200).send(out);
        }
        catch (err) {
            console.error("ZIP Generation Failed:", err);
            return (0, http_1.fail)(res, 500, "INTERNAL", `패키지 생성 중 오류가 발생했습니다: ${err.message || "알 수 없는 오류"}`);
        }
    });
    // 운영 재시도 엔드포인트 (submission.zip 재생성)
    app.post("/v1/ops/cases/:caseId/packages/regenerate", async (req, res) => {
        var _a, _b;
        try {
            const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
            if (!auth)
                return;
            if (!(0, auth_1.isOps)(auth)) {
                (0, http_1.logError)({ endpoint: "/v1/ops/cases/:caseId/packages/regenerate", caseId: req.params.caseId, code: "FORBIDDEN", messageKo: "운영자만 접근 가능합니다." });
                return (0, http_1.fail)(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
            }
            const caseId = req.params.caseId;
            const cs = await (0, firestore_1.caseRef)(adminApp, caseId).get();
            if (!cs.exists) {
                (0, http_1.logError)({ endpoint: "/v1/ops/cases/:caseId/packages/regenerate", caseId, code: "NOT_FOUND", messageKo: "케이스를 찾을 수 없습니다." });
                return (0, http_1.fail)(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
            }
            // 실제로는 별도의 큐나 비동기 워크플로우를 트리거할 수 있지만, 
            // MVP에서는 즉시 생성 여부를 테스트하는 것으로 대체
            const validation = await validatePackageContents(adminApp, { caseId, casePackId: String((_b = (_a = cs.data()) === null || _a === void 0 ? void 0 : _a.casePackId) !== null && _b !== void 0 ? _b : "") });
            return res.status(200).send({
                ok: true,
                data: {
                    messageKo: "패키지 재생성(또는 검증)이 완료되었습니다.",
                    validation
                }
            });
        }
        catch (err) {
            const caseId = req.params.caseId || "unknown";
            (0, http_1.logError)({ endpoint: "/v1/ops/cases/:caseId/packages/regenerate", caseId, code: "INTERNAL", messageKo: "재생성 실패", err });
            console.error("Regenerate Failed:", err);
            return (0, http_1.fail)(res, 500, "INTERNAL", `재생성 실패: ${err.message || "알 수 없는 오류"}`);
        }
    });
}
//# sourceMappingURL=packages.js.map