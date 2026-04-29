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

interface SloConfig {
  gateKey: string;
  targetPercentage: number;
  budgetDays: number;
  enabled: boolean;
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

// --- Component ---

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
    try {
      setLoading(true);
      setError(null);
      const baseUrl = getApiBaseUrl();

      const results = await Promise.allSettled([
        fetch(`${baseUrl}/v1/ops/sla/breaches?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        fetch(`${baseUrl}/v1/ops/slo/dashboard/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      ]);

      const breachResult = results[0];
      const sloResult = results[1];

      const breaches: SlaBreachItem[] =
        breachResult.status === "fulfilled" ? breachResult.value.data?.items ?? [] : [];

      const sloItems: SloDashboardItem[] =
        sloResult.status === "fulfilled" ? sloResult.value.data?.items ?? [] : [];

      setData({ breaches, sloItems });
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const startEdit = useCallback((item: SloDashboardItem) => {
    setEditingGateKey(item.gateKey);
    setEditTarget(item.targetPercentage);
    setEditBudget(item.budgetDays);
    setEditEnabled(item.enabled);
    setSaveResult(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingGateKey(null);
    setSaveResult(null);
  }, []);

  const saveConfig = useCallback(async () => {
    if (!editingGateKey) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/slo/${encodeURIComponent(editingGateKey)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetPercentage: editTarget,
          budgetDays: editBudget,
          enabled: editEnabled,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setSaveResult({ ok: true, message: "SLO 설정이 저장되었습니다." });
        fetchAll();
      } else {
        setSaveResult({
          ok: false,
          message: json.error?.messageKo || json.error?.message || "저장 실패",
        });
      }
    } catch (e) {
      setSaveResult({
        ok: false,
        message: e instanceof Error ? e.message : "요청 실패",
      });
    } finally {
      setSaving(false);
    }
  }, [token, editingGateKey, editTarget, editBudget, editEnabled, fetchAll]);

  // --- Render ---

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            SLO 대시보드
          </h1>
          <div className="ar-eyebrow" style={{ marginTop: 6, marginBottom: 0 }}>
            서비스 수준 목표 모니터링 및 설정
          </div>
        </div>
        <button className="ar-btn ar-btn-sm ar-btn-ink" onClick={fetchAll} disabled={loading}>
          {loading ? "불러오는 중..." : "새로고침"}
        </button>
      </div>

      {error && (
        <div
          style={{
            color: "var(--ar-danger)",
            fontSize: 13,
            padding: "12px 16px",
            background: "var(--ar-danger-soft)",
            borderRadius: "var(--ar-r1)",
          }}
        >
          {error}
        </div>
      )}

      {/* Section 1 — SLA Breaches */}
      <div className="ar-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--ar-hairline)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>SLA 위반 현황</h3>
          {data.breaches.length > 0 ? (
            <span className="ar-badge ar-badge-danger">{data.breaches.length}건</span>
          ) : (
            <span className="ar-badge ar-badge-success">정상</span>
          )}
        </div>
        {data.breaches.length > 0 ? (
          <table className="ar-table">
            <thead>
              <tr>
                <th>Gate</th>
                <th>SLI (%)</th>
                <th>목표 (%)</th>
                <th>소진율</th>
                <th>실패</th>
                <th>기간 (일)</th>
              </tr>
            </thead>
            <tbody>
              {data.breaches.map((item) => (
                <tr key={item.id}>
                  <td className="ar-mono" style={{ fontSize: 12 }}>{item.gateKey}</td>
                  <td className="ar-tabular" style={{ fontSize: 13 }}>
                    {item.sliPercentage.toFixed(2)}%
                  </td>
                  <td className="ar-tabular" style={{ fontSize: 13 }}>
                    {item.targetPercentage.toFixed(2)}%
                  </td>
                  <td>
                    <span
                      className={`ar-badge ${
                        item.burnRate > 1
                          ? "ar-badge-danger"
                          : item.burnRate > 0.8
                            ? "ar-badge-warning"
                            : "ar-badge-success"
                      }`}
                    >
                      {item.burnRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="ar-tabular" style={{ fontSize: 13 }}>
                    {item.totalFails}
                  </td>
                  <td className="ar-tabular" style={{ fontSize: 13 }}>
                    {item.budgetDays}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: "center", padding: "32px", color: "var(--ar-slate)" }}>
            {loading ? "불러오는 중..." : "현재 감지된 SLA 위반이 없습니다."}
          </div>
        )}
      </div>

      {/* Section 2 — SLO Configuration */}
      <div className="ar-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--ar-hairline)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>SLO 설정</h3>
          <span className="ar-badge ar-badge-accent">{data.sloItems.length}개 Gate</span>
        </div>
        {data.sloItems.length > 0 ? (
          <table className="ar-table">
            <thead>
              <tr>
                <th>Gate</th>
                <th>목표 (%)</th>
                <th>예산 (일)</th>
                <th>활성</th>
                <th>편집</th>
              </tr>
            </thead>
            <tbody>
              {data.sloItems.map((item) => (
                <tr key={item.gateKey}>
                  <td className="ar-mono" style={{ fontSize: 12 }}>{item.gateKey}</td>
                  <td className="ar-tabular" style={{ fontSize: 13 }}>
                    {item.targetPercentage.toFixed(1)}%
                  </td>
                  <td className="ar-tabular" style={{ fontSize: 13 }}>
                    {item.budgetDays}
                  </td>
                  <td>
                    <span className={`ar-badge ${item.enabled ? "ar-badge-success" : "ar-badge-neutral"}`}>
                      {item.enabled ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="ar-btn ar-btn-sm ar-btn-ghost"
                      onClick={() => startEdit(item)}
                      disabled={saving}
                    >
                      편집
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: "center", padding: "32px", color: "var(--ar-slate)" }}>
            {loading ? "불러오는 중..." : "SLO 설정이 없습니다."}
          </div>
        )}

        {/* Edit Form */}
        {editingGateKey && (
          <div
            style={{
              padding: 20,
              borderTop: "1px solid var(--ar-hairline)",
              background: "var(--ar-paper)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
              SLO 편집 — <span className="ar-mono" style={{ fontSize: 13 }}>{editingGateKey}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 16 }}>
              <div>
                <label className="ar-label" style={{ display: "block", marginBottom: 6 }}>
                  목표 (%)
                </label>
                <input
                  className="ar-input ar-input-sm"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={editTarget}
                  onChange={(e) => setEditTarget(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="ar-label" style={{ display: "block", marginBottom: 6 }}>
                  예산 (일)
                </label>
                <input
                  className="ar-input ar-input-sm"
                  type="number"
                  min="1"
                  max="365"
                  value={editBudget}
                  onChange={(e) => setEditBudget(parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, paddingBottom: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={editEnabled}
                    onChange={(e) => setEditEnabled(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "var(--ar-accent)" }}
                  />
                  활성
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="ar-btn ar-btn-sm ar-btn-accent"
                disabled={saving}
                onClick={saveConfig}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
              <button
                className="ar-btn ar-btn-sm ar-btn-ghost"
                onClick={cancelEdit}
                disabled={saving}
              >
                취소
              </button>
              {saveResult && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: saveResult.ok ? "var(--ar-success)" : "var(--ar-danger)",
                  }}
                >
                  {saveResult.ok ? "✅" : "❌"} {saveResult.message}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
