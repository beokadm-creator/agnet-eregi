import { useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../apiBase";
import { useAuth } from "../context/AuthContext";
import { useOpsApi } from "../hooks";

function prettyJson(v: any): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v ?? "");
  }
}

export default function MatchingDebug() {
  const { token } = useAuth();
  const { busy, data, error, callApi } = useOpsApi();
  const [sessionId, setSessionId] = useState("");
  const [recentBusy, setRecentBusy] = useState(false);
  const [recentError, setRecentError] = useState("");
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  const top = useMemo(() => (data?.top || []) as any[], [data?.top]);

  async function run() {
    if (!sessionId.trim()) return;
    await callApi(`/v1/ops/funnel-sessions/${encodeURIComponent(sessionId.trim())}/matching-debug`);
  }

  async function loadRecentSessions() {
    if (!token) return;
    setRecentBusy(true);
    setRecentError("");
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/funnel-sessions/recent?limit=12`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.messageKo || json?.error?.code || `HTTP ${res.status}`);
      }
      setRecentSessions(Array.isArray(json?.data?.items) ? json.data.items : []);
    } catch (e) {
      setRecentSessions([]);
      setRecentError(e instanceof Error ? e.message : "최근 세션 조회 실패");
    } finally {
      setRecentBusy(false);
    }
  }

  useEffect(() => {
    loadRecentSessions();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  function formatTs(value: any): string {
    const ms = value?._seconds ? value._seconds * 1000 : null;
    if (!ms) return "-";
    return new Date(ms).toLocaleString("ko-KR");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 className="ops-title">결과 검증</h1>
        <p className="ops-subtitle">세션 기준으로 추천 점수, 노출 근거, 현재 기준값/점수 규칙 적용 결과를 검증합니다.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 16 }}>
        <div className="ops-panel">
          <div className="ops-panel-header">
            <h2 className="ops-panel-title">최근 퍼널 세션</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ops-btn" onClick={loadRecentSessions} disabled={recentBusy || busy}>
                {recentBusy ? "불러오는 중" : "새로고침"}
              </button>
            </div>
          </div>
          <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recentError && (
              <div style={{ fontSize: 12, color: "var(--ops-danger)" }}>{recentError}</div>
            )}
            <div style={{ display: "grid", gap: 8, maxHeight: 420, overflowY: "auto" }}>
              {recentSessions.map((item) => (
                <button
                  key={item.sessionId}
                  className="ops-btn"
                  style={{
                    height: "auto",
                    padding: 12,
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    flexDirection: "column",
                    gap: 6,
                    background: sessionId === item.sessionId ? "var(--ops-surface-active)" : "var(--ops-surface)",
                    border: "1px solid var(--ops-border)",
                  }}
                  onClick={() => {
                    setSessionId(item.sessionId);
                    callApi(`/v1/ops/funnel-sessions/${encodeURIComponent(item.sessionId)}/matching-debug`);
                  }}
                >
                  <div style={{ display: "flex", width: "100%", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: "var(--ops-text)" }}>{item.scenarioKey || "unknown"}</span>
                    <span className="ops-badge ops-badge-brand">{item.status || "open"}</span>
                  </div>
                  <div className="ops-mono" style={{ fontSize: 11, color: "var(--ops-text-muted)" }}>{item.sessionId}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="ops-badge">답변 {item.answerCount || 0}</span>
                    <span className="ops-badge">추가질문 {item.followUpAnswerCount || 0}</span>
                    {item.followUpStatus ? <span className="ops-badge ops-badge-warning">{item.followUpStatus}</span> : null}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ops-text-faint)" }}>{formatTs(item.createdAt)}</div>
                </button>
              ))}
              {!recentBusy && recentSessions.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--ops-text-muted)" }}>표시할 최근 세션이 없습니다.</div>
              )}
            </div>
          </div>
        </div>

        <div className="ops-panel">
          <div className="ops-panel-header">
            <h2 className="ops-panel-title">세션 직접 조회</h2>
          </div>
          <div className="ops-panel-body" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="ops-input" value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="funnel sessionId" />
            <button className="ops-btn ops-btn-brand" disabled={busy || !sessionId.trim()} onClick={run}>조회</button>
          </div>
        </div>
      </div>

      {error && <div style={{ padding: "12px 16px", background: "var(--ops-danger-soft)", color: "var(--ops-danger)", borderRadius: "var(--ops-radius)", fontSize: 13 }}>{error}</div>}

      {data && (
        <div className="ops-panel">
          <div className="ops-panel-header">
            <h2 className="ops-panel-title">Top 20</h2>
            <span className="ops-badge ops-badge-brand">{top.length}</span>
          </div>
          <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {top.map((p: any) => (
              <div key={p.partnerId} style={{ border: "1px solid var(--ops-border)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>{p.name || p.partnerId}</div>
                  <div className="ops-mono" style={{ fontSize: 12, color: "var(--ops-text-muted)" }}>
                    score {Math.round((p.matchScore || 0) * 100)}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(p.matchReasons || []).map((r: string, idx: number) => (
                    <span key={`${p.partnerId}-r-${idx}`} className="ops-badge ops-badge-brand" style={{ background: "var(--ops-surface)", color: "var(--ops-text-muted)" }}>
                      {r}
                    </span>
                  ))}
                </div>
                <div className="ops-mono" style={{ fontSize: 12, color: "var(--ops-text-muted)" }}>
                  {p.partnerId}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data && (
        <div className="ops-panel">
          <div className="ops-panel-header">
            <h2 className="ops-panel-title">Raw</h2>
          </div>
          <div className="ops-panel-body">
            <pre className="ops-mono" style={{ margin: 0, fontSize: 12, color: "var(--ops-text-muted)", background: "var(--ops-bg)", padding: 12, borderRadius: "var(--ops-radius-sm)", border: "1px solid var(--ops-border)", overflowX: "auto" }}>
              {prettyJson(data)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
