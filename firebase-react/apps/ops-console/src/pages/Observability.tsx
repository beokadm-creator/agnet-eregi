import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

// --- Types ---
interface DailyMetric {
  date: string;
  apiCallCount: number;
  avgResponseMs: number;
  errorRate: number;
  activeUsers: number;
  topEndpoints?: string[];
}
interface QualityData {
  totalSent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
}
interface PageData {
  metrics: DailyMetric[];
  quality: QualityData | null;
}

export default function Observability() {
  const { token } = useAuth();
  const [data, setData] = useState<PageData>({ metrics: [], quality: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const baseUrl = getApiBaseUrl();
      const results = await Promise.allSettled([
        fetch(`${baseUrl}/v1/ops/metrics/daily`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
        fetch(`${baseUrl}/v1/ops/alerts/quality`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
      ]);
      setData({
        metrics: results[0].status === "fulfilled" ? results[0].value.data?.metrics ?? [] : [],
        quality: results[1].status === "fulfilled" ? results[1].value.data?.quality ?? null : null,
      });
    } catch (e) { setError(e instanceof Error ? e.message : "데이터 로드 실패"); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const latest = data.metrics.length > 0 ? data.metrics[data.metrics.length - 1] : null;
  const deliveryRate = data.quality?.deliveryRate ?? 0;

  function kpiCard(label: string, value: string | number, changeValue?: string, isError: boolean = false) {
    return (
      <div className="ops-metric">
        <div className="ops-metric-label">{label}</div>
        <div className="ops-metric-value" style={{ color: isError ? "var(--ops-danger)" : undefined }}>{loading ? "-" : value}</div>
        {changeValue && <div className="ops-metric-change">{changeValue}</div>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="ops-title">옵저버빌리티 (Observability)</h1>
          <p className="ops-subtitle">시스템 메트릭, 성능 지표 및 알림 발송 품질을 모니터링합니다.</p>
        </div>
        <button className="ops-btn" onClick={fetchAll} disabled={loading}>{loading ? "갱신 중..." : "↻ 새로고침"}</button>
      </div>

      {error && <div style={{ padding: "12px 16px", background: "var(--ops-danger-soft)", color: "var(--ops-danger)", borderRadius: "var(--ops-radius)", fontSize: 13 }}>{error}</div>}

      <div className="ops-panel">
        <div className="ops-panel-header"><h3 className="ops-panel-title">일일 시스템 메트릭</h3></div>
        <div className="ops-panel-body" style={{ padding: 16 }}>
          <div className="ops-grid">
            {kpiCard("API 호출수 (24h)", latest?.apiCallCount?.toLocaleString() ?? "-")}
            {kpiCard("평균 응답시간", latest ? `${latest.avgResponseMs}ms` : "-", "목표: < 500ms")}
            {kpiCard("에러율 (5xx)", latest ? `${(latest.errorRate * 100).toFixed(2)}%` : "-", "SLO: 99.9%", latest && latest.errorRate > 0.05)}
            {kpiCard("활성 사용자 (DAU)", latest?.activeUsers?.toLocaleString() ?? "-")}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
        <div className="ops-panel">
          <div className="ops-panel-header">
            <h3 className="ops-panel-title">알림 (Notification) 발송 품질</h3>
            {data.quality && <span className="ops-badge ops-badge-brand">전달률 {deliveryRate.toFixed(1)}%</span>}
          </div>
          <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {data.quality ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  <div style={{ background: "var(--ops-surface-hover)", padding: 16, borderRadius: "var(--ops-radius-sm)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>총 발송</div>
                    <div className="ops-mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>{data.quality.totalSent.toLocaleString()}</div>
                  </div>
                  <div style={{ background: "var(--ops-success-soft)", padding: 16, borderRadius: "var(--ops-radius-sm)", color: "var(--ops-success)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>전달 성공</div>
                    <div className="ops-mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>{data.quality.delivered.toLocaleString()}</div>
                  </div>
                  <div style={{ background: "var(--ops-danger-soft)", padding: 16, borderRadius: "var(--ops-radius-sm)", color: "var(--ops-danger)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>실패</div>
                    <div className="ops-mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>{data.quality.failed.toLocaleString()}</div>
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ops-text-muted)" }}>전달률 (Delivery Rate)</span>
                    <span className="ops-mono" style={{ fontSize: 14, fontWeight: 700 }}>{deliveryRate.toFixed(1)}%</span>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "var(--ops-border)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(deliveryRate * 100, 100)}%`, height: "100%", background: deliveryRate >= 0.95 ? "var(--ops-success)" : deliveryRate >= 0.8 ? "var(--ops-warning)" : "var(--ops-danger)", borderRadius: 4, transition: "width 0.3s ease" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--ops-text-muted)" }}>
                    <span>0%</span><span>목표 95% 이상</span><span>100%</span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--ops-text-muted)", fontSize: 13 }}>{loading ? "불러오는 중..." : "알림 품질 데이터가 없습니다."}</div>
            )}
          </div>
        </div>

        {latest?.topEndpoints && latest.topEndpoints.length > 0 && (
          <div className="ops-panel">
            <div className="ops-panel-header"><h3 className="ops-panel-title">인기 엔드포인트</h3></div>
            <div className="ops-table-wrap">
              <table className="ops-table">
                <thead><tr><th>Rank</th><th>Endpoint</th></tr></thead>
                <tbody>
                  {latest.topEndpoints.map((ep, idx) => (
                    <tr key={idx}>
                      <td className="ops-mono" style={{ width: 40, color: "var(--ops-text-muted)" }}>#{idx + 1}</td>
                      <td className="ops-mono">{ep}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
