import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

// --- Types ---

interface GateSummary {
  gateKey: string;
  status: string;
  lastCheckedAt: string | { _seconds: number; _nanoseconds: number } | null;
}

interface GateHealth {
  gateKey: string;
  status: string;
  lastCheckedAt: string | { _seconds: number; _nanoseconds: number } | null;
  checks: Record<string, { ok: boolean; message?: string; checkedAt?: string | { _seconds: number; _nanoseconds: number } }>;
}

interface AlertJob {
  id: string;
  gateKey: string;
  status: string;
  createdAt: string | { _seconds: number; _nanoseconds: number };
  [key: string]: unknown;
}

interface DailyReport {
  date: string;
  gateKey: string;
  summary: string;
  metrics: Record<string, unknown>;
}

interface SsotEntry {
  id?: string;
  timestamp?: string | { _seconds: number; _nanoseconds: number };
  content?: string;
  type?: string;
  [key: string]: unknown;
}

interface MonthlyReport {
  month: string;
  gateKey: string;
  summary?: string;
  metrics?: Record<string, unknown>;
  [key: string]: unknown;
}

// --- Helpers ---

function formatTimestamp(ts: unknown): string {
  if (!ts) return "-";
  if (typeof ts === "string") return new Date(ts).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (typeof ts === "object" && ts !== null && "_seconds" in ts) return new Date((ts as { _seconds: number })._seconds * 1000).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  return "-";
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    healthy: "ar-badge-success",
    unhealthy: "ar-badge-danger",
    degraded: "ar-badge-warning",
    completed: "ar-badge-success",
    failed: "ar-badge-danger",
    pending: "ar-badge-warning",
    processing: "ar-badge-info",
    dead: "ar-badge-danger",
  };
  return map[status] || "ar-badge-neutral";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    healthy: "정상",
    unhealthy: "비정상",
    degraded: "저하",
    completed: "완료",
    failed: "실패",
    pending: "대기",
    processing: "처리중",
    dead: "데드",
  };
  return map[status] || status;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// --- Tab Styling ---

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: active ? 700 : 500,
  color: active ? "var(--ar-ink)" : "var(--ar-slate)",
  background: active ? "var(--ar-canvas)" : "transparent",
  cursor: "pointer",
  transition: "all 0.12s ease",
  borderBottom: active ? "2px solid var(--ar-accent)" : "2px solid transparent",
});

const TABS = ["게이트 헬스", "알림 잡", "일일 리포트", "월간 리포트"] as const;

// --- Tab 1: Gate Health ---

function GateHealthTab({ token }: { token: string }) {
  const [gates, setGates] = useState<GateSummary[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [healthDetail, setHealthDetail] = useState<GateHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchGates = useCallback(async () => {
    try {
      setLoading(true);
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/health/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) {
        setGates(json.data?.gates ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchGates();
  }, [fetchGates]);

  const fetchHealthDetail = useCallback(async (gateKey: string) => {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/health/${gateKey}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) {
        setHealthDetail(json.data?.health ?? null);
      }
    } catch {
      // silent
    }
  }, [token]);

  const handleRowClick = useCallback((gateKey: string) => {
    if (expandedKey === gateKey) {
      setExpandedKey(null);
      setHealthDetail(null);
    } else {
      setExpandedKey(gateKey);
      setHealthDetail(null);
      fetchHealthDetail(gateKey);
    }
  }, [expandedKey, fetchHealthDetail]);

  const forceAlert = useCallback(async (gateKey: string) => {
    setActionMsg(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/gates/${gateKey}/alerts/force`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.ok) {
        setActionMsg({ ok: true, text: `${gateKey} 강제 알림 발송 완료` });
      } else {
        setActionMsg({ ok: false, text: json.error?.message || "실패" });
      }
    } catch (e) {
      setActionMsg({ ok: false, text: e instanceof Error ? e.message : "요청 실패" });
    }
  }, [token]);

  return (
    <div>
      {actionMsg && (
        <div style={{
          marginBottom: 12,
          padding: "10px 14px",
          borderRadius: "var(--ar-r1)",
          background: actionMsg.ok ? "var(--ar-success-soft)" : "var(--ar-danger-soft)",
          color: actionMsg.ok ? "var(--ar-success)" : "var(--ar-danger)",
          fontSize: 13,
          fontWeight: 600,
        }}>
          {actionMsg.ok ? "✅" : "❌"} {actionMsg.text}
        </div>
      )}
      <div className="ar-card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="ar-table">
          <thead>
            <tr>
              <th>Gate</th>
              <th>상태</th>
              <th>마지막 확인</th>
              <th>강제 알림</th>
            </tr>
          </thead>
          <tbody>
            {gates.length > 0 ? gates.map((g) => (
              <React.Fragment key={g.gateKey}>
                <tr
                  style={{ cursor: "pointer" }}
                  onClick={() => handleRowClick(g.gateKey)}
                >
                  <td className="ar-mono" style={{ fontSize: 12, fontWeight: 600 }}>{g.gateKey}</td>
                  <td><span className={`ar-badge ${statusBadge(g.status)}`}>{statusLabel(g.status)}</span></td>
                  <td className="ar-tabular" style={{ fontSize: 12, color: "var(--ar-slate)" }}>{formatTimestamp(g.lastCheckedAt)}</td>
                  <td>
                    <button
                      className="ar-btn ar-btn-sm ar-btn-ghost"
                      onClick={(e) => { e.stopPropagation(); forceAlert(g.gateKey); }}
                    >
                      강제 알림
                    </button>
                  </td>
                </tr>
                {expandedKey === g.gateKey && (
                  <tr>
                    <td colSpan={4} style={{ padding: "16px 20px", background: "var(--ar-paper)" }}>
                      {healthDetail ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <span className="ar-eyebrow">헬스 체크 상세</span>
                          {Object.entries(healthDetail.checks || {}).map(([name, check]) => (
                            <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                              <span className={`ar-badge ${check.ok ? "ar-badge-success" : "ar-badge-danger"}`}>
                                {check.ok ? "OK" : "FAIL"}
                              </span>
                              <span className="ar-mono" style={{ fontSize: 12 }}>{name}</span>
                              {check.message && <span style={{ color: "var(--ar-slate)", fontSize: 12 }}>{check.message}</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--ar-slate)" }}>불러오는 중...</span>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )) : (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: 32, color: "var(--ar-slate)" }}>
                  {loading ? "불러오는 중..." : "게이트가 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Tab 2: Alert Jobs ---

function AlertJobsTab({ token }: { token: string }) {
  const [jobs, setJobs] = useState<AlertJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/alerts/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) {
        setJobs(json.data?.jobs ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const requeueJob = useCallback(async (jobId: string) => {
    setActionMsg(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/alerts/jobs/${jobId}/requeue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.ok) {
        setActionMsg({ ok: true, text: `Job ${jobId} 재큐 완료` });
        fetchJobs();
      } else {
        setActionMsg({ ok: false, text: json.error?.message || "실패" });
      }
    } catch (e) {
      setActionMsg({ ok: false, text: e instanceof Error ? e.message : "요청 실패" });
    }
  }, [token, fetchJobs]);

  return (
    <div>
      {actionMsg && (
        <div style={{
          marginBottom: 12,
          padding: "10px 14px",
          borderRadius: "var(--ar-r1)",
          background: actionMsg.ok ? "var(--ar-success-soft)" : "var(--ar-danger-soft)",
          color: actionMsg.ok ? "var(--ar-success)" : "var(--ar-danger)",
          fontSize: 13,
          fontWeight: 600,
        }}>
          {actionMsg.ok ? "✅" : "❌"} {actionMsg.text}
        </div>
      )}
      <div className="ar-card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="ar-table">
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Gate</th>
              <th>상태</th>
              <th>생성일</th>
              <th>재큐</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length > 0 ? jobs.map((job) => (
              <tr key={job.id}>
                <td className="ar-mono" style={{ fontSize: 12 }}>{job.id}</td>
                <td className="ar-mono" style={{ fontSize: 12 }}>{job.gateKey}</td>
                <td><span className={`ar-badge ${statusBadge(job.status)}`}>{statusLabel(job.status)}</span></td>
                <td className="ar-tabular" style={{ fontSize: 12, color: "var(--ar-slate)" }}>{formatTimestamp(job.createdAt)}</td>
                <td>
                  {(job.status === "failed" || job.status === "dead") && (
                    <button
                      className="ar-btn ar-btn-sm ar-btn-ghost"
                      onClick={() => requeueJob(job.id)}
                    >
                      재큐
                    </button>
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--ar-slate)" }}>
                  {loading ? "불러오는 중..." : "알림 잡이 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Tab 3: Daily Report ---

function DailyReportTab({ token, gateKeys }: { token: string; gateKeys: string[] }) {
  const [selectedGate, setSelectedGate] = useState<string>(gateKeys[0] || "");
  const [date, setDate] = useState<string>(todayString());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [ssotEntries, setSsotEntries] = useState<SsotEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchReport = useCallback(async () => {
    if (!selectedGate || !date) return;
    try {
      setLoading(true);
      setActionMsg(null);
      const baseUrl = getApiBaseUrl();
      const results = await Promise.allSettled([
        fetch(`${baseUrl}/v1/ops/reports/${selectedGate}/daily?date=${date}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        fetch(`${baseUrl}/v1/ops/reports/${selectedGate}/daily/ssot/recent`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      ]);
      if (results[0].status === "fulfilled") {
        setReport(results[0].value.data?.report ?? null);
      }
      if (results[1].status === "fulfilled") {
        setSsotEntries(results[1].value.data?.entries ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token, selectedGate, date]);

  useEffect(() => {
    if (selectedGate) fetchReport();
  }, [fetchReport, selectedGate]);

  const forceAlert = useCallback(async () => {
    if (!selectedGate) return;
    setActionMsg(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/gates/${selectedGate}/alerts/force`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.ok) {
        setActionMsg({ ok: true, text: `${selectedGate} 강제 알림 발송 완료` });
      } else {
        setActionMsg({ ok: false, text: json.error?.message || "실패" });
      }
    } catch (e) {
      setActionMsg({ ok: false, text: e instanceof Error ? e.message : "요청 실패" });
    }
  }, [token, selectedGate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="ar-label">게이트</span>
          <select
            className="ar-input ar-input-sm"
            value={selectedGate}
            onChange={(e) => setSelectedGate(e.target.value)}
            style={{ width: 200 }}
          >
            {gateKeys.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="ar-label">날짜</span>
          <input
            type="date"
            className="ar-input ar-input-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: 180 }}
          />
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button className="ar-btn ar-btn-sm ar-btn-ghost" onClick={fetchReport} disabled={loading}>
            {loading ? "불러오는 중..." : "조회"}
          </button>
        </div>
      </div>

      {actionMsg && (
        <div style={{
          padding: "10px 14px",
          borderRadius: "var(--ar-r1)",
          background: actionMsg.ok ? "var(--ar-success-soft)" : "var(--ar-danger-soft)",
          color: actionMsg.ok ? "var(--ar-success)" : "var(--ar-danger)",
          fontSize: 13,
          fontWeight: 600,
        }}>
          {actionMsg.ok ? "✅" : "❌"} {actionMsg.text}
        </div>
      )}

      {/* Report */}
      <div className="ar-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>일일 리포트 — {selectedGate}</h3>
          <button className="ar-btn ar-btn-sm ar-btn-soft" onClick={forceAlert}>강제 알림</button>
        </div>
        {report ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: "var(--ar-slate)" }}>
              <span className="ar-eyebrow">날짜</span>{" "}
              <span className="ar-tabular">{report.date}</span>
            </div>
            {report.summary && (
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>{report.summary}</div>
            )}
            {report.metrics && Object.keys(report.metrics).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="ar-eyebrow">메트릭</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                  {Object.entries(report.metrics).map(([key, value]) => (
                    <div key={key} style={{ padding: "10px 14px", background: "var(--ar-paper)", borderRadius: "var(--ar-r1)" }}>
                      <div style={{ fontSize: 11, color: "var(--ar-slate)", fontWeight: 600 }}>{key}</div>
                      <div className="ar-tabular" style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>
                        {typeof value === "number" ? value.toLocaleString("ko-KR") : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "var(--ar-slate)", textAlign: "center", padding: 24 }}>
            {loading ? "불러오는 중..." : "리포트가 없습니다."}
          </div>
        )}
      </div>

      {/* SSOT */}
      <div className="ar-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>SSOT 최근 기록</h3>
        {ssotEntries.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ssotEntries.map((entry, idx) => (
              <div key={entry.id || idx} style={{ padding: "10px 14px", background: "var(--ar-paper)", borderRadius: "var(--ar-r1)", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="ar-mono" style={{ fontSize: 12, fontWeight: 600 }}>{entry.type || "log"}</span>
                  <span className="ar-tabular" style={{ fontSize: 11, color: "var(--ar-slate)" }}>{formatTimestamp(entry.timestamp)}</span>
                </div>
                {entry.content && <div style={{ marginTop: 4, color: "var(--ar-graphite)", lineHeight: 1.6 }}>{String(entry.content)}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "var(--ar-slate)", textAlign: "center", padding: 24 }}>
            {loading ? "불러오는 중..." : "SSOT 기록이 없습니다."}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Tab 4: Monthly Report ---

function MonthlyReportTab({ token, gateKeys }: { token: string; gateKeys: string[] }) {
  const [selectedGate, setSelectedGate] = useState<string>(gateKeys[0] || "");
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [prStatus, setPrStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const generateReport = useCallback(async () => {
    if (!selectedGate) return;
    setActionMsg(null);
    setLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/reports/${selectedGate}/monthly/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.ok) {
        setActionMsg({ ok: true, text: `${selectedGate} 월간 리포트 생성 완료` });
        // Fetch the generated report
        const reportRes = await fetch(`${baseUrl}/v1/ops/reports/${selectedGate}/monthly`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const reportJson = await reportRes.json();
        if (reportJson.ok) {
          setReport(reportJson.data?.report ?? null);
        }
      } else {
        setActionMsg({ ok: false, text: json.error?.message || "생성 실패" });
      }
    } catch (e) {
      setActionMsg({ ok: false, text: e instanceof Error ? e.message : "요청 실패" });
    } finally {
      setLoading(false);
    }
  }, [token, selectedGate]);

  const fetchPrStatus = useCallback(async () => {
    if (!selectedGate) return;
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/reports/${selectedGate}/monthly/pr`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) {
        setPrStatus(json.data ?? null);
      } else {
        setActionMsg({ ok: false, text: json.error?.message || "PR 조회 실패" });
      }
    } catch (e) {
      setActionMsg({ ok: false, text: e instanceof Error ? e.message : "요청 실패" });
    }
  }, [token, selectedGate]);

  const dispatchWorkflow = useCallback(async () => {
    if (!selectedGate) return;
    setActionMsg(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/reports/${selectedGate}/monthly/workflow-run/dispatch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.ok) {
        setActionMsg({ ok: true, text: "워크플로우 실행 완료" });
      } else {
        setActionMsg({ ok: false, text: json.error?.message || "워크플로우 실행 실패" });
      }
    } catch (e) {
      setActionMsg({ ok: false, text: e instanceof Error ? e.message : "요청 실패" });
    }
  }, [token, selectedGate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="ar-label">게이트</span>
          <select
            className="ar-input ar-input-sm"
            value={selectedGate}
            onChange={(e) => setSelectedGate(e.target.value)}
            style={{ width: 200 }}
          >
            {gateKeys.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <button className="ar-btn ar-btn-sm ar-btn-accent" onClick={generateReport} disabled={loading || !selectedGate}>
            {loading ? "생성 중..." : "리포트 생성"}
          </button>
          <button className="ar-btn ar-btn-sm ar-btn-ghost" onClick={fetchPrStatus} disabled={!selectedGate}>
            PR 상태
          </button>
          <button className="ar-btn ar-btn-sm ar-btn-soft" onClick={dispatchWorkflow} disabled={!selectedGate}>
            워크플로우 실행
          </button>
        </div>
      </div>

      {actionMsg && (
        <div style={{
          padding: "10px 14px",
          borderRadius: "var(--ar-r1)",
          background: actionMsg.ok ? "var(--ar-success-soft)" : "var(--ar-danger-soft)",
          color: actionMsg.ok ? "var(--ar-success)" : "var(--ar-danger)",
          fontSize: 13,
          fontWeight: 600,
        }}>
          {actionMsg.ok ? "✅" : "❌"} {actionMsg.text}
        </div>
      )}

      {/* Report */}
      <div className="ar-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>월간 리포트 — {selectedGate}</h3>
        {report ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {report.month && (
              <div style={{ fontSize: 13, color: "var(--ar-slate)" }}>
                <span className="ar-eyebrow">월</span>{" "}
                <span className="ar-tabular">{report.month}</span>
              </div>
            )}
            {report.summary && (
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>{report.summary}</div>
            )}
            {report.metrics && Object.keys(report.metrics).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="ar-eyebrow">메트릭</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                  {Object.entries(report.metrics).map(([key, value]) => (
                    <div key={key} style={{ padding: "10px 14px", background: "var(--ar-paper)", borderRadius: "var(--ar-r1)" }}>
                      <div style={{ fontSize: 11, color: "var(--ar-slate)", fontWeight: 600 }}>{key}</div>
                      <div className="ar-tabular" style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>
                        {typeof value === "number" ? value.toLocaleString("ko-KR") : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "var(--ar-slate)", textAlign: "center", padding: 24 }}>
            {loading ? "불러오는 중..." : '"리포트 생성" 버튼을 눌러 월간 리포트를 생성하세요.'}
          </div>
        )}
      </div>

      {/* PR Status */}
      {prStatus && (
        <div className="ar-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>PR 상태</h3>
          <pre className="ar-mono" style={{ fontSize: 12, padding: 14, background: "var(--ar-paper)", borderRadius: "var(--ar-r1)", overflow: "auto", maxHeight: 300 }}>
            {JSON.stringify(prStatus, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

import React from "react";

export default function Reports() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [gateKeys, setGateKeys] = useState<string[]>([]);

  // Fetch gate keys for selectors
  useEffect(() => {
    async function loadGates() {
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/v1/ops/health/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.ok) {
          const gates: GateSummary[] = json.data?.gates ?? [];
          setGateKeys(gates.map((g) => g.gateKey));
        }
      } catch {
        // silent
      }
    }
    loadGates();
  }, [token]);

  const renderTab = () => {
    switch (activeTab) {
      case 0: return <GateHealthTab token={token} />;
      case 1: return <AlertJobsTab token={token} />;
      case 2: return <DailyReportTab token={token} gateKeys={gateKeys} />;
      case 3: return <MonthlyReportTab token={token} gateKeys={gateKeys} />;
      default: return null;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>리포트 & 알림</h1>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--ar-hairline)",
        gap: 0,
      }}>
        {TABS.map((label, idx) => (
          <button
            key={label}
            style={tabStyle(idx === activeTab)}
            onClick={() => setActiveTab(idx)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {renderTab()}
    </div>
  );
}
