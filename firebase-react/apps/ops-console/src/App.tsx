import { useMemo, useState } from "react";
import { auth } from "@rp/firebase";
import { signInAnonymously } from "firebase/auth";
import "./App.css";

function App() {
  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE || "", []);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");
  const [errorBox, setErrorBox] = useState<{message: string, reqId?: string} | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [gate, setGate] = useState<string>("refund_approve");
  const [status, setStatus] = useState<string>("pending");
  const [caseId, setCaseId] = useState<string>("");
  const [caseDetail, setCaseDetail] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [gateEvidences, setGateEvidences] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [settlementPartnerId, setSettlementPartnerId] = useState<string>("p_demo_01");
  const [periodFrom, setPeriodFrom] = useState<string>("2026-01-01");
  const [periodTo, setPeriodTo] = useState<string>("2026-01-31");
  const [settlementIdForItems, setSettlementIdForItems] = useState<string>("");
  const [settlementItems, setSettlementItems] = useState<any[]>([]);
  const [summaryDate, setSummaryDate] = useState<string>(new Date().toLocaleDateString("en-CA").split("/").reverse().join("-"));
  const [gateReportText, setGateReportText] = useState<string>("");
  const [backlogItems, setBacklogItems] = useState<any[]>([]);
  const [recentFails, setRecentFails] = useState<any[]>([]);
  const [sev1Log, setSev1Log] = useState<{regenerateOk?: boolean; validateData?: any; reqId?: string}>({});

  async function ensureLogin() {
    if (!auth.currentUser) await signInAnonymously(auth);
    return await auth.currentUser!.getIdToken(true);
  }

  function handleError(e: any, defaultReqId?: string) {
    const msg = String(e?.message || e);
    const reqId = e?.reqId || defaultReqId;
    setErrorBox({ message: msg, reqId });
    setLog(`Error: ${msg}`);
  }

  function clearError() {
    setErrorBox(null);
  }

  async function apiGet(path: string) {
    clearError();
    const token = await ensureLogin();
    const resp = await fetch(`${apiBase}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const reqId = resp.headers.get("X-Request-Id") || "unknown";
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.ok) {
      const err = new Error(json.error?.messageKo || "요청 실패") as any;
      err.reqId = json.error?.requestId || reqId;
      throw err;
    }
    return json.data;
  }

  async function apiPost(path: string, body: any) {
    clearError();
    const token = await ensureLogin();
    const resp = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": crypto.randomUUID()
      },
      body: JSON.stringify(body)
    });
    const reqId = resp.headers.get("X-Request-Id") || "unknown";
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.ok) {
      const err = new Error(json.error?.messageKo || "요청 실패") as any;
      err.reqId = json.error?.requestId || reqId;
      throw err;
    }
    return json.data;
  }

  async function loadSummary() {
    setBusy(true);
    setGateReportText("");
    setBacklogItems([]);
    setRecentFails([]);
    try {
      const gateData = await apiGet(`/v1/ops/reports/pilot-gate/daily?date=${summaryDate}`);
      setGateReportText(gateData.copyText || "");
      
      const backlogData = await apiPost(`/v1/ops/reports/pilot-gate/backlog`, { date: summaryDate, topN: 3 });
      setBacklogItems(backlogData.items || []);
      
      // 최근 실패 케이스 같이 로드 (7일)
      const recentData = await apiGet(`/v1/ops/reports/pilot-gate/recent?days=7&onlyFail=1&limit=50`);
      setRecentFails(recentData.evidences || []);
      
      setLog(`오늘 운영 요약 로드 성공: 집계 완료, 백로그 후보 ${backlogData.items?.length ?? 0}건, 최근 실패 ${recentData.evidences?.length ?? 0}건`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function copyDailyLogMd() {
    setBusy(true);
    clearError();
    try {
      const token = await ensureLogin();
      const resp = await fetch(`${apiBase}/v1/ops/reports/pilot-gate/daily.md?date=${summaryDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        const reqId = resp.headers.get("X-Request-Id") || "unknown";
        const json = await resp.json().catch(() => ({}));
        const err = new Error(json?.error?.messageKo || "일일 로그를 불러올 수 없습니다.") as any;
        err.reqId = json?.error?.requestId || reqId;
        throw err;
      }
      const text = await resp.text();
      await navigator.clipboard.writeText(text);
      setLog("일일 로그(.md)가 클립보드에 복사되었습니다.");
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  function copyGateReport() {
    if (!gateReportText) return;
    navigator.clipboard.writeText(gateReportText)
      .then(() => setLog("복사 완료 (운영 로그용)"))
      .catch((e) => setLog(`복사 실패: ${e}`));
  }

  function copyBacklog() {
    if (!backlogItems.length) return;
    
    const lines = backlogItems.map(item => {
      const reproLines = item.reproSteps.split("\n").map((l: string) => "  " + l).join("\n");
      const acLines = item.acceptanceCriteria.split("\n").map((l: string) => "  " + l).join("\n");
      return `### ${item.title}
- **Sev**: ${item.severity}
- **영향도**: ${item.impactCount}건 발생
- **샘플 케이스**: ${item.sampleCaseIds.join(", ") || "없음"}
- **재현 단계**:
${reproLines}
- **AC (Acceptance Criteria)**:
${acLines}
- **Owner**: 
- **ETA**: `;
    });

    const markdown = lines.join("\n\n");
    navigator.clipboard.writeText(markdown)
      .then(() => setLog("백로그 복사 완료 (스프린트 백로그용)"))
      .catch((e) => setLog(`백로그 복사 실패: ${e}`));
  }

  async function downloadWeeklyBacklog() {
    setBusy(true);
    clearError();
    try {
      const token = await ensureLogin();
      const resp = await fetch(`${apiBase}/v1/ops/reports/pilot-gate/backlog.md`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        const reqId = resp.headers.get("X-Request-Id") || "unknown";
        const json = await resp.json().catch(() => ({}));
        const err = new Error(json?.error?.messageKo || `주간 백로그 다운로드 실패: ${resp.status}`) as any;
        err.reqId = json?.error?.requestId || reqId;
        throw err;
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const contentDisposition = resp.headers.get("Content-Disposition") || "";
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : "weekly_backlog.md";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setLog("주간 백로그 다운로드 완료");
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function becomeOpsApprover() {
    setBusy(true);
    try {
      await apiPost("/v1/dev/set-claims", { claims: { role: "ops_approver" } });
      setLog("dev: set claims role=ops_approver (token refresh 필요)");
      await ensureLogin();
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function loadApprovals() {
    setBusy(true);
    try {
      const data = await apiGet(`/v1/ops/approvals?status=${encodeURIComponent(status)}&gate=${encodeURIComponent(gate)}`);
      setItems(data.items || []);
      setLog(`loaded approvals: ${data.items?.length ?? 0}`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function decide(approvalId: string, decision: "approve" | "reject") {
    setBusy(true);
    try {
      const data = await apiPost(`/v1/ops/approvals/${approvalId}/decision`, { decision, reasonKo: "ops-console 테스트" });
      setLog(`decision ok: ${approvalId} -> ${data.status}`);
      await loadApprovals();
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function executeRefund(it: any) {
    setBusy(true);
    clearError();
    try {
      const token = await ensureLogin();
      const t = it.target;
      const resp = await fetch(`${apiBase}/v1/cases/${t.caseId}/refunds/${t.refundId}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": crypto.randomUUID()
        },
        body: JSON.stringify({ approvalId: it.id })
      });
      const reqId = resp.headers.get("X-Request-Id") || "unknown";
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) {
        const err = new Error(json?.error?.messageKo || "요청 실패") as any;
        err.reqId = json?.error?.requestId || reqId;
        throw err;
      }
      setLog(`refund executed: ${t.refundId}`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function loadCaseDetail() {
    if (!caseId) {
      handleError("caseId가 필요합니다.");
      return;
    }
    await loadCaseDetailWithId(caseId);
  }

  async function loadCaseDetailWithId(cid: string) {
    setBusy(true);
    setSev1Log({});
    try {
      const c = await apiGet(`/v1/cases/${cid}`);
      const t = await apiGet(`/v1/cases/${cid}/timeline?limit=50`);
      const d = await apiGet(`/v1/cases/${cid}/documents`);
      
      let g = { evidences: [] };
      try {
        g = await apiGet(`/v1/ops/reports/pilot-gate/by-case?caseId=${cid}&limit=10`);
      } catch (ge) {
        console.warn("gate evidence 로드 실패:", ge);
      }

      setCaseDetail(c.case);
      setTimeline(t.items || []);
      setDocuments(d.items || []);
      setGateEvidences(g.evidences || []);
      setLog("case detail loaded");
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function doSev1HotfixFull() {
    setBusy(true);
    setSev1Log({});
    clearError();
    try {
      // 1. 패키지 재생성
      setLog("Sev1 핫픽스: 패키지 재생성 시작...");
      await apiPost(`/v1/ops/cases/${caseId}/packages/regenerate`, {});
      setSev1Log(prev => ({ ...prev, regenerateOk: true }));

      // 2. Gate 재검증
      setLog("Sev1 핫픽스: 패키지 재생성 완료. Gate 재검증 시작...");
      const token = await ensureLogin();
      const resp = await fetch(`${apiBase}/v1/cases/${caseId}/packages/validate`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const reqId = resp.headers.get("X-Request-Id") || "unknown";
      const json = await resp.json().catch(() => ({}));
      
      if (!resp.ok || !json.ok) {
         setSev1Log(prev => ({ ...prev, validateData: null, reqId: json.error?.requestId || reqId }));
         const err = new Error(json.error?.messageKo || "검증 요청 실패") as any;
         err.reqId = json.error?.requestId || reqId;
         throw err;
      }
      
      setSev1Log(prev => ({ ...prev, validateData: json.data, reqId }));
      
      // 3. 복사 텍스트 생성
      const text = `[Sev1 Hotfix] caseId=${caseId}, requestId=${reqId}
regenerate=ok, validate=ok, evidenceId=${json.data?.evidenceId}
next=재검증 재시도/파트너 문의/수동 확인`;
      await navigator.clipboard.writeText(text);
      
      setLog(`Sev1 핫픽스 완료! 재검증 성공 (evidenceId: ${json.data?.evidenceId}). 클립보드에 결과가 복사되었습니다.`);
      await loadCaseDetailWithId(caseId);
    } catch (e: any) {
      handleError(e);
      
      // 실패 시에도 복사 텍스트 생성 시도 (현재 상태 기반)
      setSev1Log(prev => {
        const text = `[Sev1 Hotfix] caseId=${caseId}, requestId=${prev.reqId || e?.reqId || "N/A"}
regenerate=${prev.regenerateOk ? "ok" : "fail"}, validate=fail, evidenceId=N/A
next=재검증 재시도/파트너 문의/수동 확인`;
        navigator.clipboard.writeText(text).catch(() => {});
        return prev;
      });
    } finally {
      setBusy(false);
    }
  }

  function handleLoadCaseFromBacklog(cid: string) {
    setCaseId(cid);
    loadCaseDetailWithId(cid);
  }

  async function doRegenerate() {
    setBusy(true);
    try {
      await apiPost(`/v1/ops/cases/${caseId}/packages/regenerate`, {});
      setSev1Log(prev => ({ ...prev, regenerateOk: true }));
      setLog("패키지 재생성 성공");
    } catch (e: any) {
      setSev1Log(prev => ({ ...prev, regenerateOk: false }));
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function doValidate() {
    setBusy(true);
    clearError();
    try {
      const token = await ensureLogin();
      const resp = await fetch(`${apiBase}/v1/cases/${caseId}/packages/validate`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const reqId = resp.headers.get("X-Request-Id") || "unknown";
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) {
         setSev1Log(prev => ({ ...prev, validateData: null, reqId: json.error?.requestId || reqId }));
         const err = new Error(json.error?.messageKo || "요청 실패") as any;
         err.reqId = json.error?.requestId || reqId;
         throw err;
      }
      setSev1Log(prev => ({ ...prev, validateData: json.data, reqId }));
      setLog(`재검증 성공 (evidenceId: ${json.data?.evidenceId})`);
      await loadCaseDetailWithId(caseId);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  function copySev1Log() {
    const text = `[Sev1 Hotfix] caseId=${caseId}, requestId=${sev1Log.reqId || "N/A"}
regenerate=${sev1Log.regenerateOk ? "ok" : "fail"}, validate=${sev1Log.validateData ? "ok" : "fail"}, evidenceId=${sev1Log.validateData?.evidenceId || "N/A"}
next=재검증 재시도/파트너 문의/수동 확인`;
    navigator.clipboard.writeText(text).then(() => setLog("운영 로그용 3줄 복사 완료")).catch(e => setLog("복사 실패: " + e));
  }

  async function loadSettlements() {
    setBusy(true);
    try {
      const data = await apiGet("/v1/ops/settlements");
      setSettlements(data.items || []);
      setLog(`loaded settlements: ${data.items?.length ?? 0}`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function generateSettlement() {
    setBusy(true);
    try {
      const data = await apiPost("/v1/ops/settlements/generate", {
        partnerId: settlementPartnerId,
        periodFrom,
        periodTo
      });
      setLog(`settlement generated: ${data.settlementId}`);
      await loadSettlements();
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function paySettlement(settlementId: string) {
    setBusy(true);
    try {
      const data = await apiPost(`/v1/ops/settlements/${settlementId}/pay`, {});
      setLog(`settlement paid: ${data.settlementId}`);
      await loadSettlements();
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function loadSettlementItems() {
    setBusy(true);
    try {
      if (!settlementIdForItems) {
        handleError("settlementId가 필요합니다.");
        return;
      }
      const data = await apiGet(`/v1/ops/settlements/${settlementIdForItems}/items`);
      setSettlementItems(data.items || []);
      setLog(`loaded settlement items: ${data.items?.length ?? 0}`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Ops Console (MVP UI)</h1>
      <p style={{ color: "#666" }}>승인 큐 조회/결정까지 연결한 최소 운영 화면입니다.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button disabled={busy} onClick={() => signInAnonymously(auth).then(() => setLog("signed in (anonymous)"))}>
          익명 로그인
        </button>
        <button disabled={busy} onClick={becomeOpsApprover}>
          dev: ops_approver 전환
        </button>
        <select value={gate} onChange={(e) => setGate(e.target.value)} disabled={busy}>
          <option value="refund_approve">refund_approve</option>
          <option value="quote_finalize">quote_finalize</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={busy}>
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
        <button disabled={busy} onClick={loadApprovals}>
          승인 큐 로드
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <div><strong>API Base</strong>: {apiBase || "(not set)"}</div>
      </div>

      {errorBox && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #f44336", borderRadius: 8, background: "#ffebee", color: "#d32f2f" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>에러 발생:</strong> {errorBox.message}
            </div>
            {errorBox.reqId && errorBox.reqId !== "unknown" && (
              <button 
                onClick={() => navigator.clipboard.writeText(errorBox.reqId || "")}
                style={{ background: "#d32f2f", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer" }}
              >
                Request ID 복사
              </button>
            )}
          </div>
          {errorBox.reqId && errorBox.reqId !== "unknown" && (
            <div style={{ marginTop: 4, fontSize: "0.85em" }}>Request ID: {errorBox.reqId}</div>
          )}
        </div>
      )}

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8, background: "#f9f9f9" }}>
        <h2 style={{ margin: "0 0 8px 0", color: "#333" }}>오늘 운영 요약</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            대상 일자:{" "}
            <input
              type="date"
              value={summaryDate}
              onChange={(e) => setSummaryDate(e.target.value)}
              disabled={busy}
              style={{ padding: 6 }}
            />
          </label>
          <button disabled={busy || !summaryDate} onClick={loadSummary}>
            오늘 요약 가져오기
          </button>
          <button disabled={busy} onClick={downloadWeeklyBacklog} style={{ background: "#9c27b0", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", marginLeft: "auto" }}>
            주간 리뷰용 다운로드 (최근 7일 .md)
          </button>
        </div>
        
        <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          {/* 일일 Gate 집계 영역 */}
          <div style={{ flex: "1 1 300px", background: "#fff", padding: 12, border: "1px solid #eee", borderRadius: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: "1.1em" }}>A. 일일 Gate 집계</h3>
              {gateReportText && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={copyGateReport} style={{ background: "#4caf50", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer" }}>
                    [단순 요약 복사]
                  </button>
                  <button onClick={copyDailyLogMd} style={{ background: "#1976d2", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                    [일일 로그(복붙용) 복사]
                  </button>
                </div>
              )}
            </div>
            {gateReportText ? (
              <pre style={{ margin: 0, padding: 8, background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 4, whiteSpace: "pre-wrap", wordWrap: "break-word", fontSize: "0.9em" }}>
                {gateReportText}
              </pre>
            ) : (
              <div style={{ color: "#999", fontSize: "0.9em" }}>요약을 가져오면 표시됩니다.</div>
            )}
          </div>

          {/* 백로그 후보 영역 */}
          <div style={{ flex: "2 1 400px", background: "#fff", padding: 12, border: "1px solid #eee", borderRadius: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: "1.1em" }}>B. 백로그 후보</h3>
              {backlogItems.length > 0 && (
                <button onClick={copyBacklog} style={{ background: "#2196f3", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer" }}>
                  [스프린트 백로그용 복사]
                </button>
              )}
            </div>
            {backlogItems.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>Sev</th>
                    <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>제목</th>
                    <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>영향도</th>
                    <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>샘플케이스</th>
                  </tr>
                </thead>
                <tbody>
                  {backlogItems.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                        <span style={{ 
                          background: item.severity === 1 ? "#ffebee" : item.severity === 2 ? "#fff3e0" : "#f5f5f5", 
                          color: item.severity === 1 ? "#d32f2f" : item.severity === 2 ? "#e64a19" : "#616161",
                          padding: "2px 6px", borderRadius: 4, fontWeight: "bold" 
                        }}>
                          Sev{item.severity}
                        </span>
                      </td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>{item.title}</td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>{item.impactCount}건</td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 6, fontSize: "0.9em", color: "#666" }}>
                        {item.sampleCaseIds.map((cid: string) => (
                          <span key={cid} style={{ cursor: "pointer", textDecoration: "underline", marginRight: 8, color: "#1890ff" }} onClick={() => handleLoadCaseFromBacklog(cid)}>
                            {cid}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: "#999", fontSize: "0.9em" }}>백로그 후보가 없거나 요약을 가져오지 않았습니다.</div>
            )}
          </div>
          {/* 최근 실패 케이스 영역 */}
          <div style={{ flex: "1 1 100%", background: "#fff", padding: 12, border: "1px solid #eee", borderRadius: 6, marginTop: 16 }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1em", color: "#d32f2f" }}>C. 최근 7일 실패 케이스 (최신 50건)</h3>
            {recentFails.length > 0 ? (
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                  <thead style={{ position: "sticky", top: 0, background: "#fff" }}>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>validatedAt</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>caseId</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>누락 서류</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>evidenceId</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentFails.map((fail, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? "#fafafa" : "#fff" }}>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6, color: "#666" }}>
                          {new Date(fail.validatedAt).toLocaleString()}
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                          <span 
                            style={{ cursor: "pointer", textDecoration: "underline", color: "#1890ff", fontWeight: "bold" }} 
                            onClick={() => handleLoadCaseFromBacklog(fail.caseId)}
                          >
                            {fail.caseId}
                          </span>
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6, color: "#d32f2f" }}>
                          {fail.missingTop3.join(", ")} {fail.missingCount > 3 ? `(+${fail.missingCount - 3})` : ""}
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6, color: "#999", fontSize: "0.85em" }}>
                          {fail.evidenceId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: "#999", fontSize: "0.9em" }}>최근 7일간 실패 케이스가 없거나 조회 전입니다.</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>케이스 조회</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            caseId{" "}
            <input value={caseId} onChange={(e) => setCaseId(e.target.value)} style={{ width: 360, padding: 6 }} />
          </label>
          <button disabled={busy} onClick={loadCaseDetail}>조회</button>
        </div>
        {caseDetail && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* A. Case 요약 */}
            <div style={{ padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
              <h3 style={{ margin: "0 0 8px 0" }}>A. Case 요약</h3>
              <div><strong>status</strong>: {caseDetail.status}</div>
              <div><strong>stage</strong>: {caseDetail.stage || "-"}</div>
              <div><strong>updatedAt</strong>: {new Date(caseDetail.updatedAt).toLocaleString()}</div>
              <div><strong>partnerId</strong>: {caseDetail.partnerId}</div>
            </div>

            {/* B. Documents 요약 */}
            <div style={{ padding: 12, background: "#fff3e0", borderRadius: 6 }}>
              <h3 style={{ margin: "0 0 8px 0" }}>B. Documents (최근 10개)</h3>
              {documents.length === 0 ? (
                <div style={{ color: "#666" }}>없음</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>slotId</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>status</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>fileName</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>updatedAt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.slice(0, 10).map((d) => {
                      const v = d.latestVersionId ? d.versions?.[d.latestVersionId] : null;
                      return (
                        <tr key={d.id}>
                          <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{d.slotId}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: 4, color: d.status !== "ok" ? "red" : "inherit" }}>{d.status}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{v?.fileName || "-"}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{new Date(d.updatedAt).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* C. Timeline 최근 20개 */}
            <div style={{ padding: 12, background: "#e3f2fd", borderRadius: 6 }}>
              <h3 style={{ margin: "0 0 8px 0" }}>C. Timeline (최근 20개)</h3>
              {timeline.length === 0 ? (
                <div style={{ color: "#666" }}>없음</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.9em" }}>
                  {timeline.slice(0, 20).map((e) => (
                    <li key={e.id}>
                      [{new Date(e.occurredAt).toLocaleString()}] {e.type} / {e.summaryKo}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* D. Gate evidence 최근 10개 */}
            <div style={{ padding: 12, background: "#e8f5e9", borderRadius: 6 }}>
              <h3 style={{ margin: "0 0 8px 0" }}>D. Gate Evidence (최근 10개)</h3>
              {/* @ts-ignore */}
              {typeof gateEvidences === 'undefined' || !gateEvidences || gateEvidences.length === 0 ? (
                <div style={{ color: "#666" }}>없음</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>validatedAt</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>ok</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>missingCount</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>missing[]</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* @ts-ignore */}
                    {gateEvidences.map((g) => (
                      <tr key={g.evidenceId}>
                        <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{g.validatedAt}</td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 4, color: g.ok ? "green" : "red", fontWeight: "bold" }}>
                          {g.ok ? "true" : "false"}
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{g.missingCount}</td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{g.missing?.join(", ") || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* E. Sev1 핫픽스 대응 (접수증 누락 등) */}
            {gateEvidences?.[0]?.missing?.includes("slot_filing_receipt") && (
              <div style={{ padding: 12, background: "#ffebee", borderRadius: 6, border: "1px solid #ffcdd2" }}>
                <h3 style={{ margin: "0 0 8px 0", color: "#d32f2f" }}>E. Sev1 핫픽스 (접수증 누락 대응)</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                  <button disabled={busy} onClick={doSev1HotfixFull} style={{ background: "#4caf50", color: "white", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>⚡️ 원클릭 자동 핫픽스 (재생성 + 재검증 + 복사)</button>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button disabled={busy} onClick={doRegenerate} style={{ background: "#d32f2f", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}>1. 패키지 재생성</button>
                  <button disabled={busy} onClick={doValidate} style={{ background: "#d32f2f", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}>2. Gate 재검증</button>
                  <button disabled={!sev1Log.reqId} onClick={copySev1Log} style={{ background: "#424242", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}>[운영 로그용 3줄 복사]</button>
                </div>
                {sev1Log.reqId && (
                  <div style={{ marginTop: 8, fontSize: "0.9em", color: "#d32f2f" }}>
                    <div>재생성: {sev1Log.regenerateOk ? "✅ 성공" : "-"}</div>
                    <div>재검증: {sev1Log.validateData ? `✅ evidenceId: ${sev1Log.validateData.evidenceId} (ok: ${sev1Log.validateData.ok})` : "❌ 실패"}</div>
                    <div>Req ID: {sev1Log.reqId}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>정산(ops)</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>partnerId <input value={settlementPartnerId} onChange={(e) => setSettlementPartnerId(e.target.value)} style={{ width: 160, padding: 6 }} /></label>
          <label>from <input value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} style={{ width: 120, padding: 6 }} /></label>
          <label>to <input value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} style={{ width: 120, padding: 6 }} /></label>
          <button disabled={busy} onClick={generateSettlement}>정산 생성</button>
          <button disabled={busy} onClick={loadSettlements}>정산 목록 로드</button>
        </div>
        {settlements.length === 0 ? (
          <div style={{ marginTop: 8, color: "#666" }}>정산이 없습니다.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>id</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>partnerId</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>period</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>status</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>actions</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{s.id}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{s.partnerId}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{s.period?.from} ~ {s.period?.to}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{s.status}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <div style={{ color: "#666", marginBottom: 6, fontSize: 12 }}>
                      gross {s.amountGross?.amount} / refunds {s.amountRefunds?.amount} / offset {s.amountOffset?.amount} / payout {s.amountPayout?.amount} {s.currency}
                    </div>
                    <button disabled={busy || s.status === "paid"} onClick={() => paySettlement(s.id)}>지급 처리</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 12 }}>
          <strong>정산 아이템(대사)</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
            <input
              value={settlementIdForItems}
              onChange={(e) => setSettlementIdForItems(e.target.value)}
              placeholder="settlementId 입력"
              style={{ width: 280, padding: 6 }}
            />
            <button disabled={busy} onClick={loadSettlementItems}>아이템 로드</button>
          </div>
          {settlementItems.length > 0 && (
            <ul style={{ marginTop: 8 }}>
              {settlementItems.slice(0, 10).map((it) => (
                <li key={it.id}>{it.type} / {it.amount?.amount}{it.amount?.currency}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {items.length === 0 ? (
          <div style={{ color: "#666" }}>pending approvals가 없습니다.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>approvalId</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>gate</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>summaryKo</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{it.id}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{it.gate}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{it.summaryKo}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <button disabled={busy} onClick={() => decide(it.id, "approve")}>승인</button>{" "}
                    <button disabled={busy} onClick={() => decide(it.id, "reject")}>반려</button>
                    {gate === "refund_approve" && status === "approved" && it.target?.type === "refund" && (
                      <>
                        {" "}
                        <button disabled={busy} onClick={() => executeRefund(it)}>집행</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <pre style={{ marginTop: 16, background: "#111", color: "#eee", padding: 12, borderRadius: 8, overflowX: "auto" }}>
        {log || "ready"}
      </pre>
    </div>
  );
}

export default App;
