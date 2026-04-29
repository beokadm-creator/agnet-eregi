import React from "react";
import { Button } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function ReviewQueue() {
  const { busy, data, error, callApi } = useOpsApi();

  const approvals: any[] = data?.approvals || [];
  const incidents: any[] = data?.incidents || [];

  async function refresh() {
    await callApi(`/v1/ops/reviews/pending?limit=50`);
  }

  async function approve(approvalId: string) {
    await callApi(`/v1/ops/approvals/${approvalId}/approve`, { method: "POST" });
    await refresh();
  }

  async function reject(approvalId: string) {
    const reason = prompt("거부 사유를 입력하세요 (선택)");
    await callApi(`/v1/ops/approvals/${approvalId}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
    await refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="ops-title">검토 대기열</h1>
          <p className="ops-subtitle">운영자 수동 검토가 필요한 케이스 및 이슈 대기열입니다.</p>
        </div>
        <button className="ops-btn" onClick={refresh} disabled={busy}>
          {busy ? "갱신 중..." : "↻ 새로고침"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "var(--ops-danger-soft)", color: "var(--ops-danger)", borderRadius: "var(--ops-radius)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Main content grid */}
      {!error && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Approvals */}
          <div className="ops-panel">
            <div className="ops-panel-header">
              <h2 className="ops-panel-title">승인 대기 중</h2>
              <span className="ops-badge ops-badge-warning">{approvals.length}</span>
            </div>
            <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {approvals.length === 0 ? (
                <div style={{ color: "var(--ops-text-muted)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
                  대기 중인 승인 요청이 없습니다.
                </div>
              ) : (
                approvals.map((a: any) => (
                  <div key={a.id} style={{ border: "1px solid var(--ops-border)", background: "var(--ops-bg)", padding: 12, borderRadius: "var(--ops-radius-sm)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div className="ops-mono" style={{ fontWeight: 600, color: "var(--ops-brand)" }}>{a.actionType || "approval"}</div>
                      <div className="ops-mono" style={{ color: "var(--ops-text-faint)", fontSize: 11 }}>{a.caseId || a.target?.caseId || a.id}</div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, color: "var(--ops-text)", lineHeight: 1.5 }}>
                      {a.reason || a.summary || "승인 대기 내역"}
                    </div>
                    <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button className="ops-btn ops-btn-danger" disabled={busy} onClick={() => reject(a.id)}>거부</button>
                      <button className="ops-btn ops-btn-brand" disabled={busy} onClick={() => approve(a.id)}>승인</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Incidents Check */}
          <div className="ops-panel">
            <div className="ops-panel-header">
              <h2 className="ops-panel-title">관련 인시던트 (최근 10건)</h2>
              <span className="ops-badge ops-badge-danger">{incidents.length}</span>
            </div>
            <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {incidents.length === 0 ? (
                <div style={{ color: "var(--ops-text-muted)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
                  최근 인시던트가 없습니다.
                </div>
              ) : (
                incidents.slice(0, 10).map((it: any) => (
                  <div key={it.id} style={{ border: "1px solid var(--ops-border)", background: "var(--ops-bg)", padding: 12, borderRadius: "var(--ops-radius-sm)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div className="ops-mono" style={{ fontWeight: 600 }}>{it.gateKey || "unknown"}</div>
                      <span className={`ops-badge ${it.status === 'ACTIVE' ? 'ops-badge-danger' : 'ops-badge-warning'}`}>
                        {it.status || "unknown"}
                      </span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, color: "var(--ops-text-muted)", lineHeight: 1.5 }}>
                      {it.summary || it.title || it.id}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
