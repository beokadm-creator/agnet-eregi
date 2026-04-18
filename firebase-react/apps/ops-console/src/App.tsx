import { useMemo, useState } from "react";
import { auth } from "@rp/firebase";
import { signInAnonymously } from "firebase/auth";
import "./App.css";

function App() {
  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE || "", []);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [gate, setGate] = useState<string>("refund_approve");
  const [status, setStatus] = useState<string>("pending");
  const [caseId, setCaseId] = useState<string>("");
  const [caseDetail, setCaseDetail] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [settlementPartnerId, setSettlementPartnerId] = useState<string>("p_demo_01");
  const [periodFrom, setPeriodFrom] = useState<string>("2026-01-01");
  const [periodTo, setPeriodTo] = useState<string>("2026-01-31");
  const [settlementIdForItems, setSettlementIdForItems] = useState<string>("");
  const [settlementItems, setSettlementItems] = useState<any[]>([]);
  const [gateDate, setGateDate] = useState<string>(new Date().toLocaleDateString("en-CA").split("/").reverse().join("-"));
  const [gateReportText, setGateReportText] = useState<string>("");
  const [backlogDate, setBacklogDate] = useState<string>(new Date().toLocaleDateString("en-CA").split("/").reverse().join("-"));
  const [backlogItems, setBacklogItems] = useState<any[]>([]);

  async function ensureLogin() {
    if (!auth.currentUser) await signInAnonymously(auth);
    return await auth.currentUser!.getIdToken(true);
  }

  async function apiGet(path: string) {
    const token = await ensureLogin();
    const resp = await fetch(`${apiBase}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error?.messageKo || "요청 실패");
    return json.data;
  }

  async function apiPost(path: string, body: any) {
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
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error?.messageKo || "요청 실패");
    return json.data;
  }

  async function loadGateReport() {
    setBusy(true);
    setGateReportText("");
    try {
      const data = await apiGet(`/v1/ops/reports/pilot-gate/daily?date=${gateDate}`);
      setGateReportText(data.copyText || "");
      setLog("Gate 집계 로드 성공");
    } catch (e: any) {
      setLog(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  function copyGateReport() {
    if (!gateReportText) return;
    navigator.clipboard.writeText(gateReportText)
      .then(() => setLog("복사 완료"))
      .catch((e) => setLog(`복사 실패: ${e}`));
  }

  async function loadBacklog() {
    setBusy(true);
    setBacklogItems([]);
    try {
      const data = await apiPost(`/v1/ops/reports/pilot-gate/backlog`, { date: backlogDate, topN: 3 });
      setBacklogItems(data.items || []);
      setLog(`백로그 후보 로드 성공: ${data.items?.length ?? 0}건`);
    } catch (e: any) {
      setLog(String(e?.message || e));
    } finally {
      setBusy(false);
    }
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

  async function becomeOpsApprover() {
    setBusy(true);
    try {
      await apiPost("/v1/dev/set-claims", { claims: { role: "ops_approver" } });
      setLog("dev: set claims role=ops_approver (token refresh 필요)");
      await ensureLogin();
    } catch (e: any) {
      setLog(String(e?.message || e));
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
      setLog(String(e?.message || e));
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
      setLog(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function executeRefund(it: any) {
    setBusy(true);
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
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error?.messageKo || "요청 실패");
      setLog(`refund executed: ${t.refundId}`);
    } catch (e: any) {
      setLog(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function loadCaseDetail() {
    setBusy(true);
    try {
      if (!caseId) throw new Error("caseId가 필요합니다.");
      const c = await apiGet(`/v1/cases/${caseId}`);
      const t = await apiGet(`/v1/cases/${caseId}/timeline?limit=50`);
      const d = await apiGet(`/v1/cases/${caseId}/documents`);
      const q = await apiGet(`/v1/cases/${caseId}/quotes`);
      const p = await apiGet(`/v1/cases/${caseId}/payments`);
      const r = await apiGet(`/v1/cases/${caseId}/refunds`);
      setCaseDetail(c.case);
      setTimeline(t.items || []);
      setDocuments(d.items || []);
      setQuotes(q.items || []);
      setPayments(p.items || []);
      setRefunds(r.items || []);
      setLog("case detail loaded");
    } catch (e: any) {
      setLog(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function loadSettlements() {
    setBusy(true);
    try {
      const data = await apiGet("/v1/ops/settlements");
      setSettlements(data.items || []);
      setLog(`loaded settlements: ${data.items?.length ?? 0}`);
    } catch (e: any) {
      setLog(String(e?.message || e));
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
      setLog(String(e?.message || e));
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
      setLog(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function loadSettlementItems() {
    setBusy(true);
    try {
      if (!settlementIdForItems) throw new Error("settlementId가 필요합니다.");
      const data = await apiGet(`/v1/ops/settlements/${settlementIdForItems}/items`);
      setSettlementItems(data.items || []);
      setLog(`loaded settlement items: ${data.items?.length ?? 0}`);
    } catch (e: any) {
      setLog(String(e?.message || e));
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

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8, background: "#f9f9f9" }}>
        <h2 style={{ margin: "0 0 8px 0", color: "#333" }}>일일 Gate 집계</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            대상 일자:{" "}
            <input
              type="date"
              value={gateDate}
              onChange={(e) => setGateDate(e.target.value)}
              disabled={busy}
              style={{ padding: 6 }}
            />
          </label>
          <button disabled={busy || !gateDate} onClick={loadGateReport}>
            집계 가져오기
          </button>
        </div>
        {gateReportText && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button onClick={copyGateReport} style={{ background: "#4caf50", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}>
                복사 (운영 로그용)
              </button>
            </div>
            <pre style={{ margin: 0, padding: 12, background: "#fff", border: "1px solid #ddd", borderRadius: 4, whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
              {gateReportText}
            </pre>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8, background: "#f0f8ff" }}>
        <h2 style={{ margin: "0 0 8px 0", color: "#333" }}>자동 백로그 후보 생성</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            대상 일자:{" "}
            <input
              type="date"
              value={backlogDate}
              onChange={(e) => setBacklogDate(e.target.value)}
              disabled={busy}
              style={{ padding: 6 }}
            />
          </label>
          <button disabled={busy || !backlogDate} onClick={loadBacklog}>
            백로그 후보 생성
          </button>
          {backlogItems.length > 0 && (
            <button onClick={copyBacklog} style={{ background: "#2196f3", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}>
              복사 (스프린트 백로그용)
            </button>
          )}
        </div>
        
        {backlogItems.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, background: "#fff" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 8 }}>Sev</th>
                <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 8 }}>제목</th>
                <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 8 }}>영향도</th>
                <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 8 }}>샘플케이스</th>
              </tr>
            </thead>
            <tbody>
              {backlogItems.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <span style={{ 
                      background: item.severity === 1 ? "#ffebee" : item.severity === 2 ? "#fff3e0" : "#f5f5f5", 
                      color: item.severity === 1 ? "#d32f2f" : item.severity === 2 ? "#e64a19" : "#616161",
                      padding: "2px 6px", borderRadius: 4, fontWeight: "bold" 
                    }}>
                      Sev{item.severity}
                    </span>
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{item.title}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{item.impactCount}건</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, fontSize: "0.9em", color: "#666" }}>
                    {item.sampleCaseIds.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>케이스 조회</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            caseId{" "}
            <input value={caseId} onChange={(e) => setCaseId(e.target.value)} style={{ width: 360, padding: 6 }} />
          </label>
          <button disabled={busy} onClick={loadCaseDetail}>케이스 상세 로드</button>
        </div>
        {caseDetail && (
          <div style={{ marginTop: 12 }}>
            <div><strong>status</strong>: {caseDetail.status}</div>
            <div><strong>ownerUid</strong>: {caseDetail.ownerUid}</div>
            <div><strong>partnerId</strong>: {caseDetail.partnerId}</div>

            <h3 style={{ marginTop: 12 }}>문서</h3>
            <div style={{ color: "#666" }}>총 {documents.length}건</div>

            <h3 style={{ marginTop: 12 }}>견적</h3>
            <div style={{ color: "#666" }}>총 {quotes.length}건</div>

            <h3 style={{ marginTop: 12 }}>결제</h3>
            <div style={{ color: "#666" }}>총 {payments.length}건</div>

            <h3 style={{ marginTop: 12 }}>환불</h3>
            <div style={{ color: "#666" }}>총 {refunds.length}건</div>

            <h3 style={{ marginTop: 12 }}>타임라인(최근)</h3>
            <ul>
              {timeline.slice(0, 10).map((e) => (
                <li key={e.id}>{e.type} / {e.summaryKo}</li>
              ))}
            </ul>
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
