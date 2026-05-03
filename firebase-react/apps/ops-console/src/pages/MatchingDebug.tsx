import { useMemo, useState } from "react";
import { useOpsApi } from "../hooks";

function prettyJson(v: any): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v ?? "");
  }
}

export default function MatchingDebug() {
  const { busy, data, error, callApi } = useOpsApi();
  const [sessionId, setSessionId] = useState("");

  const top = useMemo(() => (data?.top || []) as any[], [data?.top]);

  async function run() {
    if (!sessionId.trim()) return;
    await callApi(`/v1/ops/funnel-sessions/${encodeURIComponent(sessionId.trim())}/matching-debug`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 className="ops-title">매칭 디버그</h1>
        <p className="ops-subtitle">세션 기준으로 추천 점수/근거와 현재 taxonomy/weights를 확인합니다.</p>
      </div>

      <div className="ops-panel">
        <div className="ops-panel-body" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input className="ops-input" value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="funnel sessionId" />
          <button className="ops-btn ops-btn-brand" disabled={busy || !sessionId.trim()} onClick={run}>조회</button>
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

