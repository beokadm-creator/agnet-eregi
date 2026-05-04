import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

// --- Types ---
interface Incident {
  id: string;
  gateKey: string;
  summary: string;
  severity: string;
  status: string;
  startAt: string | { _seconds: number; _nanoseconds: number };
  endAt?: string | { _seconds: number; _nanoseconds: number };
  counters?: Record<string, number>;
  triage?: Record<string, unknown>;
  aiTriage?: any;
}
interface PlaybookAction {
  key: string;
  label: string;
  description: string;
  roleRequired: string;
}
interface RiskMetrics {
  criticalIncidents24h: number;
  warnIncidents24h: number;
  totalIncidents24h: number;
}
interface RiskSummary {
  riskLevel: "Low" | "Medium" | "High";
  metrics: RiskMetrics;
  evaluatedAt: string;
}

// --- Helpers ---
function formatTimestamp(ts: unknown): string {
  if (!ts) return "-";
  if (typeof ts === "string") return new Date(ts).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (typeof ts === "object" && ts !== null && "_seconds" in ts) return new Date((ts as { _seconds: number })._seconds * 1000).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  return "-";
}
function severityBadge(sev: string): string {
  if (sev === "critical") return "ops-badge-danger";
  if (sev === "warn") return "ops-badge-warning";
  return "ops-badge-brand";
}
function statusBadge(status: string): string {
  if (status === "ACTIVE") return "ops-badge-danger";
  if (status === "INVESTIGATING") return "ops-badge-warning";
  if (status === "RESOLVED") return "ops-badge-success";
  return "ops-badge-neutral";
}

export default function Incidents() {
  const { token } = useAuth();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [gateFilter, setGateFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState("전체");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Incident | null>(null);
  const [playbookActions, setPlaybookActions] = useState<PlaybookAction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [actionRunning, setActionRunning] = useState(false);
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiResult, setAiResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [mitigateGateKey, setMitigateGateKey] = useState("");
  const [mitigateRunning, setMitigateRunning] = useState(false);
  const [mitigateResult, setMitigateResult] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const baseUrl = getApiBaseUrl();
      const results = await Promise.allSettled([
        fetch(`${baseUrl}/v1/ops/incidents?limit=50`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
        fetch(`${baseUrl}/v1/ops/risk/summary`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
      ]);
      setIncidents(results[0].status === "fulfilled" ? results[0].value.data?.items ?? [] : []);
      setRiskSummary(results[1].status === "fulfilled" ? results[1].value.data?.summary ?? null : null);
    } catch (e) { setError(e instanceof Error ? e.message : "데이터 로드 실패"); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const selectIncident = useCallback(async (id: string) => {
    setSelectedId(id); setDetail(null); setPlaybookActions([]); setActionResult(null); setDetailLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const results = await Promise.allSettled([
        fetch(`${baseUrl}/v1/ops/incidents/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
        fetch(`${baseUrl}/v1/ops/incidents/${id}/playbook`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
      ]);
      setDetail(results[0].status === "fulfilled" ? results[0].value.data?.incident ?? null : null);
      setPlaybookActions(results[1].status === "fulfilled" ? results[1].value.data?.playbook?.actions ?? [] : []);
    } finally { setDetailLoading(false); }
  }, [token]);

  const runAction = useCallback(async (actionKey: string) => {
    if (!selectedId) return;
    setActionRunning(true); setActionResult(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/incidents/${selectedId}/playbook/run`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ actionKey }) });
      const json = await res.json();
      if (json.ok) { setActionResult({ ok: true, message: json.data ? JSON.stringify(json.data) : "완료" }); fetchAll(); }
      else setActionResult({ ok: false, message: json.error?.messageKo || json.error?.message || "실패" });
    } catch (e) { setActionResult({ ok: false, message: "요청 실패" }); } finally { setActionRunning(false); }
  }, [token, selectedId, fetchAll]);

  const runAiTriage = useCallback(async () => {
    if (!selectedId) return;
    setAiRunning(true); setAiResult(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/incidents/${selectedId}/ai/triage`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.ok) {
        setAiResult({ ok: true, message: "AI triage 생성 완료" });
        await selectIncident(selectedId);
      } else {
        setAiResult({ ok: false, message: json.error?.messageKo || json.error?.message || "실패" });
      }
    } catch {
      setAiResult({ ok: false, message: "요청 실패" });
    } finally {
      setAiRunning(false);
    }
  }, [token, selectedId, selectIncident]);

  const mitigateRisk = useCallback(async (gateKey: string) => {
    setMitigateRunning(true); setMitigateResult(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/risk/${encodeURIComponent(gateKey)}/mitigate`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const json = await res.json();
      if (json.ok) { setMitigateResult({ ok: true, message: json.data ? JSON.stringify(json.data) : "완화 성공" }); fetchAll(); }
      else setMitigateResult({ ok: false, message: json.error?.messageKo || json.error?.message || "실패" });
    } catch (e) { setMitigateResult({ ok: false, message: "요청 실패" }); } finally { setMitigateRunning(false); }
  }, [token, fetchAll]);

  const rebuildIncidents = useCallback(async () => {
    setActionRunning(true); setActionResult(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/incidents/rebuild`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.ok) { setActionResult({ ok: true, message: "재빌드 완료" }); fetchAll(); }
      else setActionResult({ ok: false, message: "실패" });
    } catch (e) { setActionResult({ ok: false, message: "요청 실패" }); } finally { setActionRunning(false); }
  }, [token, fetchAll]);

  const gateKeys = Array.from(new Set(incidents.map((i) => i.gateKey))).sort();
  const filtered = incidents.filter((i) => {
    if (gateFilter !== "전체" && i.gateKey !== gateFilter) return false;
    if (statusFilter !== "전체") {
      const mapped = statusFilter.split("(")[0];
      const actualMapped = mapped === "활성" ? "ACTIVE" : mapped === "조사중" ? "INVESTIGATING" : mapped === "완화중" ? "MITIGATING" : mapped === "종료" ? "CLOSED" : mapped === "해결" ? "RESOLVED" : statusFilter;
      if (i.status !== actualMapped) return false;
    }
    return true;
  });

  const openCBs = incidents.filter((i) => i.summary?.toLowerCase().includes("circuit_breaker") && i.status !== "CLOSED");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="ops-title">인시던트 관리</h1>
          <p className="ops-subtitle">장애 감지, 플레이북 실행, 서킷 브레이커 상태를 모니터링합니다.</p>
        </div>
        <button className="ops-btn" onClick={fetchAll} disabled={loading}>{loading ? "갱신 중..." : "↻ 새로고침"}</button>
      </div>

      {error && <div style={{ padding: "12px 16px", background: "var(--ops-danger-soft)", color: "var(--ops-danger)", borderRadius: "var(--ops-radius)", fontSize: 13 }}>{error}</div>}

      <div style={{ display: "flex", gap: 12, alignItems: "center", background: "var(--ops-surface)", padding: "12px 16px", borderRadius: "var(--ops-radius)", border: "1px solid var(--ops-border)" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ops-text-muted)" }}>필터:</span>
        <select className="ops-input" style={{ width: "auto", minWidth: 120 }} value={gateFilter} onChange={(e) => setGateFilter(e.target.value)}>
          <option value="전체">전체 Gate</option>
          {gateKeys.map((gk) => <option key={gk} value={gk}>{gk}</option>)}
        </select>
        <select className="ops-input" style={{ width: "auto", minWidth: 120 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="전체">상태 전체</option>
          <option value="활성(ACTIVE)">활성(ACTIVE)</option>
          <option value="조사중(INVESTIGATING)">조사중(INVESTIGATING)</option>
          <option value="종료(CLOSED)">종료(CLOSED)</option>
          <option value="해결(RESOLVED)">해결(RESOLVED)</option>
        </select>
        <button className="ops-btn" disabled={actionRunning} onClick={rebuildIncidents}>인시던트 재빌드</button>
        <div style={{ width: 1, height: 24, background: "var(--ops-border)", margin: "0 8px" }} />
        <input className="ops-input" style={{ width: 180 }} placeholder="리스크 완화 Gate Key" value={mitigateGateKey} onChange={(e) => setMitigateGateKey(e.target.value)} />
        <button className="ops-btn ops-btn-brand" disabled={mitigateRunning || !mitigateGateKey.trim()} onClick={() => mitigateRisk(mitigateGateKey.trim())}>🛡️ 리스크 완화</button>
      </div>

      {mitigateResult && (
        <div style={{ padding: "10px 14px", borderRadius: "var(--ops-radius)", background: mitigateResult.ok ? "var(--ops-success-soft)" : "var(--ops-danger-soft)", color: mitigateResult.ok ? "var(--ops-success)" : "var(--ops-danger)", fontSize: 13, fontWeight: 600 }}>
          {mitigateResult.ok ? "✅" : "❌"} 리스크 완화: {mitigateResult.message}
        </div>
      )}

      <div className="ops-grid">
        <div className="ops-metric">
          <div className="ops-metric-label">전체 인시던트</div>
          <div className="ops-metric-value">{loading ? "-" : incidents.length}</div>
        </div>
        <div className="ops-metric">
          <div className="ops-metric-label">활성 (미종료)</div>
          <div className="ops-metric-value" style={{ color: incidents.filter((i) => i.status !== "CLOSED" && i.status !== "RESOLVED").length > 0 ? "var(--ops-danger)" : "var(--ops-text)" }}>
            {loading ? "-" : incidents.filter((i) => i.status !== "CLOSED" && i.status !== "RESOLVED").length}
          </div>
        </div>
        <div className="ops-metric">
          <div className="ops-metric-label">리스크 수준</div>
          <div style={{ marginTop: 12 }}>
            {riskSummary ? (
              <span className={`ops-badge ${riskSummary.riskLevel === 'Low' ? 'ops-badge-success' : riskSummary.riskLevel === 'Medium' ? 'ops-badge-warning' : 'ops-badge-danger'}`} style={{ fontSize: 14, padding: "4px 10px" }}>
                {riskSummary.riskLevel}
              </span>
            ) : <span style={{ fontSize: 14, color: "var(--ops-text-muted)" }}>-</span>}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <div className="ops-panel">
          <div className="ops-panel-header">
            <h3 className="ops-panel-title">인시던트 목록</h3>
            <span className="ops-badge ops-badge-brand">{filtered.length}</span>
          </div>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Gate</th>
                  <th>내용</th>
                  <th>심각도</th>
                  <th>상태</th>
                  <th>발생시간</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((inc) => (
                    <tr key={inc.id} onClick={() => selectIncident(inc.id)} style={{ cursor: "pointer", background: selectedId === inc.id ? "var(--ops-surface-active)" : undefined }}>
                      <td className="ops-mono" style={{ fontSize: 11 }}>{inc.gateKey}</td>
                      <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inc.summary || inc.id}</td>
                      <td><span className={`ops-badge ${severityBadge(inc.severity)}`}>{inc.severity}</span></td>
                      <td><span className={`ops-badge ${statusBadge(inc.status)}`}>{inc.status}</span></td>
                      <td className="ops-mono" style={{ fontSize: 11, color: "var(--ops-text-muted)" }}>{formatTimestamp(inc.startAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--ops-text-muted)" }}>{loading ? "불러오는 중..." : "인시던트가 없습니다."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="ops-panel" style={{ flex: 1 }}>
            <div className="ops-panel-header"><h3 className="ops-panel-title">상세 정보</h3></div>
            <div className="ops-panel-body">
              {!selectedId ? (
                <div style={{ color: "var(--ops-text-muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>인시던트를 선택하세요.</div>
              ) : detailLoading ? (
                <div style={{ color: "var(--ops-text-muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>불러오는 중...</div>
              ) : detail ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ops-text-muted)" }}>Gate</span><span className="ops-mono" style={{ color: "var(--ops-text)" }}>{detail.gateKey}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ops-text-muted)" }}>심각도</span><span className={`ops-badge ${severityBadge(detail.severity)}`}>{detail.severity}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ops-text-muted)" }}>상태</span><span className={`ops-badge ${statusBadge(detail.status)}`}>{detail.status}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ops-text-muted)" }}>발생시간</span><span className="ops-mono" style={{ color: "var(--ops-text)" }}>{formatTimestamp(detail.startAt)}</span></div>
                  {detail.summary && <div style={{ marginTop: 8, padding: 12, background: "var(--ops-surface-active)", borderRadius: "var(--ops-radius-sm)", fontSize: 12, color: "var(--ops-text)" }}>{detail.summary}</div>}

                  <div style={{ marginTop: 6, paddingTop: 10, borderTop: "1px solid var(--ops-border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>AI Triage</span>
                      <button className="ops-btn ops-btn-brand" disabled={aiRunning} onClick={runAiTriage}>{aiRunning ? "생성 중..." : "생성/갱신"}</button>
                    </div>
                    {aiResult && (
                      <div style={{ padding: "8px 10px", borderRadius: "var(--ops-radius-sm)", background: aiResult.ok ? "var(--ops-success-soft)" : "var(--ops-danger-soft)", color: aiResult.ok ? "var(--ops-success)" : "var(--ops-danger)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                        {aiResult.message}
                      </div>
                    )}
                    {detail.aiTriage ? (
                      <div style={{ display: "grid", gap: 10, fontSize: 12 }}>
                        {detail.aiTriage.summaryKo && <div style={{ padding: 10, background: "var(--ops-surface-active)", borderRadius: "var(--ops-radius-sm)" }}>{detail.aiTriage.summaryKo}</div>}
                        {Array.isArray(detail.aiTriage.probableCausesKo) && detail.aiTriage.probableCausesKo.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ops-text-muted)", marginBottom: 6 }}>원인 가설</div>
                            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                              {detail.aiTriage.probableCausesKo.map((x: string, i: number) => <li key={i}>{x}</li>)}
                            </ul>
                          </div>
                        )}
                        {Array.isArray(detail.aiTriage.checksKo) && detail.aiTriage.checksKo.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ops-text-muted)", marginBottom: 6 }}>확인</div>
                            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                              {detail.aiTriage.checksKo.map((x: string, i: number) => <li key={i}>{x}</li>)}
                            </ul>
                          </div>
                        )}
                        {Array.isArray(detail.aiTriage.suggestedActionsKo) && detail.aiTriage.suggestedActionsKo.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ops-text-muted)", marginBottom: 6 }}>권고 조치</div>
                            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                              {detail.aiTriage.suggestedActionsKo.map((x: string, i: number) => <li key={i}>{x}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: "var(--ops-text-muted)", fontSize: 12 }}>이 인시던트의 triage 요약/권고 조치를 생성합니다.</div>
                    )}
                  </div>
                  
                  {playbookActions.length > 0 && (
                    <div style={{ marginTop: 16, borderTop: "1px solid var(--ops-border)", paddingTop: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ops-text-muted)", marginBottom: 12, textTransform: "uppercase" }}>플레이북 액션</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {playbookActions.map((action) => (
                          <div key={action.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, border: "1px solid var(--ops-border)", borderRadius: "var(--ops-radius-sm)" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{action.label}</div>
                              <div style={{ fontSize: 11, color: "var(--ops-text-muted)", marginTop: 2 }}>{action.description}</div>
                            </div>
                            <button className="ops-btn ops-btn-brand" disabled={actionRunning} onClick={() => runAction(action.key)}>실행</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {actionResult && (
                    <div style={{ marginTop: 12, padding: "8px 12px", background: actionResult.ok ? "var(--ops-success-soft)" : "var(--ops-danger-soft)", color: actionResult.ok ? "var(--ops-success)" : "var(--ops-danger)", borderRadius: "var(--ops-radius-sm)", fontSize: 12 }}>
                      {actionResult.ok ? "✅" : "❌"} {actionResult.message}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: "var(--ops-text-muted)", fontSize: 13 }}>데이터 없음</div>
              )}
            </div>
          </div>

          <div className="ops-panel">
            <div className="ops-panel-header">
              <h3 className="ops-panel-title">서킷 브레이커 상태</h3>
              <span className={`ops-badge ${openCBs.length > 0 ? "ops-badge-danger" : "ops-badge-success"}`}>{openCBs.length > 0 ? `OPEN - ${openCBs.length}` : "ALL OK"}</span>
            </div>
            {openCBs.length > 0 && (
              <div className="ops-table-wrap">
                <table className="ops-table">
                  <thead><tr><th>Gate</th><th>내용</th></tr></thead>
                  <tbody>
                    {openCBs.map(cb => (
                      <tr key={cb.id}>
                        <td className="ops-mono">{cb.gateKey}</td>
                        <td style={{ fontSize: 11, color: "var(--ops-text-muted)" }}>{cb.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
