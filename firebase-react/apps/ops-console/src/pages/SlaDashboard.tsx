import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

// --- Types ---
interface SlaBreachItem {
  id: string;
  gateKey: string;
  sliPercentage: number;
  targetPercentage: number;
  budgetDays: number;
  burnRate: number;
  totalFails: number;
}
interface SloDashboardItem {
  gateKey: string;
  targetPercentage: number;
  budgetDays: number;
  enabled: boolean;
  currentSli?: number;
  errorBudgetRemaining?: number;
}
interface PageData {
  breaches: SlaBreachItem[];
  sloItems: SloDashboardItem[];
}

export default function SlaDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<PageData>({ breaches: [], sloItems: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingGateKey, setEditingGateKey] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<number>(99.5);
  const [editBudget, setEditBudget] = useState<number>(30);
  const [editEnabled, setEditEnabled] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const results = await Promise.allSettled([
        fetch(`${getApiBaseUrl()}/v1/ops/sla/breaches?limit=100`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${getApiBaseUrl()}/v1/ops/slo/dashboard/status`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      setData({
        breaches: results[0].status === "fulfilled" && results[0].value.ok ? results[0].value.data?.items ?? [] : [],
        sloItems: results[1].status === "fulfilled" && results[1].value.ok ? results[1].value.data?.items ?? [] : [],
      });
    } catch { setError("데이터를 불러올 수 없습니다."); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const startEdit = useCallback((item: SloDashboardItem) => {
    setEditingGateKey(item.gateKey); setEditTarget(item.targetPercentage); setEditBudget(item.budgetDays); setEditEnabled(item.enabled); setSaveResult(null);
  }, []);
  const cancelEdit = useCallback(() => { setEditingGateKey(null); setSaveResult(null); }, []);

  const saveConfig = useCallback(async () => {
    if (!editingGateKey) return;
    setSaving(true); setSaveResult(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/slo/${encodeURIComponent(editingGateKey)}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ targetPercentage: editTarget, budgetDays: editBudget, enabled: editEnabled }) });
      const json = await res.json();
      if (json.ok) { setSaveResult({ ok: true, message: "저장되었습니다." }); fetchAll(); }
      else setSaveResult({ ok: false, message: "저장 실패" });
    } catch { setSaveResult({ ok: false, message: "요청 실패" }); } finally { setSaving(false); }
  }, [token, editingGateKey, editTarget, editBudget, editEnabled, fetchAll]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="ops-title">SLO 대시보드</h1>
          <p className="ops-subtitle">서비스 수준 목표 모니터링 및 설정</p>
        </div>
        <button className="ops-btn" onClick={fetchAll} disabled={loading}>{loading ? "갱신 중..." : "↻ 새로고침"}</button>
      </div>

      {error && <div style={{ padding: 12, background: "var(--ops-danger-soft)", color: "var(--ops-danger)", borderRadius: "var(--ops-radius-sm)", fontSize: 13 }}>{error}</div>}

      <div className="ops-panel">
        <div className="ops-panel-header">
          <h3 className="ops-panel-title">SLA 위반 현황</h3>
          {data.breaches.length > 0 ? <span className="ops-badge ops-badge-danger">{data.breaches.length}건</span> : <span className="ops-badge ops-badge-success">정상</span>}
        </div>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead><tr><th>Gate</th><th>SLI (%)</th><th>목표 (%)</th><th>소진율</th><th>실패</th><th>기간 (일)</th></tr></thead>
            <tbody>
              {data.breaches.length > 0 ? data.breaches.map((item) => (
                <tr key={item.id}>
                  <td className="ops-mono" style={{ fontWeight: 600 }}>{item.gateKey}</td>
                  <td className="ops-mono">{item.sliPercentage.toFixed(2)}%</td>
                  <td className="ops-mono" style={{ color: "var(--ops-text-muted)" }}>{item.targetPercentage.toFixed(2)}%</td>
                  <td><span className={`ops-badge ${item.burnRate > 1 ? "ops-badge-danger" : item.burnRate > 0.8 ? "ops-badge-warning" : "ops-badge-success"}`}>{item.burnRate.toFixed(1)}%</span></td>
                  <td className="ops-mono">{item.totalFails}</td>
                  <td className="ops-mono" style={{ color: "var(--ops-text-muted)" }}>{item.budgetDays}</td>
                </tr>
              )) : <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--ops-text-muted)" }}>{loading ? "불러오는 중..." : "감지된 SLA 위반이 없습니다."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ops-panel">
        <div className="ops-panel-header">
          <h3 className="ops-panel-title">SLO 설정</h3>
          <span className="ops-badge ops-badge-brand">{data.sloItems.length}개 Gate</span>
        </div>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead><tr><th>Gate</th><th>목표 (%)</th><th>예산 (일)</th><th>상태</th><th>작업</th></tr></thead>
            <tbody>
              {data.sloItems.length > 0 ? data.sloItems.map((item) => (
                <tr key={item.gateKey} style={{ background: editingGateKey === item.gateKey ? "var(--ops-surface-active)" : undefined }}>
                  <td className="ops-mono" style={{ fontWeight: 600 }}>{item.gateKey}</td>
                  <td className="ops-mono">{item.targetPercentage.toFixed(1)}%</td>
                  <td className="ops-mono">{item.budgetDays}</td>
                  <td><span className={`ops-badge ${item.enabled ? "ops-badge-success" : "ops-badge-neutral"}`}>{item.enabled ? "활성" : "비활성"}</span></td>
                  <td><button className="ops-btn" onClick={() => startEdit(item)} disabled={saving}>편집</button></td>
                </tr>
              )) : <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--ops-text-muted)" }}>{loading ? "불러오는 중..." : "SLO 설정이 없습니다."}</td></tr>}
            </tbody>
          </table>
        </div>

        {editingGateKey && (
          <div style={{ padding: 20, borderTop: "1px solid var(--ops-border)", background: "var(--ops-bg)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>SLO 편집 — <span className="ops-mono" style={{ color: "var(--ops-brand)" }}>{editingGateKey}</span></div>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>목표 (%)</label>
                <input className="ops-input" type="number" step="0.1" min="0" max="100" value={editTarget} onChange={(e) => setEditTarget(parseFloat(e.target.value) || 0)} style={{ width: 120 }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>예산 (일)</label>
                <input className="ops-input" type="number" min="1" max="365" value={editBudget} onChange={(e) => setEditBudget(parseInt(e.target.value, 10) || 1)} style={{ width: 120 }} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, height: 40, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={editEnabled} onChange={(e) => setEditEnabled(e.target.checked)} style={{ accentColor: "var(--ops-brand)", width: 16, height: 16 }} />
                활성
              </label>
              <div style={{ display: "flex", gap: 8, height: 40, alignItems: "center", marginLeft: "auto" }}>
                <button className="ops-btn" onClick={cancelEdit} disabled={saving}>취소</button>
                <button className="ops-btn ops-btn-brand" onClick={saveConfig} disabled={saving}>{saving ? "저장 중" : "저장"}</button>
              </div>
            </div>
            {saveResult && <div style={{ marginTop: 12, fontSize: 13, color: saveResult.ok ? "var(--ops-success)" : "var(--ops-danger)" }}>{saveResult.ok ? "✅" : "❌"} {saveResult.message}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
