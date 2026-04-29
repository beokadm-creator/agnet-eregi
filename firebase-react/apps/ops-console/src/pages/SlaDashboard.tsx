import React from "react";
import { Button } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function SlaDashboard() {
  const { busy, data, error, callApi } = useOpsApi();

  const items: any[] = data?.items || [];

  return (
    <div className="im-panel">
      <h2 className="im-panel-title">SLA 대시보드</h2>
      <p className="im-lede">케이스 처리 기한 및 지연 경고 현황입니다.</p>
      
      <div className="im-actions">
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/sla/breaches?limit=100`)}>
          새로고침
        </Button>
      </div>

      {error && (
        <div className="im-log" style={{ marginTop: "2rem", background: "var(--ar-danger-soft)", color: "var(--ar-danger)" }}>
          {error}
        </div>
      )}

      {!error && data && (
        <div style={{ marginTop: "2rem" }}>
          {items.length === 0 ? (
            <div style={{ color: "var(--ar-slate)", fontSize: "0.875rem" }}>현재 감지된 SLA 위반이 없습니다.</div>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {items.map((it) => (
                <div key={it.id} style={{ border: "1px solid var(--ar-hairline)", background: "var(--ar-paper)", padding: "1rem", borderRadius: "var(--ar-r1)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                    <div style={{ fontWeight: 600 }}>{it.gateKey || "unknown"}</div>
                    <div style={{ color: "var(--ar-slate)", fontSize: "0.8125rem" }}>
                      소진율 {typeof it.burnRate === "number" ? `${it.burnRate.toFixed(1)}%` : "-"}
                    </div>
                  </div>
                  <div style={{ marginTop: "0.5rem", display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--ar-slate)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        SLI
                      </div>
                      <div style={{ fontSize: "0.95rem", color: "var(--ar-ink)", fontVariantNumeric: "tabular-nums" }}>
                        {typeof it.sliPercentage === "number" ? `${it.sliPercentage.toFixed(2)}%` : "-"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--ar-slate)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        목표
                      </div>
                      <div style={{ fontSize: "0.95rem", color: "var(--ar-ink)", fontVariantNumeric: "tabular-nums" }}>
                        {typeof it.targetPercentage === "number" ? `${it.targetPercentage.toFixed(2)}%` : "-"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--ar-slate)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        기간
                      </div>
                      <div style={{ fontSize: "0.95rem", color: "var(--ar-ink)", fontVariantNumeric: "tabular-nums" }}>{it.budgetDays || "-"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--ar-slate)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        실패
                      </div>
                      <div style={{ fontSize: "0.95rem", color: "var(--ar-ink)", fontVariantNumeric: "tabular-nums" }}>{it.totalFails ?? "-"}</div>
                    </div>
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
