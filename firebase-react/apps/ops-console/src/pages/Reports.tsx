import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

// --- Types ---
interface GateSummary { gateKey: string; status: string; lastCheckedAt: string | null; }
interface GateHealth { gateKey: string; status: string; lastCheckedAt: string | null; checks: Record<string, { ok: boolean; message?: string; checkedAt?: string }>; }
interface AlertJob { id: string; gateKey: string; status: string; createdAt: string; }
interface DailyReport { date: string; gateKey: string; summary: string; metrics: Record<string, unknown>; }
interface SsotEntry { id?: string; timestamp?: string; content?: string; type?: string; }
interface MonthlyReport { month: string; gateKey: string; summary?: string; metrics?: Record<string, unknown>; }

function formatTimestamp(ts: unknown): string {
  if (!ts) return "-";
  if (typeof ts === "string") return new Date(ts).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (typeof ts === "object" && ts !== null && "_seconds" in ts) return new Date((ts as { _seconds: number })._seconds * 1000).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  return "-";
}
function statusBadge(status: string): string {
  const map: Record<string, string> = { healthy: "ops-badge-success", unhealthy: "ops-badge-danger", degraded: "ops-badge-warning", completed: "ops-badge-success", failed: "ops-badge-danger", pending: "ops-badge-warning", processing: "ops-badge-brand", dead: "ops-badge-danger" };
  return map[status] || "ops-badge-neutral";
}
function statusLabel(status: string): string {
  const map: Record<string, string> = { healthy: "정상", unhealthy: "비정상", degraded: "저하", completed: "완료", failed: "실패", pending: "대기", processing: "처리중", dead: "데드" };
  return map[status] || status;
}

// --- Tabs ---

function GateHealthTab({ token }: { token: string }) {
  const [gates, setGates] = useState<GateSummary[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [healthDetail, setHealthDetail] = useState<GateHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchGates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/health/summary`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.ok) setGates(json.data?.gates ?? []);
    } catch {} finally { setLoading(false); }
  }, [token]);
  useEffect(() => { fetchGates(); }, [fetchGates]);

  const fetchHealthDetail = useCallback(async (gateKey: string) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/health/${gateKey}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.ok) setHealthDetail(json.data?.health ?? null);
    } catch {}
  }, [token]);

  const handleRowClick = useCallback((gateKey: string) => {
    if (expandedKey === gateKey) { setExpandedKey(null); setHealthDetail(null); }
    else { setExpandedKey(gateKey); setHealthDetail(null); fetchHealthDetail(gateKey); }
  }, [expandedKey, fetchHealthDetail]);

  const forceAlert = useCallback(async (gateKey: string) => {
    setActionMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/gates/${gateKey}/alerts/force`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      const json = await res.json();
      setActionMsg({ ok: json.ok, text: json.ok ? `${gateKey} 강제 알림 발송 완료` : json.error?.message || "실패" });
    } catch (e) { setActionMsg({ ok: false, text: "요청 실패" }); }
  }, [token]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {actionMsg && <div style={{ padding: 12, background: actionMsg.ok ? "var(--ops-success-soft)" : "var(--ops-danger-soft)", color: actionMsg.ok ? "var(--ops-success)" : "var(--ops-danger)", borderRadius: "var(--ops-radius-sm)", fontSize: 13 }}>{actionMsg.ok ? "✅" : "❌"} {actionMsg.text}</div>}
      <div className="ops-panel">
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead><tr><th>Gate</th><th>상태</th><th>마지막 확인</th><th>작업</th></tr></thead>
            <tbody>
              {gates.length > 0 ? gates.map((g) => (
                <React.Fragment key={g.gateKey}>
                  <tr style={{ cursor: "pointer", background: expandedKey === g.gateKey ? "var(--ops-surface-active)" : undefined }} onClick={() => handleRowClick(g.gateKey)}>
                    <td className="ops-mono" style={{ fontWeight: 600 }}>{g.gateKey}</td>
                    <td><span className={`ops-badge ${statusBadge(g.status)}`}>{statusLabel(g.status)}</span></td>
                    <td className="ops-mono" style={{ fontSize: 11, color: "var(--ops-text-muted)" }}>{formatTimestamp(g.lastCheckedAt)}</td>
                    <td><button className="ops-btn" onClick={(e) => { e.stopPropagation(); forceAlert(g.gateKey); }}>강제 알림</button></td>
                  </tr>
                  {expandedKey === g.gateKey && (
                    <tr>
                      <td colSpan={4} style={{ padding: 0, borderBottom: "1px solid var(--ops-border)" }}>
                        <div style={{ padding: 16, background: "var(--ops-bg)", display: "flex", flexDirection: "column", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ops-text-muted)", textTransform: "uppercase" }}>헬스 체크 상세</span>
                          {healthDetail ? (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                              {Object.entries(healthDetail.checks || {}).map(([name, check]) => (
                                <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--ops-surface)", padding: 12, borderRadius: "var(--ops-radius-sm)", border: "1px solid var(--ops-border)" }}>
                                  <span className={`ops-badge ${check.ok ? "ops-badge-success" : "ops-badge-danger"}`}>{check.ok ? "OK" : "FAIL"}</span>
                                  <div style={{ display: "flex", flexDirection: "column" }}>
                                    <span className="ops-mono" style={{ fontSize: 12, fontWeight: 600 }}>{name}</span>
                                    {check.message && <span style={{ fontSize: 11, color: "var(--ops-text-muted)", marginTop: 2 }}>{check.message}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : <span style={{ fontSize: 13, color: "var(--ops-text-muted)" }}>불러오는 중...</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )) : <tr><td colSpan={4} style={{ textAlign: "center", padding: 32, color: "var(--ops-text-muted)" }}>{loading ? "불러오는 중..." : "데이터가 없습니다."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AlertJobsTab({ token }: { token: string }) {
  const [jobs, setJobs] = useState<AlertJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/alerts/jobs`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.ok) setJobs(json.data?.jobs ?? []);
    } catch {} finally { setLoading(false); }
  }, [token]);
  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const requeueJob = useCallback(async (jobId: string) => {
    setActionMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/alerts/jobs/${jobId}/requeue`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      const json = await res.json();
      if (json.ok) { setActionMsg({ ok: true, text: `Job ${jobId} 재큐 완료` }); fetchJobs(); }
      else setActionMsg({ ok: false, text: "실패" });
    } catch (e) { setActionMsg({ ok: false, text: "요청 실패" }); }
  }, [token, fetchJobs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {actionMsg && <div style={{ padding: 12, background: actionMsg.ok ? "var(--ops-success-soft)" : "var(--ops-danger-soft)", color: actionMsg.ok ? "var(--ops-success)" : "var(--ops-danger)", borderRadius: "var(--ops-radius-sm)", fontSize: 13 }}>{actionMsg.ok ? "✅" : "❌"} {actionMsg.text}</div>}
      <div className="ops-panel">
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead><tr><th>Job ID</th><th>Gate</th><th>상태</th><th>생성일</th><th>작업</th></tr></thead>
            <tbody>
              {jobs.length > 0 ? jobs.map((job) => (
                <tr key={job.id}>
                  <td className="ops-mono" style={{ fontSize: 11 }}>{job.id}</td>
                  <td className="ops-mono" style={{ fontWeight: 600 }}>{job.gateKey}</td>
                  <td><span className={`ops-badge ${statusBadge(job.status)}`}>{statusLabel(job.status)}</span></td>
                  <td className="ops-mono" style={{ fontSize: 11, color: "var(--ops-text-muted)" }}>{formatTimestamp(job.createdAt)}</td>
                  <td>{(job.status === "failed" || job.status === "dead") && <button className="ops-btn ops-btn-brand" onClick={() => requeueJob(job.id)}>재큐</button>}</td>
                </tr>
              )) : <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--ops-text-muted)" }}>{loading ? "불러오는 중..." : "알림 잡이 없습니다."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DailyReportTab({ token, gateKeys }: { token: string; gateKeys: string[] }) {
  const [selectedGate, setSelectedGate] = useState<string>(gateKeys[0] || "");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<DailyReport | null>(null);
  const [ssotEntries, setSsotEntries] = useState<SsotEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchReport = useCallback(async () => {
    if (!selectedGate || !date) return;
    setLoading(true); setActionMsg(null);
    try {
      const results = await Promise.allSettled([
        fetch(`${getApiBaseUrl()}/v1/ops/reports/${selectedGate}/daily?date=${date}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${getApiBaseUrl()}/v1/ops/reports/${selectedGate}/daily/ssot/recent`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      if (results[0].status === "fulfilled" && results[0].value.ok) setReport(results[0].value.data?.report ?? null);
      if (results[1].status === "fulfilled" && results[1].value.ok) setSsotEntries(results[1].value.data?.entries ?? []);
    } catch {} finally { setLoading(false); }
  }, [token, selectedGate, date]);
  useEffect(() => { if (selectedGate) fetchReport(); }, [fetchReport, selectedGate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", padding: 16, background: "var(--ops-surface)", borderRadius: "var(--ops-radius)", border: "1px solid var(--ops-border)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>게이트</label>
          <select className="ops-input" value={selectedGate} onChange={(e) => setSelectedGate(e.target.value)} style={{ width: 200 }}>
            {gateKeys.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>날짜</label>
          <input type="date" className="ops-input" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
        </div>
        <button className="ops-btn ops-btn-brand" onClick={fetchReport} disabled={loading}>{loading ? "조회 중" : "조회"}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="ops-panel">
          <div className="ops-panel-header"><h3 className="ops-panel-title">일일 리포트 — {selectedGate}</h3></div>
          <div className="ops-panel-body">
            {report ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ops-text)" }}>{report.summary}</div>
                {report.metrics && Object.keys(report.metrics).length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                    {Object.entries(report.metrics).map(([key, value]) => (
                      <div key={key} style={{ padding: 12, background: "var(--ops-bg)", border: "1px solid var(--ops-border)", borderRadius: "var(--ops-radius-sm)" }}>
                        <div style={{ fontSize: 11, color: "var(--ops-text-muted)", fontWeight: 600 }}>{key}</div>
                        <div className="ops-mono" style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{typeof value === "number" ? value.toLocaleString() : String(value)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : <div style={{ color: "var(--ops-text-muted)", textAlign: "center", padding: 32, fontSize: 13 }}>리포트가 없습니다.</div>}
          </div>
        </div>

        <div className="ops-panel">
          <div className="ops-panel-header"><h3 className="ops-panel-title">SSOT 최근 기록</h3></div>
          <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ssotEntries.length > 0 ? ssotEntries.map((entry, idx) => (
              <div key={idx} style={{ padding: 12, background: "var(--ops-surface-active)", borderRadius: "var(--ops-radius-sm)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="ops-badge ops-badge-brand" style={{ fontSize: 10 }}>{entry.type || "log"}</span>
                  <span className="ops-mono" style={{ fontSize: 11, color: "var(--ops-text-muted)" }}>{formatTimestamp(entry.timestamp)}</span>
                </div>
                <div className="ops-mono" style={{ fontSize: 12, color: "var(--ops-text)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{String(entry.content)}</div>
              </div>
            )) : <div style={{ color: "var(--ops-text-muted)", textAlign: "center", padding: 32, fontSize: 13 }}>SSOT 기록이 없습니다.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthlyReportTab({ token, gateKeys }: { token: string; gateKeys: string[] }) {
  const [selectedGate, setSelectedGate] = useState<string>(gateKeys[0] || "");
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [prStatus, setPrStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const generateReport = useCallback(async () => {
    if (!selectedGate) return;
    setLoading(true); setActionMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/reports/${selectedGate}/monthly/generate`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.ok) {
        setActionMsg({ ok: true, text: "리포트 생성 완료" });
        const rRes = await fetch(`${getApiBaseUrl()}/v1/ops/reports/${selectedGate}/monthly`, { headers: { Authorization: `Bearer ${token}` } });
        const rJson = await rRes.json();
        if (rJson.ok) setReport(rJson.data?.report ?? null);
      } else setActionMsg({ ok: false, text: "생성 실패" });
    } catch { setActionMsg({ ok: false, text: "요청 실패" }); } finally { setLoading(false); }
  }, [token, selectedGate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", padding: 16, background: "var(--ops-surface)", borderRadius: "var(--ops-radius)", border: "1px solid var(--ops-border)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>게이트</label>
          <select className="ops-input" value={selectedGate} onChange={(e) => setSelectedGate(e.target.value)} style={{ width: 200 }}>
            {gateKeys.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <button className="ops-btn ops-btn-brand" onClick={generateReport} disabled={loading || !selectedGate}>{loading ? "생성 중" : "리포트 생성"}</button>
      </div>

      {actionMsg && <div style={{ padding: 12, background: actionMsg.ok ? "var(--ops-success-soft)" : "var(--ops-danger-soft)", color: actionMsg.ok ? "var(--ops-success)" : "var(--ops-danger)", borderRadius: "var(--ops-radius-sm)", fontSize: 13 }}>{actionMsg.ok ? "✅" : "❌"} {actionMsg.text}</div>}

      <div className="ops-panel">
        <div className="ops-panel-header"><h3 className="ops-panel-title">월간 리포트 — {selectedGate}</h3></div>
        <div className="ops-panel-body">
          {report ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ops-text)" }}>{report.summary}</div>
              {report.metrics && Object.keys(report.metrics).length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 8 }}>
                  {Object.entries(report.metrics).map(([key, value]) => (
                    <div key={key} style={{ padding: 12, background: "var(--ops-bg)", border: "1px solid var(--ops-border)", borderRadius: "var(--ops-radius-sm)" }}>
                      <div style={{ fontSize: 11, color: "var(--ops-text-muted)", fontWeight: 600 }}>{key}</div>
                      <div className="ops-mono" style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{typeof value === "number" ? value.toLocaleString() : String(value)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : <div style={{ color: "var(--ops-text-muted)", textAlign: "center", padding: 32, fontSize: 13 }}>"리포트 생성" 버튼을 눌러 월간 리포트를 생성하세요.</div>}
        </div>
      </div>
    </div>
  );
}

// --- Main ---

export default function Reports() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [gateKeys, setGateKeys] = useState<string[]>([]);

  useEffect(() => {
    async function loadGates() {
      try {
        const res = await fetch(`${getApiBaseUrl()}/v1/ops/health/summary`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (json.ok) setGateKeys((json.data?.gates ?? []).map((g: GateSummary) => g.gateKey));
      } catch {}
    }
    loadGates();
  }, [token]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 className="ops-title">리포트 & 알림</h1>
        <p className="ops-subtitle">게이트 헬스, 알림 잡 및 시스템 리포트를 조회합니다.</p>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--ops-border)", gap: 24 }}>
        {["게이트 헬스", "알림 잡", "일일 리포트", "월간 리포트"].map((label, i) => (
          <button
            key={label}
            onClick={() => setActiveTab(i)}
            style={{ padding: "12px 0", fontSize: 14, fontWeight: activeTab === i ? 700 : 500, color: activeTab === i ? "var(--ops-brand)" : "var(--ops-text-muted)", background: "transparent", border: "none", borderBottom: activeTab === i ? "2px solid var(--ops-brand)" : "2px solid transparent", cursor: "pointer", transition: "all 0.2s ease" }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 0 && <GateHealthTab token={token} />}
      {activeTab === 1 && <AlertJobsTab token={token} />}
      {activeTab === 2 && <DailyReportTab token={token} gateKeys={gateKeys} />}
      {activeTab === 3 && <MonthlyReportTab token={token} gateKeys={gateKeys} />}
    </div>
  );
}
