import type express from "express";
import type * as admin from "firebase-admin";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, WidthType } from "docx";

import { requireAuth, isOps, partnerIdOf } from "../../lib/auth";
import { fail, logError } from "../../lib/http";
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

function formatKstYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
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
  // Gate 일일 집계록(MD) 조회 API (운영용)
  app.get("/v1/ops/reports/pilot-gate/daily.md", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) {
        const requestId = req.headers["x-request-id"] || req.body?._requestId || "N/A";
        logError({ endpoint: "/v1/ops/reports/pilot-gate/daily.md", code: "FORBIDDEN", messageKo: "운영자만 접근 가능합니다." });
        return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      }

      const dateParam = String(req.query.date || "");
      const targetDateStr = dateParam ? dateParam : formatKstYmd();
      const targetDate = new Date(targetDateStr);

      if (isNaN(targetDate.getTime())) {
        logError({ endpoint: "/v1/ops/reports/pilot-gate/daily.md", code: "INVALID_ARGUMENT", messageKo: "날짜 형식이 잘못되었습니다." });
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
      
      const missingStats: Record<string, { impactCount: number, evidenceIds: Set<string>, sampleCaseIds: Set<string> }> = {};

      for (const d of docs) {
        if (d.ok === false || d.status === "fail") {
          failCases.add(d.caseId);
          const evId = d.evidenceId;
          const caseId = d.caseId;
          
          if (Array.isArray(d.missing)) {
            for (const m of d.missing) {
              missingCount[m] = (missingCount[m] || 0) + 1;
              if (!missingStats[m]) missingStats[m] = { impactCount: 0, evidenceIds: new Set(), sampleCaseIds: new Set() };
              missingStats[m].impactCount++;
              missingStats[m].evidenceIds.add(evId);
              missingStats[m].sampleCaseIds.add(caseId);
            }
          }
        }
      }

      const topMissing = Object.entries(missingCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(e => `${e[0]}(${e[1]}건)`);

      const sampleFailCaseIds = Array.from(failCases).slice(0, 3);

      const items = Object.entries(missingStats).map(([slotId, stats]) => {
        let sevNum = 3;
        if (slotId === "slot_filing_receipt") sevNum = 1;
        else if (slotId.endsWith("_signed")) sevNum = 2;

        return {
          slotId,
          severity: `Sev${sevNum}`,
          impactCount: stats.impactCount
        };
      });

      items.sort((a, b) => a.severity.localeCompare(b.severity) || b.impactCount - a.impactCount);
      const top3Items = items.slice(0, 3);

      let markdown = `### (품질) /packages/validate\n`;
      markdown += `- Gate 집계 결과:\n`;
      markdown += `  [${targetDateStr} Gate 집계] 총 ${total}건 (성공: ${okCount}건, 실패: ${failCount}건)\n`;
      
      if (failCount > 0) {
        markdown += `  - 주요 누락서류: ${topMissing.join(", ") || "없음"}\n`;
        markdown += `  - 실패 샘플(최대3건): ${sampleFailCaseIds.join(", ") || "없음"}\n`;
      }
      
      markdown += `\n### (이슈) Top3 이슈(고정 포맷)\n\n`;
      markdown += `| 제목 | Sev(1~3) | 영향(몇 케이스) | 재현 steps | 관련 caseId | 현재상태(조치중·대기·완료) | 오너 | ETA | 비고 |\n`;
      markdown += `|---|---:|---:|---|---|---|---|---|---|\n`;
      
      if (top3Items.length === 0) {
        markdown += `| 없음 | - | - | - | - | - | - | - | - |\n`;
        markdown += `| 없음 | - | - | - | - | - | - | - | - |\n`;
        markdown += `| 없음 | - | - | - | - | - | - | - | - |\n`;
      } else {
        top3Items.forEach((item) => {
          markdown += `| [게이트 누락] ${item.slotId} 검증 실패 | ${item.severity.replace('Sev', '')} | ${item.impactCount} | - | - | 대기 | ops | TBD | - |\n`;
        });
        // 3줄을 맞추기 위해 빈 행 추가
        for (let i = top3Items.length; i < 3; i++) {
          markdown += `| 없음 | - | - | - | - | - | - | - | - |\n`;
        }
      }

      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      return res.status(200).send(markdown);
    } catch (err: any) {
      logError({ endpoint: "/v1/ops/reports/pilot-gate/daily.md", code: "INTERNAL", messageKo: "일일 로그 생성 중 시스템 오류가 발생했습니다.", err });
      return fail(res, 500, "INTERNAL", "일일 로그 생성 중 시스템 오류가 발생했습니다.");
    }
  });

  // Gate 일일 집계 API (운영용)
  app.get("/v1/ops/reports/pilot-gate/daily", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) {
        logError({ endpoint: "/v1/ops/reports/pilot-gate/daily", code: "FORBIDDEN", messageKo: "운영자만 접근 가능합니다." });
        return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      }
  
      const dateParam = String(req.query.date || "");
      const targetDateStr = dateParam ? dateParam : formatKstYmd();
      const targetDate = new Date(targetDateStr);
      
      if (isNaN(targetDate.getTime())) {
        logError({ endpoint: "/v1/ops/reports/pilot-gate/daily", code: "INVALID_ARGUMENT", messageKo: "날짜 형식이 잘못되었습니다." });
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
    } catch (err: any) {
      logError({ endpoint: "/v1/ops/reports/pilot-gate/daily", code: "INTERNAL", messageKo: "집계 중 시스템 오류가 발생했습니다.", err });
      return fail(res, 500, "INTERNAL", "집계 중 시스템 오류가 발생했습니다.");
    }
  });

  // 일일 로그 SSOT 단일 조회
  app.get("/v1/ops/reports/pilot-gate/daily/ssot", async (req, res) => {
    try {
      const dateParam = String(req.query.date || "");
      const targetDateStr = dateParam ? dateParam : formatKstYmd();
      const targetDate = new Date(`${targetDateStr}T00:00:00+09:00`);
      
      if (isNaN(targetDate.getTime())) {
        return fail(res, 400, "INVALID_ARGUMENT", "유효하지 않은 날짜입니다.");
      }

      const logDocRef = adminApp.firestore().collection("ops_daily_logs").doc(targetDateStr);
      const logDoc = await logDocRef.get();

      if (!logDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "해당 날짜의 SSOT 로그가 없습니다.");
      }

      return res.status(200).json({ ok: true, data: logDoc.data() });
    } catch (e: any) {
      console.error("[daily ssot get error]", e);
      return fail(res, 500, "INTERNAL", e.message);
    }
  });

  // 최근 SSOT 목록 조회
  app.get("/v1/ops/reports/pilot-gate/daily/ssot/recent", async (req, res) => {
    try {
      const days = Number(req.query.days) || 7;
      if (days < 1 || days > 30) {
        return fail(res, 400, "INVALID_ARGUMENT", "days는 1~30 사이여야 합니다.");
      }

      const endStr = formatKstYmd(); // 오늘
      const d = new Date(`${endStr}T00:00:00+09:00`);
      d.setDate(d.getDate() - days);
      const startStr = formatKstYmd(d);

      const snap = await adminApp.firestore()
        .collection("ops_daily_logs")
        .where(adminApp.firestore.FieldPath.documentId(), ">=", startStr)
        .where(adminApp.firestore.FieldPath.documentId(), "<=", endStr)
        .orderBy(adminApp.firestore.FieldPath.documentId(), "desc")
        .get();

      const items = snap.docs.map(doc => {
        const data = doc.data();
        return {
          date: doc.id,
          requestId: data.requestId,
          createdAt: data.createdAt,
          metrics: data.metricsSnapshot
        };
      });

      return res.status(200).json({ ok: true, data: { items } });
    } catch (e: any) {
      console.error("[daily ssot recent error]", e);
      return fail(res, 500, "INTERNAL", e.message);
    }
  });

  // 일일 로그 SSOT에 자동 append (Firestore 기반)
  app.post("/v1/ops/reports/pilot-gate/daily/append", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) {
        return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      }

      const { date } = req.body;
      
      // 1. 입력 검증 및 Timezone 처리 (KST 기준)
      let targetDateStr = "";
      if (date) {
        const dateStr = String(date);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return fail(res, 400, "INVALID_ARGUMENT", "날짜 형식이 잘못되었습니다. YYYY-MM-DD 포맷을 사용해주세요.");
        }
        // 실존 날짜 검증 (round-trip)
        const parsedDate = new Date(`${dateStr}T00:00:00Z`);
        if (isNaN(parsedDate.getTime())) {
          return fail(res, 400, "INVALID_ARGUMENT", "유효하지 않은 날짜입니다.");
        }
        
        const roundTripStr = parsedDate.toISOString().split("T")[0];
        if (dateStr !== roundTripStr) {
          return fail(res, 400, "INVALID_ARGUMENT", "존재하지 않는 날짜입니다.");
        }
        targetDateStr = dateStr;
      } else {
        // 한국 시간(KST) 기준으로 오늘 날짜 구하기
        targetDateStr = formatKstYmd();
      }
      
      const targetDate = new Date(`${targetDateStr}T00:00:00+09:00`);
      if (isNaN(targetDate.getTime())) {
        return fail(res, 400, "INVALID_ARGUMENT", "유효하지 않은 날짜입니다.");
      }

      // 2. 동시성 및 중복 방지 (Firestore의 SSOT 문서 ID 활용)
      const logDocRef = adminApp.firestore().collection("ops_daily_logs").doc(targetDateStr);

      // 3. 집계 데이터 조회
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
      const missingStats: Record<string, { impactCount: number, evidenceIds: Set<string>, sampleCaseIds: Set<string> }> = {};

      for (const d of docs) {
        if (d.ok === false || d.status === "fail") {
          failCases.add(d.caseId);
          const evId = d.evidenceId;
          const caseId = d.caseId;
          
          if (Array.isArray(d.missing)) {
            for (const m of d.missing) {
              missingCount[m] = (missingCount[m] || 0) + 1;
              if (!missingStats[m]) missingStats[m] = { impactCount: 0, evidenceIds: new Set(), sampleCaseIds: new Set() };
              missingStats[m].impactCount++;
              missingStats[m].evidenceIds.add(evId);
              missingStats[m].sampleCaseIds.add(caseId);
            }
          }
        }
      }

      const topMissing = Object.entries(missingCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(e => `${e[0]}(${e[1]}건)`);

      const sampleFailCaseIds = Array.from(failCases).slice(0, 3);

      const items = Object.entries(missingStats).map(([slotId, stats]) => {
        let sevNum = 3;
        if (slotId === "slot_filing_receipt") sevNum = 1;
        else if (slotId.endsWith("_signed")) sevNum = 2;

        return { slotId, severity: `Sev${sevNum}`, impactCount: stats.impactCount };
      });

      items.sort((a, b) => a.severity.localeCompare(b.severity) || b.impactCount - a.impactCount);
      const top3Items = items.slice(0, 3);

      // 4. Markdown 포맷 생성
      let markdown = `### (품질) /packages/validate\n`;
      markdown += `- Gate 집계 결과:\n`;
      markdown += `  [${targetDateStr} Gate 집계] 총 ${total}건 (성공: ${okCount}건, 실패: ${failCount}건)\n`;
      
      if (failCount > 0) {
        markdown += `  - 주요 누락서류: ${topMissing.join(", ") || "없음"}\n`;
        markdown += `  - 실패 샘플(최대3건): ${sampleFailCaseIds.join(", ") || "없음"}\n`;
      }
      
      markdown += `\n### (이슈) Top3 이슈(고정 포맷)\n\n`;
      markdown += `| 제목 | Sev(1~3) | 영향(몇 케이스) | 재현 steps | 관련 caseId | 현재상태(조치중·대기·완료) | 오너 | ETA | 비고 |\n`;
      markdown += `|---|---:|---:|---|---|---|---|---|---|\n`;
      
      if (top3Items.length === 0) {
        markdown += `| 없음 | - | - | - | - | - | - | - | - |\n`.repeat(3);
      } else {
        top3Items.forEach((item) => {
          markdown += `| [게이트 누락] ${item.slotId} 검증 실패 | ${item.severity.replace('Sev', '')} | ${item.impactCount} | - | - | 대기 | ops | TBD | - |\n`;
        });
        for (let i = top3Items.length; i < 3; i++) {
          markdown += `| 없음 | - | - | - | - | - | - | - | - |\n`;
        }
      }

      const requestId = req.headers["x-request-id"] || req.body?._requestId || "N/A";
      
      // 5. Firestore에 저장 (create 사용으로 멱등성 보장 및 레이스 컨디션 방지)
      try {
        await logDocRef.create({
          date: targetDateStr,
          markdown,
          metrics: { total, okCount, failCount, topMissing, sampleFailCaseIds },
          topIssues: top3Items,
          createdAt: adminApp.firestore.FieldValue.serverTimestamp(),
          createdBy: auth.uid,
          requestId
        });
      } catch (e: any) {
        // Firebase Admin SDK (gRPC)에서 ALREADY_EXISTS는 보통 code 6 입니다.
        const isAlreadyExists = 
          e.code === 6 || 
          e.status === "ALREADY_EXISTS" ||
          (e.message && e.message.includes("ALREADY_EXISTS")) ||
          (e.details && e.details.includes("ALREADY_EXISTS"));

        if (isAlreadyExists) {
           logError({ endpoint: "/v1/ops/reports/pilot-gate/daily/append", code: "CONFLICT", messageKo: "해당 날짜의 로그가 이미 존재합니다.", err: e });
           return fail(res, 409, "CONFLICT", "해당 날짜의 로그가 이미 존재합니다.");
        }
        throw e;
      }

      const linesAdded = markdown.split("\n").length + 2; // +2 for separator visual logic if needed
      return res.status(200).send({ appended: true, linesAdded, requestId });
    } catch (err: any) {
      logError({ endpoint: "/v1/ops/reports/pilot-gate/daily/append", code: "INTERNAL", messageKo: "일일 로그 저장 중 시스템 오류가 발생했습니다.", err });
      return fail(res, 500, "INTERNAL", "일일 로그 저장 중 시스템 오류가 발생했습니다.");
    }
  });

  // 백로그 후보 자동화: Firestore SSOT → GitHub Issue 생성
  app.post("/v1/ops/reports/pilot-gate/backlog/issues/create", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) {
        return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      }

      const { date, dryRun = false, topN = 3 } = req.body;
      const targetDateStr = date ? String(date) : formatKstYmd();
      const targetDate = new Date(`${targetDateStr}T00:00:00+09:00`);
      
      if (isNaN(targetDate.getTime())) {
        return fail(res, 400, "INVALID_ARGUMENT", "유효하지 않은 날짜입니다.");
      }

      const logDocRef = adminApp.firestore().collection("ops_daily_logs").doc(targetDateStr);
      const logDoc = await logDocRef.get();
      if (!logDoc.exists) {
        return fail(res, 404, "NOT_FOUND", "먼저 SSOT 저장을 수행하세요.");
      }

      const logData = logDoc.data() as any;
      const topIssues = Array.isArray(logData.topIssues) ? logData.topIssues.slice(0, Number(topN)) : [];
      
      const created = [];
      const skipped = [];
      const GITHUB_TOKEN = process.env.GITHUB_TOKEN_BACKLOG_BOT || "";

      for (const issue of topIssues) {
        const dedupeKey = `pilot-gate:${targetDateStr}:${issue.slotId}`;
        const dedupeRef = adminApp.firestore().collection("ops_backlog_issues").doc(dedupeKey);
        
        try {
          // 1. 멱등성 확보를 위한 create
          if (!dryRun) {
            await dedupeRef.create({
              date: targetDateStr,
              slotId: issue.slotId,
              severity: issue.severity,
              impactCount: issue.impactCount,
              status: "pending",
              createdAt: adminApp.firestore.FieldValue.serverTimestamp()
            });
          }
          
          // 2. GitHub Issue 생성
          const title = `[pilot-gate][${issue.severity}][${targetDateStr}] ${issue.slotId} 누락 대응`;
          const body = `
### 이슈 개요
- **발생일**: ${targetDateStr}
- **영향도**: ${issue.impactCount}건 발생
- **SSOT 문서**: \`ops_daily_logs/${targetDateStr}\`
- **Req ID**: ${logData.requestId || "N/A"}

### 재현 단계
1. 파트너 콘솔에서 ${issue.slotId} 업로드 누락 또는 API 오류 확인
2. ${issue.slotId} 제출 로직 디버깅

### Acceptance Criteria (AC)
1. ${issue.slotId} 파일이 정상적으로 Storage에 업로드됨
2. Gate 검증 API 호출 시 missing 배열에 ${issue.slotId}가 포함되지 않음
3. ok: true 달성
          `.trim();

          const labels = ["ops", "automation", "backlog", issue.severity.toLowerCase()];
          
          let issueUrl = "dry-run-url";
          let issueNumber = 0;

          if (!dryRun) {
            if (!GITHUB_TOKEN) {
              throw new Error("GITHUB_TOKEN_BACKLOG_BOT is not configured.");
            }
            // Fetch to GitHub API
            const ghRes = await fetch("https://api.github.com/repos/beokadm-creator/agnet-eregi/issues", {
              method: "POST",
              headers: {
                "Accept": "application/vnd.github+json",
                "Authorization": `Bearer ${GITHUB_TOKEN}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                title,
                body,
                labels
              })
            });

            if (!ghRes.ok) {
              const errText = await ghRes.text();
              throw new Error(`GitHub API Error: ${ghRes.status} ${errText}`);
            }
            
            const ghData = await ghRes.json();
            issueUrl = ghData.html_url;
            issueNumber = ghData.number;
            
            await dedupeRef.update({
              issueNumber,
              issueUrl,
              updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
            });
          }
          
          created.push({ dedupeKey, issueUrl, issueNumber });
        } catch (e: any) {
          const isAlreadyExists = 
            e.code === 6 || 
            e.status === "ALREADY_EXISTS" ||
            (e.message && e.message.includes("ALREADY_EXISTS")) ||
            (e.details && e.details.includes("ALREADY_EXISTS"));
            
          if (isAlreadyExists) {
            skipped.push({ dedupeKey, reason: "ALREADY_EXISTS" });
          } else {
            console.error(`[backlog create error] dedupeKey=${dedupeKey}`, e);
            skipped.push({ dedupeKey, reason: e.message || "ERROR" });
            // 실패 시 롤백 (dryRun이 아닐 때만 create 했으므로)
            if (!dryRun && !isAlreadyExists) {
               await dedupeRef.delete().catch(() => {});
            }
          }
        }
      }

      return res.status(200).json({
        ok: true,
        data: {
          date: targetDateStr,
          created,
          skipped
        }
      });
    } catch (err: any) {
      logError({ endpoint: "/v1/ops/reports/pilot-gate/backlog/issues/create", code: "INTERNAL", messageKo: "이슈 생성 중 오류가 발생했습니다.", err });
      return fail(res, 500, "INTERNAL", "이슈 생성 중 오류가 발생했습니다.");
    }
  });

  // 백로그 자동화: 설정 SSOT 갱신 (Discovery)
  app.post("/v1/ops/reports/pilot-gate/backlog/project/discover", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) {
        return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      }

      const { projectId = process.env.GITHUB_PROJECT_ID } = req.body;
      const GITHUB_TOKEN = process.env.GITHUB_TOKEN_BACKLOG_BOT || "";

      if (!projectId || !GITHUB_TOKEN) {
        return fail(res, 400, "INVALID_ARGUMENT", "GITHUB_PROJECT_ID 또는 GITHUB_TOKEN_BACKLOG_BOT 설정이 누락되었습니다.");
      }

      // 정규화 함수: 소문자화, 공백/하이픈/언더스코어 제거
      const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, "");

      // Alias 후보 (기본 내장)
      const fieldAliases = {
        status: ["status", "state", "workflow", "상태", "진행상태", "워크플로우"],
        priority: ["priority", "prio", "우선순위", "중요도"],
        severity: ["severity", "sev", "등급", "심각도"]
      };

      const optionAliases = {
        "status.todo": ["todo", "to do", "할일", "할 일", "대기", "new"],
        "status.in_progress": ["in progress", "doing", "진행중", "진행 중"],
        "status.done": ["done", "complete", "완료"],
        "priority.p0": ["p0", "highest", "긴급", "최우선"],
        "priority.p1": ["p1", "high", "높음"],
        "priority.p2": ["p2", "medium", "보통"]
      };

      // Custom Aliases 병합
      const configDoc = await adminApp.firestore().collection("ops_github_project_config").doc("pilot-gate").get();
      const existingConfig = configDoc.exists ? configDoc.data() : {};
      const customAliases = existingConfig?.customAliases || {};

      if (customAliases.fieldAliases) {
        for (const [k, v] of Object.entries(customAliases.fieldAliases)) {
          if (Array.isArray(v) && fieldAliases[k as keyof typeof fieldAliases]) {
            fieldAliases[k as keyof typeof fieldAliases].push(...v);
          }
        }
      }
      if (customAliases.optionAliases) {
        for (const [k, v] of Object.entries(customAliases.optionAliases)) {
          if (Array.isArray(v) && optionAliases[k as keyof typeof optionAliases]) {
            optionAliases[k as keyof typeof optionAliases].push(...v);
          }
        }
      }

      // 1. GraphQL로 Project 필드 목록 조회
      const query = `
        query {
          node(id: "${projectId}") {
            ... on ProjectV2 {
              fields(first: 20) {
                nodes {
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                    options {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const ghRes = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query })
      });

      const ghData = await ghRes.json();
      if (ghData.errors) throw new Error(`GraphQL Error: ${JSON.stringify(ghData.errors)}`);

      const nodes = ghData.data.node.fields.nodes;
      
      const resolved: Record<string, any> = {};
      const missingMappings: string[] = [];

      // 매칭 로직
      for (const [fKey, fAliases] of Object.entries(fieldAliases)) {
        const normAliases = fAliases.map(norm);
        const node = nodes.find((n: any) => n.name && normAliases.includes(norm(n.name)));
        
        if (node) {
          resolved[`${fKey}FieldId`] = node.id;
          resolved[`${fKey}OptionIds`] = {};
          
          // 옵션 매칭
          const optPrefix = `${fKey}.`;
          for (const [oKey, oAliases] of Object.entries(optionAliases)) {
            if (!oKey.startsWith(optPrefix)) continue;
            const shortOKey = oKey.replace(optPrefix, ""); // e.g., "todo"
            const normOAliases = oAliases.map(norm);
            
            const optNode = node.options.find((o: any) => o.name && normOAliases.includes(norm(o.name)));
            if (optNode) {
              resolved[`${fKey}OptionIds`][shortOKey] = optNode.id;
            } else {
              missingMappings.push(oKey);
            }
          }
        } else {
          missingMappings.push(`${fKey}FieldId`);
        }
      }

      const configData = {
        projectId,
        rawFields: nodes,
        resolved,
        missingMappings,
        customAliases, // 유지
        updatedAt: adminApp.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.uid,
        source: "discovery"
      };

      // 2. Firestore 설정 SSOT에 저장
      await adminApp.firestore()
        .collection("ops_github_project_config")
        .doc("pilot-gate")
        .set(configData, { merge: true });

      return res.status(200).json({ ok: true, data: configData });
    } catch (err: any) {
      logError({ endpoint: "/v1/ops/reports/pilot-gate/backlog/project/discover", code: "INTERNAL", messageKo: "설정 갱신 중 오류가 발생했습니다.", err });
      return fail(res, 500, "INTERNAL", "설정 갱신 중 오류가 발생했습니다.");
    }
  });

  // 백로그 자동화: 설정 SSOT 조회
  app.get("/v1/ops/reports/pilot-gate/backlog/project/config", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const doc = await adminApp.firestore().collection("ops_github_project_config").doc("pilot-gate").get();
      if (!doc.exists) {
        return fail(res, 404, "NOT_FOUND", "Project 설정이 없습니다. 먼저 Discover API를 실행하세요.");
      }

      return res.status(200).json({ ok: true, data: doc.data() });
    } catch (err: any) {
      return fail(res, 500, "INTERNAL", err.message);
    }
  });

  // 백로그 자동화: Alias 수정 및 즉시 Resolve
  app.patch("/v1/ops/reports/pilot-gate/backlog/project/config/aliases", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const { customAliases } = req.body;
      if (!customAliases || typeof customAliases !== "object") {
        return fail(res, 400, "INVALID_ARGUMENT", "customAliases 객체가 필요합니다.");
      }

      const docRef = adminApp.firestore().collection("ops_github_project_config").doc("pilot-gate");
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return fail(res, 404, "NOT_FOUND", "Project 설정이 없습니다. 먼저 Discover API를 실행하세요.");
      }

      await docRef.set({ customAliases }, { merge: true });
      
      // 즉시 로컬 Resolve 호출을 위해 같은 모듈의 /resolve API 호출 흉내내거나
      // 내부 함수로 분리할 수도 있지만, 여기서는 fetch()를 통한 셀프 호출이나 로직 재활용 대신
      // 아래의 /resolve 엔드포인트를 클라이언트에서 이어서 호출하도록 가이드하거나 
      // 로직을 모듈 내 함수로 빼서 직접 호출할 수 있습니다. 
      // 빠른 구현을 위해 공통 로직을 즉석에서 다시 돌립니다.
      const config = (await docRef.get()).data() as any;
      const result = doResolve(config.rawFields || [], config.customAliases || {});
      
      await docRef.update({
        resolved: result.resolved,
        missingMappings: result.missingMappings,
        updatedAt: adminApp.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.uid
      });

      return res.status(200).json({ ok: true, data: { ...config, ...result } });
    } catch (err: any) {
      logError({ endpoint: "aliases patch", code: "INTERNAL", messageKo: "Alias 업데이트 실패", err });
      return fail(res, 500, "INTERNAL", "Alias 업데이트 실패");
    }
  });

  // 백로그 자동화: 로컬 재매칭 (Re-resolve)
  app.post("/v1/ops/reports/pilot-gate/backlog/project/resolve", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");

      const docRef = adminApp.firestore().collection("ops_github_project_config").doc("pilot-gate");
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return fail(res, 404, "NOT_FOUND", "Project 설정이 없습니다. 먼저 Discover API를 실행하세요.");
      }

      const config = docSnap.data() as any;
      if (!config.rawFields || !Array.isArray(config.rawFields)) {
         return fail(res, 400, "INVALID_ARGUMENT", "rawFields가 없습니다. Discover를 다시 실행하세요.");
      }

      const result = doResolve(config.rawFields, config.customAliases || {});

      await docRef.update({
        resolved: result.resolved,
        missingMappings: result.missingMappings,
        updatedAt: adminApp.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.uid
      });

      return res.status(200).json({ ok: true, data: result });
    } catch (err: any) {
      logError({ endpoint: "resolve post", code: "INTERNAL", messageKo: "Re-resolve 실패", err });
      return fail(res, 500, "INTERNAL", "Re-resolve 실패");
    }
  });

  // 내부 Resolve 함수 추출 (Discovery와 Re-resolve에서 공유)
  function doResolve(rawFields: any[], customAliases: any) {
    const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, "");

    const fieldAliases = {
      status: ["status", "state", "workflow", "상태", "진행상태", "워크플로우"],
      priority: ["priority", "prio", "우선순위", "중요도"],
      severity: ["severity", "sev", "등급", "심각도"]
    };

    const optionAliases = {
      "status.todo": ["todo", "to do", "할일", "할 일", "대기", "new"],
      "status.in_progress": ["in progress", "doing", "진행중", "진행 중"],
      "status.done": ["done", "complete", "완료"],
      "priority.p0": ["p0", "highest", "긴급", "최우선"],
      "priority.p1": ["p1", "high", "높음"],
      "priority.p2": ["p2", "medium", "보통"]
    };

    if (customAliases.fieldAliases) {
      for (const [k, v] of Object.entries(customAliases.fieldAliases)) {
        if (Array.isArray(v) && fieldAliases[k as keyof typeof fieldAliases]) {
          fieldAliases[k as keyof typeof fieldAliases].push(...(v as string[]));
        }
      }
    }
    if (customAliases.optionAliases) {
      for (const [k, v] of Object.entries(customAliases.optionAliases)) {
        if (Array.isArray(v) && optionAliases[k as keyof typeof optionAliases]) {
          optionAliases[k as keyof typeof optionAliases].push(...(v as string[]));
        }
      }
    }

    const resolved: Record<string, any> = {};
    const missingMappings: string[] = [];

    for (const [fKey, fAliases] of Object.entries(fieldAliases)) {
      const normAliases = fAliases.map(norm);
      const node = rawFields.find((n: any) => n.name && normAliases.includes(norm(n.name)));
      
      if (node) {
        resolved[`${fKey}FieldId`] = node.id;
        resolved[`${fKey}OptionIds`] = {};
        
        const optPrefix = `${fKey}.`;
        for (const [oKey, oAliases] of Object.entries(optionAliases)) {
          if (!oKey.startsWith(optPrefix)) continue;
          const shortOKey = oKey.replace(optPrefix, "");
          const normOAliases = oAliases.map(norm);
          
          const optNode = node.options?.find((o: any) => o.name && normOAliases.includes(norm(o.name)));
          if (optNode) {
            resolved[`${fKey}OptionIds`][shortOKey] = optNode.id;
          } else {
            missingMappings.push(oKey);
          }
        }
      } else {
        missingMappings.push(`${fKey}FieldId`);
      }
    }

    return { resolved, missingMappings };
  }

  // 백로그 자동화: GitHub Project V2 투입 API
  app.post("/v1/ops/reports/pilot-gate/backlog/issues/project/add", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) {
        return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      }

      const { date, dryRun = false, topN = 3 } = req.body;
      const targetDateStr = date ? String(date) : formatKstYmd();
      const targetDate = new Date(`${targetDateStr}T00:00:00+09:00`);
      
      if (isNaN(targetDate.getTime())) {
        return fail(res, 400, "INVALID_ARGUMENT", "유효하지 않은 날짜입니다.");
      }

      // 1. 이미 생성된 이슈 목록 가져오기
      const snap = await adminApp.firestore()
        .collection("ops_backlog_issues")
        .where("date", "==", targetDateStr)
        .limit(Number(topN))
        .get();

      if (snap.empty) {
        return fail(res, 404, "NOT_FOUND", "해당 날짜에 생성된 GitHub 이슈가 없습니다. (먼저 이슈를 생성하세요)");
      }

      const issues = snap.docs.map(d => ({ dedupeKey: d.id, ...d.data() })) as any[];

      const GITHUB_TOKEN = process.env.GITHUB_TOKEN_BACKLOG_BOT || "";
      // Field IDs (optional)
      const configDoc = await adminApp.firestore().collection("ops_github_project_config").doc("pilot-gate").get();
      if (!configDoc.exists) {
        return fail(res, 400, "INVALID_ARGUMENT", "Project 설정이 없습니다. 먼저 Discover API를 실행하세요.");
      }
      
      const config = configDoc.data() as any;
      const PROJECT_ID = config.projectId || process.env.GITHUB_PROJECT_ID || "";
      const resolved = config.resolved || {};
      const STATUS_FIELD_ID = resolved.statusFieldId || "";
      const PRIORITY_FIELD_ID = resolved.priorityFieldId || "";

      if (!dryRun && (!GITHUB_TOKEN || !PROJECT_ID)) {
        throw new Error("GITHUB_TOKEN_BACKLOG_BOT or GITHUB_PROJECT_ID is not configured.");
      }

      const added = [];
      const skipped = [];
      const failed = [];

      for (const issue of issues) {
        if (!issue.issueNumber) {
          skipped.push({ projectDedupeKey: issue.dedupeKey + ":project", reason: "이슈 번호가 없습니다." });
          continue;
        }

        const projectDedupeKey = `${issue.dedupeKey}:project`;
        const linkRef = adminApp.firestore().collection("ops_backlog_issue_project_links").doc(projectDedupeKey);

        try {
          if (!dryRun) {
            await linkRef.create({
              date: targetDateStr,
              slotId: issue.slotId,
              issueUrl: issue.issueUrl || "",
              issueNumber: issue.issueNumber,
              status: "pending",
              createdAt: adminApp.firestore.FieldValue.serverTimestamp()
            });
          }

          // 2. GraphQL API로 Project에 Add
          let projectItemId = "dry-run-item-id";

          if (!dryRun) {
            // Step A: Issue의 Node ID 획득 (GraphQL에 필요)
            const issueRes = await fetch(`https://api.github.com/repos/beokadm-creator/agnet-eregi/issues/${issue.issueNumber}`, {
              headers: {
                "Accept": "application/vnd.github+json",
                "Authorization": `Bearer ${GITHUB_TOKEN}`
              }
            });
            if (!issueRes.ok) throw new Error(`Issue fetch failed: ${issueRes.status}`);
            const issueData = await issueRes.json();
            const issueNodeId = issueData.node_id;

            // Step B: Project에 추가
            const addMutation = `
              mutation {
                addProjectV2ItemById(input: {projectId: "${PROJECT_ID}", contentId: "${issueNodeId}"}) {
                  item { id }
                }
              }
            `;
            
            const addRes = await fetch("https://api.github.com/graphql", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${GITHUB_TOKEN}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ query: addMutation })
            });
            
            const addData = await addRes.json();
            if (addData.errors) throw new Error(`GraphQL Error (add): ${JSON.stringify(addData.errors)}`);
            
            projectItemId = addData.data.addProjectV2ItemById.item.id;

            // Step C: 필드 업데이트 (Status, Priority 매핑)
            const sevNum = parseInt(issue.severity.replace("Sev", ""), 10);
            let priorityValue = "";
            if (sevNum === 1) priorityValue = "p0";
            else if (sevNum === 2) priorityValue = "p1";
            else priorityValue = "p2";

            const statusValue = "todo";

            const statusOptionId = resolved.statusOptionIds?.[statusValue];
            const priorityOptionId = resolved.priorityOptionIds?.[priorityValue];

            const missingForThisIssue = [];
            if (!STATUS_FIELD_ID) missingForThisIssue.push("statusFieldId");
            if (!statusOptionId) missingForThisIssue.push(`status.${statusValue}`);
            if (!PRIORITY_FIELD_ID) missingForThisIssue.push("priorityFieldId");
            if (!priorityOptionId) missingForThisIssue.push(`priority.${priorityValue}`);

            if (missingForThisIssue.length > 0) {
               throw new Error(`MISSING_MAPPING: ${missingForThisIssue.join(", ")}`);
            }

            if (STATUS_FIELD_ID && statusOptionId) {
              const updateStatusMutation = `
                mutation {
                  updateProjectV2ItemFieldValue(
                    input: {
                      projectId: "${PROJECT_ID}"
                      itemId: "${projectItemId}"
                      fieldId: "${STATUS_FIELD_ID}"
                      value: { singleSelectOptionId: "${statusOptionId}" }
                    }
                  ) { projectV2Item { id } }
                }
              `;
              await fetch("https://api.github.com/graphql", {
                method: "POST",
                headers: { "Authorization": `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify({ query: updateStatusMutation })
              });
            }

            if (PRIORITY_FIELD_ID && priorityOptionId) {
              const updatePriorityMutation = `
                mutation {
                  updateProjectV2ItemFieldValue(
                    input: {
                      projectId: "${PROJECT_ID}"
                      itemId: "${projectItemId}"
                      fieldId: "${PRIORITY_FIELD_ID}"
                      value: { singleSelectOptionId: "${priorityOptionId}" }
                    }
                  ) { projectV2Item { id } }
                }
              `;
              await fetch("https://api.github.com/graphql", {
                method: "POST",
                headers: { "Authorization": `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify({ query: updatePriorityMutation })
              });
            }

            await linkRef.update({
              projectItemId,
              status: "added",
              updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
            });
          }

          added.push({ projectDedupeKey, projectItemId, issueUrl: issue.issueUrl });
        } catch (e: any) {
          const isAlreadyExists = 
            e.code === 6 || 
            e.status === "ALREADY_EXISTS" ||
            (e.message && e.message.includes("ALREADY_EXISTS")) ||
            (e.details && e.details.includes("ALREADY_EXISTS"));
            
          if (isAlreadyExists) {
            skipped.push({ projectDedupeKey, reason: "ALREADY_EXISTS" });
          } else {
            console.error(`[project add error] key=${projectDedupeKey}`, e);
            let reason = e.message || "ERROR";
            let missing = [];
            let hint = "";
            
            if (reason.startsWith("MISSING_MAPPING: ")) {
              missing = reason.replace("MISSING_MAPPING: ", "").split(", ");
              reason = "MISSING_MAPPING";
              hint = "discover를 다시 실행하거나 alias를 추가하세요";
            }

            failed.push({ projectDedupeKey, reason, missing, hint, issueUrl: issue.issueUrl });
            if (!dryRun && !isAlreadyExists) {
               await linkRef.delete().catch(() => {});
            }
          }
        }
      }

      return res.status(200).json({
        ok: true,
        data: { added, skipped, failed }
      });
    } catch (err: any) {
      logError({ endpoint: "/v1/ops/reports/pilot-gate/backlog/issues/project/add", code: "INTERNAL", messageKo: "프로젝트 투입 중 오류가 발생했습니다.", err });
      return fail(res, 500, "INTERNAL", "프로젝트 투입 중 오류가 발생했습니다.");
    }
  });

  // Gate 백로그 후보 생성 API (운영용)
  app.post("/v1/ops/reports/pilot-gate/backlog", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) {
        logError({ endpoint: "/v1/ops/reports/pilot-gate/backlog", code: "FORBIDDEN", messageKo: "운영자만 접근 가능합니다." });
        return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      }
  
      const { date, topN = 3 } = req.body;
      const targetDateStr = date ? String(date) : formatKstYmd();
      const targetDate = new Date(targetDateStr);
      
      if (isNaN(targetDate.getTime())) {
        logError({ endpoint: "/v1/ops/reports/pilot-gate/backlog", code: "INVALID_ARGUMENT", messageKo: "날짜 형식이 잘못되었습니다." });
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
    } catch (err: any) {
      logError({ endpoint: "/v1/ops/reports/pilot-gate/backlog", code: "INTERNAL", messageKo: "백로그 생성 중 시스템 오류가 발생했습니다.", err });
      return fail(res, 500, "INTERNAL", "백로그 생성 중 시스템 오류가 발생했습니다.");
    }
  });

  // 최근 실패/최근 evidence 조회 API (운영용)
  app.get("/v1/ops/reports/pilot-gate/recent", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) {
        logError({ endpoint: "/v1/ops/reports/pilot-gate/recent", code: "FORBIDDEN", messageKo: "운영자만 접근 가능합니다." });
        return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      }

      const days = Number(req.query.days) || 7;
      const onlyFail = req.query.onlyFail === "1" || req.query.onlyFail === "true";
      const limitNum = Number(req.query.limit) || 50;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      let query = adminApp.firestore()
        .collection("pilot_gate_evidence")
        .where("validatedAt", ">=", adminApp.firestore.Timestamp.fromDate(startDate))
        .where("validatedAt", "<=", adminApp.firestore.Timestamp.fromDate(endDate));

      if (onlyFail) {
        query = query.where("ok", "==", false);
      }

      // 복합 색인이 필요할 수 있으므로, orderBy는 생략하고 메모리 정렬
      const snapshot = await query.get();

      const evidences = snapshot.docs.map(d => {
        const data = d.data();
        return {
          evidenceId: d.id,
          caseId: data.caseId,
          ok: data.ok,
          missingCount: Array.isArray(data.missing) ? data.missing.length : 0,
          missingTop3: Array.isArray(data.missing) ? data.missing.slice(0, 3) : [],
          validatedAt: fmtTs(data.validatedAt),
          env: data.env || "unknown"
        };
      });

      evidences.sort((a, b) => new Date(b.validatedAt).getTime() - new Date(a.validatedAt).getTime());
      
      return res.status(200).send({
        ok: true,
        data: { evidences: evidences.slice(0, limitNum) }
      });
    } catch (err: any) {
      logError({ endpoint: "/v1/ops/reports/pilot-gate/recent", code: "INTERNAL", messageKo: "조회 중 시스템 오류가 발생했습니다.", err });
      return fail(res, 500, "INTERNAL", "조회 중 시스템 오류가 발생했습니다.");
    }
  });

  // Ops Console: 특정 케이스 조회 API
  app.get("/v1/ops/reports/pilot-gate/by-case", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) {
        logError({ endpoint: "/v1/ops/reports/pilot-gate/by-case", code: "FORBIDDEN", messageKo: "운영자만 접근 가능합니다." });
        return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      }
  
      const caseId = req.query.caseId;
      if (!caseId || typeof caseId !== "string") {
        logError({ endpoint: "/v1/ops/reports/pilot-gate/by-case", code: "INVALID_ARGUMENT", messageKo: "caseId 파라미터가 필요합니다." });
        return fail(res, 400, "INVALID_ARGUMENT", "caseId 파라미터가 필요합니다.");
      }
      const limitNum = Number(req.query.limit) || 10;
  
      const snapshot = await adminApp.firestore()
        .collection("pilot_gate_evidence")
        .where("caseId", "==", caseId)
        .orderBy("validatedAt", "desc")
        .limit(limitNum)
        .get();
  
      const evidences = snapshot.docs.map(d => {
        const data = d.data();
        return {
          evidenceId: d.id,
          ok: data.ok,
          missingCount: Array.isArray(data.missing) ? data.missing.length : 0,
          missing: data.missing || [],
          validatedAt: fmtTs(data.validatedAt),
          env: data.env || "unknown"
        };
      });
  
      return res.status(200).send({
        ok: true,
        data: { evidences }
      });
    } catch (err: any) {
      logError({ endpoint: "/v1/ops/reports/pilot-gate/by-case", code: "INTERNAL", messageKo: "조회 중 시스템 오류가 발생했습니다.", err });
      return fail(res, 500, "INTERNAL", "조회 중 시스템 오류가 발생했습니다.");
    }
  });

  // 주간 리뷰용 내보내기 (markdown export)
  app.get("/v1/ops/reports/pilot-gate/backlog.md", async (req, res) => {
    try {
      const auth = await requireAuth(adminApp, req, res);
      if (!auth) return;
      if (!isOps(auth)) {
        logError({ endpoint: "/v1/ops/reports/pilot-gate/backlog.md", code: "FORBIDDEN", messageKo: "운영자만 접근 가능합니다." });
        return fail(res, 403, "FORBIDDEN", "운영자만 접근 가능합니다.");
      }
  
      const { week } = req.query; // YYYY-WW 형태, 없을 경우 지난 7일 기준
      let startDate: Date;
      let endDate: Date;
  
      if (week && typeof week === "string" && week.match(/^\d{4}-W\d{2}$/)) {
        const [yearStr, weekStr] = week.split("-W");
        const year = parseInt(yearStr, 10);
        const w = parseInt(weekStr, 10);
        // 간단한 주차 계산 (단순화: 1월 1일을 포함하는 주를 1주차로 계산)
        const jan1 = new Date(year, 0, 1);
        const daysOffset = (w - 1) * 7;
        startDate = new Date(year, 0, 1 + daysOffset - jan1.getDay());
        endDate = new Date(startDate.getTime());
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // 기본값: 오늘 기준 과거 7일
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate.getTime());
        startDate.setDate(endDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
      }
  
      const snapshot = await adminApp.firestore()
        .collection("pilot_gate_evidence")
        .where("validatedAt", ">=", adminApp.firestore.Timestamp.fromDate(startDate))
        .where("validatedAt", "<=", adminApp.firestore.Timestamp.fromDate(endDate))
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
        let severity = 3;
        if (slotId === "slot_filing_receipt") severity = 1;
        else if (slotId.endsWith("_signed")) severity = 2;
  
        return {
          title: `[게이트 누락] ${slotId} 검증 실패 자동화 대응`,
          severity,
          impactCount: stats.impactCount,
          evidenceIds: Array.from(stats.evidenceIds).slice(0, 3),
          sampleCaseIds: Array.from(stats.sampleCaseIds).slice(0, 3),
          reproSteps: `1. 파트너 콘솔에서 ${slotId} 업로드 누락 또는 API 오류 확인\n2. ${slotId} 제출 로직 디버깅`,
          acceptanceCriteria: `1. ${slotId} 파일이 정상적으로 Storage에 업로드됨\n2. Gate 검증 API 호출 시 missing 배열에 ${slotId}가 포함되지 않음\n3. ok: true 달성`
        };
      });
  
      items.sort((a, b) => a.severity - b.severity || b.impactCount - a.impactCount);
  
      const titleDateStr = `${formatKstYmd(startDate)} ~ ${formatKstYmd(endDate)}`;
      let markdown = `# 주간 Gate 검증 백로그 리뷰 (${titleDateStr})\n\n`;
      
      if (items.length === 0) {
        markdown += "해당 기간 동안 Gate 검증 실패(누락) 사례가 없습니다.\n";
      } else {
        for (const item of items) {
          markdown += `### ${item.title}\n`;
          markdown += `- **Sev**: ${item.severity}\n`;
          markdown += `- **영향도**: ${item.impactCount}건 발생\n`;
          markdown += `- **샘플 케이스**: ${item.sampleCaseIds.join(", ") || "없음"}\n`;
          markdown += `- **재현 단계**:\n${item.reproSteps.split("\\n").map(l => "  " + l).join("\\n")}\n`;
          markdown += `- **AC (Acceptance Criteria)**:\n${item.acceptanceCriteria.split("\\n").map(l => "  " + l).join("\\n")}\n`;
          markdown += `- **Owner**: \n`;
          markdown += `- **ETA**: \n\n`;
        }
      }
  
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="backlog_${titleDateStr.replace(/ /g, "_")}.md"`);
      return res.status(200).send(markdown);
    } catch (err: any) {
      logError({ endpoint: "/v1/ops/reports/pilot-gate/backlog.md", code: "INTERNAL", messageKo: "내보내기 중 시스템 오류가 발생했습니다.", err });
      return fail(res, 500, "INTERNAL", "내보내기 중 시스템 오류가 발생했습니다.");
    }
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

