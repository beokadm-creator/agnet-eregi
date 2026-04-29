import React, { useState, useEffect } from "react";
import { useOpsApi } from "../hooks";

const Ic = {
  download: () => <span>⬇️</span>,
  bolt: () => <span>⚡</span>,
  arrow: () => <span>→</span>,
  chev: () => <span>›</span>,
  shield: () => <span>🛡️</span>,
};

function SloTile({ label, value, target, status }: any) {
  const colors: Record<string, string> = { ok: 'var(--ar-success)', warn: 'var(--ar-warning)', err: 'var(--ar-danger)' };
  return (
    <div className="ar-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ar-slate)' }}>{label}</div>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: colors[status] || colors.ok }} />
      </div>
      <div className="ar-tabular" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 10, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ar-slate)', marginTop: 6 }}>{target}</div>
    </div>
  );
}

function ActionRow({ label, hint, warn, onClick, disabled }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'var(--ar-paper)', border: '1px solid var(--ar-hairline)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--ar-slate)', marginTop: 2 }}>{hint}</div>
      </div>
      <button 
        className={`ar-btn ar-btn-sm ${warn ? 'ar-btn-soft' : 'ar-btn-ghost'}`}
        onClick={onClick}
        disabled={disabled}
      >
        실행 <Ic.arrow />
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { busy, data, error, callApi } = useOpsApi();
  const [gateKey, setGateKey] = useState("pilot-gate");
  const [summaryDate, setSummaryDate] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()));
  const [caseId, setCaseId] = useState("");

  const [dashboardData, setDashboardData] = useState<any>({
    incidents: [],
    sla: []
  });

  // Fetch real metrics on mount
  useEffect(() => {
    async function loadDashboard() {
      try {
        const [reviews, sla] = await Promise.all([
          fetchRealApi(`/v1/ops/reviews/pending?limit=5`),
          fetchRealApi(`/v1/ops/sla/breaches?limit=4`)
        ]);
        setDashboardData({
          incidents: reviews?.incidents || [],
          sla: sla?.items || []
        });
      } catch (e) {
        console.error("Failed to load dashboard metrics", e);
      }
    }
    loadDashboard();
  }, []);

  async function fetchRealApi(path: string) {
    // This is a helper for initial load since useOpsApi is state-based
    const res = await fetch(`${(window as any).API_BASE_URL || ""}${path}`, {
      headers: { 'Authorization': `Bearer ${(window as any).auth_token || ""}` }
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="ar-eyebrow" style={{ marginBottom: 6 }}>Operations · {gateKey} · {summaryDate}</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>플랫폼 운영</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="ar-btn ar-btn-sm ar-btn-ink" onClick={() => callApi(`/v1/ops/reports/${gateKey}/daily?date=${summaryDate}`)}>일일 요약 실행</button>
        </div>
      </div>

      {/* Stats (Real SLA Breaches mapped here) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {dashboardData.sla.length > 0 ? (
          dashboardData.sla.slice(0, 4)?.map((s: any, idx: number) => (
            <SloTile 
              key={idx}
              label={s.gateKey || "SLA Metric"} 
              value={`${s.sliPercentage?.toFixed(1) || 0}%`} 
              target={`Target ${s.targetPercentage}%`} 
              status={s.burnRate > 100 ? "err" : "ok"} 
            />
          ))
        ) : (
          <>
            <div className="ar-card" style={{ padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ar-slate)', marginBottom: 8 }}>Gate Key</div>
              <input className="ar-input ar-input-sm" value={gateKey} onChange={e => setGateKey(e.target.value)} />
            </div>
            <div className="ar-card" style={{ padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ar-slate)', marginBottom: 8 }}>Target Date</div>
              <input type="date" className="ar-input ar-input-sm" value={summaryDate} onChange={e => setSummaryDate(e.target.value)} />
            </div>
            <div className="ar-card" style={{ padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ar-slate)', marginBottom: 8 }}>Troubleshooting Case ID</div>
              <input className="ar-input ar-input-sm" placeholder="case_..." value={caseId} onChange={e => setCaseId(e.target.value)} />
            </div>
            <SloTile label="System Status" value="ACTIVE" target="Gate: Healthy" status="ok" />
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, flex: 1 }}>
        {/* Left - Real Incident Table + API Output Log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
           <div className="ar-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ar-hairline)', display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>최근 인시던트 (실시간)</h3>
                <span className="ar-badge ar-badge-accent">{dashboardData.incidents.length}</span>
              </div>
              <table className="ar-table">
                <thead>
                  <tr><th>ID/게이트</th><th>내용</th><th>상태</th></tr>
                </thead>
                <tbody>
                  {dashboardData.incidents.length > 0 ? (
                    dashboardData.incidents?.map((it: any) => (
                      <tr key={it.id}>
                        <td className="ar-mono" style={{ fontSize: 12 }}>{it.gateKey}</td>
                        <td style={{ fontSize: 13 }}>{it.summary || it.id}</td>
                        <td><span className="ar-badge ar-badge-soft">{it.status || 'ACTIVE'}</span></td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: 'var(--ar-slate)' }}>현재 감지된 인시던트가 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
           </div>

           <div className="ar-card" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ar-hairline)', display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>API 실행 결과</h3>
                {busy && <span className="ar-badge ar-badge-accent">PROCESSING...</span>}
              </div>
              <div style={{ flex: 1, background: 'var(--ar-canvas)', padding: 20, overflow: 'auto' }}>
                {error && <div style={{ color: 'var(--ar-danger)', fontFamily: 'var(--ar-font-mono)', fontSize: 13 }}>[Error] {error}</div>}
                {!error && data && <pre style={{ margin: 0, fontFamily: 'var(--ar-font-mono)', fontSize: 12 }}>{JSON.stringify(data, null, 2)}</pre>}
                {!error && !data && !busy && <div style={{ color: 'var(--ar-slate)', textAlign: 'center', marginTop: 20 }}>배치 액션을 실행하면 결과가 여기에 표시됩니다.</div>}
              </div>
           </div>
        </div>

        {/* Right - Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="ar-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>빠른 실행 (Operations)</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <ActionRow label="일일 Gate 요약" hint={`${gateKey} 리포트`} onClick={() => callApi(`/v1/ops/reports/${gateKey}/daily?date=${summaryDate}`)} disabled={busy} />
              <ActionRow label="패키지 재생성" hint={`Case: ${caseId || '-'}`} onClick={() => callApi(`/v1/ops/cases/${caseId}/packages/regenerate`, { method: "POST", body: "{}" })} disabled={busy || !caseId} />
              <ActionRow label="정산 배치 실행" hint="period_end=today" warn onClick={() => callApi(`/v1/ops/settlements/batch`, { method: "POST", body: JSON.stringify({ periodEnd: new Date().toISOString() }) })} disabled={busy} />
              <ActionRow label="구독 결제 배치" hint={summaryDate} onClick={() => callApi(`/v1/ops/subscriptions/batch`, { method: "POST", body: JSON.stringify({ targetDate: summaryDate }) })} disabled={busy} />
              <ActionRow label="리스크 완화" hint="차단기 리셋" warn onClick={() => callApi(`/v1/ops/risk/${gateKey}/mitigate`, { method: "POST", body: JSON.stringify({ actionKey: "circuit_breaker_reset" }) })} disabled={busy} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
