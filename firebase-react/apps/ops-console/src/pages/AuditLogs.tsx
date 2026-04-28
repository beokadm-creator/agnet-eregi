import React from "react";
import { Button } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function AuditLogs() {
  const { busy, data, error, callApi } = useOpsApi();

  const items: any[] = data?.items || [];

  function formatTs(ts: any): string {
    if (!ts) return "-";
    if (typeof ts === "string") return ts;
    if (typeof ts.toDate === "function") return ts.toDate().toLocaleString();
    if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000).toLocaleString();
    return "-";
  }

  return (
    <div className="im-panel">
      <h2 className="im-panel-title">Audit Logs</h2>
      <p className="im-lede">시스템 내 모든 감사 로그(Audit) 내역입니다.</p>
      
      <div className="im-actions">
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/audit-logs?limit=50`)}>
          새로고침
        </Button>
      </div>

      {error && (
        <div className="im-log" style={{ marginTop: "2rem", background: "var(--error-light)", color: "var(--error)" }}>
          {error}
        </div>
      )}

      {!error && data && (
        <div style={{ marginTop: "2rem" }}>
          {items.length === 0 ? (
            <div style={{ color: "var(--text-tertiary)", fontSize: "0.875rem" }}>감사 로그가 없습니다.</div>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {items.map((it) => (
                <div key={it.id} style={{ border: "1px solid var(--border)", background: "var(--bg)", padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline" }}>
                    <div style={{ fontWeight: 600 }}>{it.action}</div>
                    <div style={{ color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>{formatTs(it.createdAt)}</div>
                  </div>
                  <div style={{ marginTop: "0.35rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>
                    <span>{it.status}</span>
                    <span>·</span>
                    <span>{it.gateKey || "no gate"}</span>
                    <span>·</span>
                    <span>{it.actorUid}</span>
                  </div>
                  <div style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {it.summary}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
