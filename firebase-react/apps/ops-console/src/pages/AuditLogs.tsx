import React, { useEffect, useMemo, useState } from "react";
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="ops-title">감사 로그</h1>
          <p className="ops-subtitle">시스템 내 모든 감사(Audit) 로그 내역을 조회합니다.</p>
        </div>
        <button className="ops-btn" onClick={() => callApi(`/v1/ops/audit-logs?${query}`)} disabled={busy}>
          {busy ? "조회 중..." : "↻ 새로고침"}
        </button>
      </div>

      <div className="ops-panel" style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>액션</label>
            <select className="ops-input" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="all">전체 (All)</option>
              <option value="grant">grant</option>
              <option value="revoke">revoke</option>
              <option value="breakglass">breakglass</option>
              <option value="circuit_breaker_reset">circuit_breaker_reset</option>
              <option value="settlement_batch">settlement_batch</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>시작일</label>
            <input type="date" className="ops-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>종료일</label>
            <input type="date" className="ops-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>작업자 UID</label>
            <input type="text" className="ops-input" value={actorUid} onChange={(e) => setActorUid(e.target.value)} placeholder="UID 검색" />
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "var(--ops-danger-soft)", color: "var(--ops-danger)", borderRadius: "var(--ops-radius)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {!error && (
        <div className="ops-panel">
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>시간</th>
                  <th>액션</th>
                  <th>상태</th>
                  <th>Gate Key</th>
                  <th>작업자 UID</th>
                  <th>요약</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--ops-text-muted)" }}>
                      조회된 감사 로그가 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id}>
                      <td className="ops-mono" style={{ color: "var(--ops-text-muted)" }}>{formatTs(it.createdAt)}</td>
                      <td className="ops-mono" style={{ color: "var(--ops-brand)" }}>{it.action}</td>
                      <td>
                        <span className={`ops-badge ${it.status === 'SUCCESS' ? 'ops-badge-success' : 'ops-badge-danger'}`}>
                          {it.status}
                        </span>
                      </td>
                      <td className="ops-mono">{it.gateKey || "-"}</td>
                      <td className="ops-mono" style={{ fontSize: 11 }}>{it.actorUid}</td>
                      <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.summary}>
                        {it.summary}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
