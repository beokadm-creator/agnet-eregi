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

// --- Constants ---

const SEVERITY_BADGES: Record<string, string> = {
  critical: "ar-badge-danger",
  warn: "ar-badge-warning",
  info: "ar-badge-info",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "심각",
  warn: "경고",
  info: "정보",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "활성",
  INVESTIGATING: "조사중",
  MITIGATING: "완화중",
  CLOSED: "종료",
  RESOLVED: "해결",
};

const STATUS_BADGES: Record<string, string> = {
  ACTIVE: "ar-badge-danger",
  INVESTIGATING: "ar-badge-warning",
  MITIGATING: "ar-badge-info",
  CLOSED: "ar-badge-neutral",
  RESOLVED: "ar-badge-success",
};

const RISK_BADGES: Record<string, string> = {
  Low: "ar-badge-success",
  Medium: "ar-badge-warning",
  High: "ar-badge-danger",
};

const RISK_LABELS: Record<string, string> = {
  Low: "안전",
  Medium: "주의",
  High: "위험",
};

// --- Helpers ---

function formatTimestamp(ts: unknown): string {
  if (!ts) return "-";
  if (typeof ts === "string")
    return new Date(ts).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  if (typeof ts === "object" && ts !== null && "_seconds" in ts)
    return new Date((ts as { _seconds: number })._seconds * 1000).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  return "-";
}

function severityBadge(sev: string): string {
  return SEVERITY_BADGES[sev] || "ar-badge-neutral";
}

function severityLabel(sev: string): string {
  return SEVERITY_LABELS[sev] || sev;
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

function statusBadge(status: string): string {
  return STATUS_BADGES[status] || "ar-badge-neutral";
}

// --- Component ---

export default function Incidents() {
  const { token } = useAuth();

  // List state
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [gateFilter, setGateFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState("전체");

  // Detail state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Incident | null>(null);
  const [playbookActions, setPlaybookActions] = useState<PlaybookAction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action state
  const [actionRunning, setActionRunning] = useState(false);
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Risk mitigation
  const [mitigateGateKey, setMitigateGateKey] = useState("");
  const [mitigateRunning, setMitigateRunning] = useState(false);
  const [mitigateResult, setMitigateResult] = useState<{ ok: boolean; message: string } | null>(null);

  // --- Data Fetching ---

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = getApiBaseUrl();

      const results = await Promise.allSettled([
        fetch(`${baseUrl}/v1/ops/incidents?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        fetch(`${baseUrl}/v1/ops/risk/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      ]);

      const incidentResult = results[0];
      const riskResult = results[1];

      const items: Incident[] =
        incidentResult.status === "fulfilled" ? incidentResult.value.data?.items ?? [] : [];
      setIncidents(items);

      setRiskSummary(
        riskResult.status === "fulfilled" ? riskResult.value.data?.summary ?? null : null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // --- Detail & Playbook ---

  const selectIncident = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setDetail(null);
      setPlaybookActions([]);
      setActionResult(null);
      setDetailLoading(true);

      const baseUrl = getApiBaseUrl();

      const results = await Promise.allSettled([
        fetch(`${baseUrl}/v1/ops/incidents/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        fetch(`${baseUrl}/v1/ops/incidents/${id}/playbook`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      ]);

      setDetail(
        results[0].status === "fulfilled" ? results[0].value.data?.incident ?? null : null,
      );
      setPlaybookActions(
        results[1].status === "fulfilled" ? results[1].value.data?.playbook?.actions ?? [] : [],
      );
      setDetailLoading(false);
    },
    [token],
  );

  // --- Actions ---

  const runAction = useCallback(
    async (actionKey: string) => {
      if (!selectedId) return;
      setActionRunning(true);
      setActionResult(null);
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/v1/ops/incidents/${selectedId}/playbook/run`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ actionKey }),
        });
        const json = await res.json();
        if (json.ok) {
          setActionResult({ ok: true, message: json.data ? JSON.stringify(json.data) : "완료" });
          fetchAll();
        } else {
          setActionResult({
            ok: false,
            message: json.error?.messageKo || json.error?.message || "실패",
          });
        }
      } catch (e) {
        setActionResult({
          ok: false,
          message: e instanceof Error ? e.message : "요청 실패",
        });
      } finally {
        setActionRunning(false);
      }
    },
    [token, selectedId, fetchAll],
  );

  const mitigateRisk = useCallback(
    async (gateKey: string) => {
      setMitigateRunning(true);
      setMitigateResult(null);
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/v1/ops/risk/${encodeURIComponent(gateKey)}/mitigate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        const json = await res.json();
        if (json.ok) {
          setMitigateResult({ ok: true, message: json.data ? JSON.stringify(json.data) : "완화 성공" });
          fetchAll();
        } else {
          setMitigateResult({
            ok: false,
            message: json.error?.messageKo || json.error?.message || "실패",
          });
        }
      } catch (e) {
        setMitigateResult({
          ok: false,
          message: e instanceof Error ? e.message : "요청 실패",
        });
      } finally {
        setMitigateRunning(false);
      }
    },
    [token, fetchAll],
  );

  const rebuildIncidents = useCallback(async () => {
    setActionRunning(true);
    setActionResult(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/incidents/rebuild`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) {
        setActionResult({ ok: true, message: json.data ? JSON.stringify(json.data) : "재빌드 완료" });
        fetchAll();
      } else {
        setActionResult({
          ok: false,
          message: json.error?.messageKo || json.error?.message || "실패",
        });
      }
    } catch (e) {
      setActionResult({
        ok: false,
        message: e instanceof Error ? e.message : "요청 실패",
      });
    } finally {
      setActionRunning(false);
    }
  }, [token, fetchAll]);

  // --- Derived ---

  const gateKeys = Array.from(new Set(incidents.map((i) => i.gateKey))).sort();

  const filtered = incidents.filter((i) => {
    if (gateFilter !== "전체" && i.gateKey !== gateFilter) return false;
    if (statusFilter !== "전체") {
      const mappedStatus = statusFilter.replace(/.*\(([^)]+)\)/, "$1");
      if (i.status !== mappedStatus) return false;
    }
    return true;
  });

  const totalCount = incidents.length;
  const activeCount = incidents.filter(
    (i) => i.status !== "CLOSED" && i.status !== "RESOLVED",
  ).length;

  const openCBs = incidents.filter(
    (i) => i.summary?.toLowerCase().includes("circuit_breaker") && i.status !== "CLOSED",
  );

  // --- Render ---

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            인시던트 관리
          </h1>
          <div className="ar-eyebrow" style={{ marginTop: 6, marginBottom: 0 }}>
            장애 감지, 플레이북 실행, 서킷 브레이커 상태
          </div>
        </div>
        <button className="ar-btn ar-btn-sm ar-btn-ink" onClick={fetchAll} disabled={loading}>
          {loading ? "불러오는 중..." : "새로고침"}
        </button>
      </div>

      {error && (
        <div
          style={{
            color: "var(--ar-danger)",
            fontSize: 13,
            padding: "12px 16px",
            background: "var(--ar-danger-soft)",
            borderRadius: "var(--ar-r1)",
          }}
        >
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ar-graphite)" }}>필터:</span>
        <select
          className="ar-input ar-input-sm"
          style={{ width: "auto" }}
          value={gateFilter}
          onChange={(e) => setGateFilter(e.target.value)}
        >
          <option value="전체">전체</option>
          {gateKeys.map((gk) => (
            <option key={gk} value={gk}>
              {gk}
            </option>
          ))}
        </select>
        <select
          className="ar-input ar-input-sm"
          style={{ width: "auto" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="전체">전체</option>
          <option value="활성(ACTIVE)">활성(ACTIVE)</option>
          <option value="조사중(INVESTIGATING)">조사중(INVESTIGATING)</option>
          <option value="완화중(MITIGATING)">완화중(MITIGATING)</option>
          <option value="종료(CLOSED)">종료(CLOSED)</option>
          <option value="해결(RESOLVED)">해결(RESOLVED)</option>
        </select>
        <button
          className="ar-btn ar-btn-sm ar-btn-soft"
          disabled={actionRunning}
          onClick={rebuildIncidents}
        >
          인시던트 재빌드
        </button>
        <span style={{ margin: "0 4px", color: "var(--ar-hairline)" }}>|</span>
        <input
          className="ar-input ar-input-sm"
          style={{ width: 160 }}
          placeholder="리스크 완화 Gate Key"
          value={mitigateGateKey}
          onChange={(e) => setMitigateGateKey(e.target.value)}
        />
        <button
          className="ar-btn ar-btn-sm ar-btn-accent"
          disabled={mitigateRunning || !mitigateGateKey.trim()}
          onClick={() => {
            mitigateRisk(mitigateGateKey.trim());
          }}
        >
          {mitigateRunning ? "실행 중..." : "🛡️ 리스크 완화"}
        </button>
      </div>

      {mitigateResult && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--ar-r1)",
            background: mitigateResult.ok ? "var(--ar-success-soft)" : "var(--ar-danger-soft)",
            color: mitigateResult.ok ? "var(--ar-success)" : "var(--ar-danger)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {mitigateResult.ok ? "✅" : "❌"} 리스크 완화:{" "}
          <span style={{ fontWeight: 500 }}>{mitigateResult.message}</span>
        </div>
      )}

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <div className="ar-card" style={{ padding: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>
            전체 인시던트
          </span>
          <div
            className="ar-tabular"
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              marginTop: 8,
            }}
          >
            {loading ? "-" : totalCount}
          </div>
        </div>
        <div className="ar-card" style={{ padding: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>활성</span>
          <div
            className="ar-tabular"
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              marginTop: 8,
              color: activeCount > 0 ? "var(--ar-danger)" : "var(--ar-success)",
            }}
          >
            {loading ? "-" : activeCount}
          </div>
        </div>
        <div className="ar-card" style={{ padding: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>리스크 수준</span>
          <div style={{ marginTop: 8 }}>
            {riskSummary ? (
              <span
                className={`ar-badge ${RISK_BADGES[riskSummary.riskLevel] || "ar-badge-neutral"}`}
                style={{ fontSize: 14, padding: "6px 14px" }}
              >
                {RISK_LABELS[riskSummary.riskLevel] || riskSummary.riskLevel}
              </span>
            ) : (
              <span style={{ fontSize: 14, color: "var(--ar-fog)", fontWeight: 700 }}>-</span>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        {/* Left — Incident Table */}
        <div
          className="ar-card"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--ar-hairline)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>인시던트 목록</h3>
            <span className="ar-badge ar-badge-accent">{filtered.length}</span>
          </div>
          <table className="ar-table">
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
                  <tr
                    key={inc.id}
                    onClick={() => selectIncident(inc.id)}
                    style={{
                      cursor: "pointer",
                      background:
                        selectedId === inc.id ? "var(--ar-accent-soft)" : undefined,
                    }}
                  >
                    <td className="ar-mono" style={{ fontSize: 12 }}>
                      {inc.gateKey}
                    </td>
                    <td
                      style={{
                        fontSize: 13,
                        maxWidth: 280,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {inc.summary || inc.id}
                    </td>
                    <td>
                      <span className={`ar-badge ${severityBadge(inc.severity)}`}>
                        {severityLabel(inc.severity)}
                      </span>
                    </td>
                    <td>
                      <span className={`ar-badge ${statusBadge(inc.status)}`}>
                        {statusLabel(inc.status)}
                      </span>
                    </td>
                    <td
                      className="ar-tabular"
                      style={{ fontSize: 12, color: "var(--ar-slate)" }}
                    >
                      {formatTimestamp(inc.startAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      padding: "32px",
                      color: "var(--ar-slate)",
                    }}
                  >
                    {loading ? "불러오는 중..." : "인시던트가 없습니다."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right — Detail Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!selectedId ? (
            <div
              className="ar-card"
              style={{
                padding: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ar-slate)",
                fontSize: 14,
                minHeight: 300,
              }}
            >
              인시던트를 선택하면 상세 정보가 표시됩니다.
            </div>
          ) : (
            <>
              {/* Detail Card */}
              <div className="ar-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>상세 정보</h3>
                {detailLoading ? (
                  <div style={{ color: "var(--ar-slate)", fontSize: 13, padding: "16px 0" }}>
                    불러오는 중...
                  </div>
                ) : detail ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "var(--ar-slate)" }}>Gate</span>
                      <span className="ar-mono" style={{ fontSize: 13 }}>
                        {detail.gateKey}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "var(--ar-slate)" }}>심각도</span>
                      <span className={`ar-badge ${severityBadge(detail.severity)}`}>
                        {severityLabel(detail.severity)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "var(--ar-slate)" }}>상태</span>
                      <span className={`ar-badge ${statusBadge(detail.status)}`}>
                        {statusLabel(detail.status)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "var(--ar-slate)" }}>발생시간</span>
                      <span className="ar-tabular" style={{ fontSize: 12 }}>
                        {formatTimestamp(detail.startAt)}
                      </span>
                    </div>
                    {detail.endAt && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "var(--ar-slate)" }}>종료시간</span>
                        <span className="ar-tabular" style={{ fontSize: 12 }}>
                          {formatTimestamp(detail.endAt)}
                        </span>
                      </div>
                    )}
                    {detail.summary && (
                      <div style={{ marginTop: 4, fontSize: 13, color: "var(--ar-graphite)" }}>
                        {detail.summary}
                      </div>
                    )}
                    {detail.counters && Object.keys(detail.counters).length > 0 && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: "var(--ar-slate)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        {Object.entries(detail.counters).map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>{k}</span>
                            <span className="ar-tabular">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div
                      style={{
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: "1px solid var(--ar-hairline)",
                      }}
                    >
                      <button
                        className="ar-btn ar-btn-sm ar-btn-accent"
                        disabled={mitigateRunning}
                        onClick={() => {
                          setMitigateGateKey(detail.gateKey);
                          mitigateRisk(detail.gateKey);
                        }}
                        style={{ width: "100%" }}
                      >
                        {mitigateRunning ? "실행 중..." : "🛡️ 리스크 완화 실행"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "var(--ar-slate)", fontSize: 13 }}>
                    상세 정보를 불러올 수 없습니다.
                  </div>
                )}
              </div>

              {/* Playbook Actions */}
              <div className="ar-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>
                  플레이북 실행
                </h3>
                {detailLoading ? (
                  <div style={{ color: "var(--ar-slate)", fontSize: 13 }}>불러오는 중...</div>
                ) : playbookActions.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {playbookActions.map((action) => (
                      <div
                        key={action.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{action.label}</div>
                          <div style={{ fontSize: 12, color: "var(--ar-slate)", marginTop: 2 }}>
                            {action.description}
                          </div>
                        </div>
                        <button
                          className="ar-btn ar-btn-sm ar-btn-ghost"
                          disabled={actionRunning}
                          onClick={() => runAction(action.key)}
                        >
                          실행
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "var(--ar-slate)", fontSize: 13 }}>
                    사용 가능한 플레이북 액션이 없습니다.
                  </div>
                )}

                {/* Inline action result */}
                {actionResult && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: "10px 14px",
                      borderRadius: "var(--ar-r1)",
                      background: actionResult.ok
                        ? "var(--ar-success-soft)"
                        : "var(--ar-danger-soft)",
                      color: actionResult.ok ? "var(--ar-success)" : "var(--ar-danger)",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {actionResult.ok ? "✅" : "❌"}{" "}
                    <span style={{ fontWeight: 500 }}>{actionResult.message}</span>
                  </div>
                )}
                {actionRunning && !actionResult && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: "10px 14px",
                      borderRadius: "var(--ar-r1)",
                      background: "var(--ar-info-soft)",
                      color: "var(--ar-info)",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    ⏳ 실행 중...
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom — Circuit Breaker Section */}
      <div className="ar-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            🛡️ 서킷 브레이커 상태
          </h3>
          {openCBs.length > 0 ? (
            <span className="ar-badge ar-badge-danger">OPEN — {openCBs.length}건</span>
          ) : (
            <span className="ar-badge ar-badge-success">전체 정상</span>
          )}
        </div>
        {openCBs.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <table className="ar-table">
              <thead>
                <tr>
                  <th>Gate</th>
                  <th>내용</th>
                  <th>상태</th>
                  <th>발생시간</th>
                </tr>
              </thead>
              <tbody>
                {openCBs.map((cb) => (
                  <tr key={cb.id}>
                    <td className="ar-mono" style={{ fontSize: 12 }}>
                      {cb.gateKey}
                    </td>
                    <td style={{ fontSize: 13 }}>{cb.summary || cb.id}</td>
                    <td>
                      <span className={`ar-badge ${statusBadge(cb.status)}`}>
                        {statusLabel(cb.status)}
                      </span>
                    </td>
                    <td
                      className="ar-tabular"
                      style={{ fontSize: 12, color: "var(--ar-slate)" }}
                    >
                      {formatTimestamp(cb.startAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
