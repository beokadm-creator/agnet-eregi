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
    <div className="im-panel">
      <h2 className="im-panel-title">Review Queue</h2>
      <p className="im-lede">운영자 수동 검토가 필요한 케이스 대기열입니다.</p>
      
      <div className="im-actions">
        <Button disabled={busy} variant="secondary" onClick={refresh}>
          새로고침
        </Button>
      </div>

      {error && (
        <div className="im-log" style={{ marginTop: "2rem", background: "var(--error-light)", color: "var(--error)" }}>
          {error}
        </div>
      )}

      {!error && data && (
        <div style={{ marginTop: "2rem", display: "grid", gap: "1.25rem" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <div style={{ fontWeight: 600 }}>Pending Approvals</div>
              <div style={{ color: "var(--text-tertiary)", fontSize: "0.875rem" }}>{approvals.length}</div>
            </div>
            {approvals.length === 0 ? (
              <div style={{ color: "var(--text-tertiary)", fontSize: "0.875rem" }}>대기 중인 승인 요청이 없습니다.</div>
            ) : (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {approvals.map((a) => (
                  <div key={a.id} style={{ border: "1px solid var(--border)", background: "var(--bg)", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                      <div style={{ fontWeight: 600 }}>{a.actionType || "approval"}</div>
                      <div style={{ color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>{a.caseId || a.target?.caseId || a.id}</div>
                    </div>
                    <div style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {a.reason || a.summary || "승인 대기"}
                    </div>
                    <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                      <Button disabled={busy} onClick={() => approve(a.id)}>승인</Button>
                      <Button disabled={busy} variant="secondary" onClick={() => reject(a.id)}>거부</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <div style={{ fontWeight: 600 }}>Recent Incidents</div>
              <div style={{ color: "var(--text-tertiary)", fontSize: "0.875rem" }}>{incidents.length}</div>
            </div>
            {incidents.length === 0 ? (
              <div style={{ color: "var(--text-tertiary)", fontSize: "0.875rem" }}>최근 Incident가 없습니다.</div>
            ) : (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {incidents.slice(0, 10).map((it) => (
                  <div key={it.id} style={{ border: "1px solid var(--border)", background: "var(--bg)", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                      <div style={{ fontWeight: 600 }}>{it.gateKey || "unknown"}</div>
                      <div style={{ color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>{it.status || "unknown"}</div>
                    </div>
                    <div style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {it.summary || it.title || it.id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
