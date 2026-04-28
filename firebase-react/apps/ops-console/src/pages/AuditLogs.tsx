import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function AuditLogs() {
  const { busy, data, error, callApi } = useOpsApi();

  const items: any[] = data?.items || [];
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actorUid, setActorUid] = useState("");

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("limit", "50");
    if (action) qs.set("action", action);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (actorUid) qs.set("actorUid", actorUid);
    return qs.toString();
  }, [action, from, to, actorUid]);

  useEffect(() => {
    callApi(`/v1/ops/audit-logs?${query}`);
  }, [query]);

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
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/audit-logs?${query}`)}>
          새로고침
        </Button>
      </div>

      <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
        <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "1fr 1fr 1fr" }}>
          <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Action
            <select value={action} onChange={(e) => setAction(e.target.value)} style={{ padding: "0.5rem", border: "1px solid var(--border)", background: "var(--bg)" }}>
              <option value="all">all</option>
              <option value="grant">grant</option>
              <option value="revoke">revoke</option>
              <option value="breakglass">breakglass</option>
              <option value="circuit_breaker_reset">circuit_breaker_reset</option>
              <option value="settlement_batch">settlement_batch</option>
              <option value="ops_auth.denied">ops_auth.denied</option>
              <option value="ops_approvals.approve">ops_approvals.approve</option>
              <option value="ops_approvals.reject">ops_approvals.reject</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: "0.5rem", border: "1px solid var(--border)", background: "var(--bg)" }} />
          </label>

          <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: "0.5rem", border: "1px solid var(--border)", background: "var(--bg)" }} />
          </label>
        </div>

        <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Actor UID
          <input value={actorUid} onChange={(e) => setActorUid(e.target.value)} placeholder="UID 검색" style={{ padding: "0.5rem", border: "1px solid var(--border)", background: "var(--bg)" }} />
        </label>
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
