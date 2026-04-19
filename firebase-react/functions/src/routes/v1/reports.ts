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
      const targetDateStr = dateParam ? dateParam : new Date().toLocaleDateString("en-CA").split("/").reverse().join("-");
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
      const targetDateStr = dateParam ? dateParam : new Date().toLocaleDateString("en-CA").split("/").reverse().join("-");
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
        const now = new Date();
        const kstFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });
        targetDateStr = kstFormatter.format(now); // "YYYY-MM-DD"
      }
      
      const targetDate = new Date(`${targetDateStr}T00:00:00+09:00`);
      if (isNaN(targetDate.getTime())) {
        return fail(res, 400, "INVALID_ARGUMENT", "유효하지 않은 날짜입니다.");
      }

      // 2. 동시성 및 중복 방지 (Firestore의 SSOT 문서 ID 활용)
      const logDocRef = adminApp.firestore().collection("ops_daily_logs").doc(targetDateStr);
      const logDoc = await logDocRef.get();
      
      if (logDoc.exists) {
        return fail(res, 409, "CONFLICT", "해당 날짜의 로그가 이미 존재합니다.");
      }

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
      const targetDateStr = date ? String(date) : new Date().toLocaleDateString("en-CA").split("/").reverse().join("-");
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
  
      const titleDateStr = `${startDate.toLocaleDateString("en-CA")} ~ ${endDate.toLocaleDateString("en-CA")}`;
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

