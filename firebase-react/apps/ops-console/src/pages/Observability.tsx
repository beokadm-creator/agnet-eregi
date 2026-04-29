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

// --- Helpers ---

function formatTimestamp(ts: unknown): string {
  if (!ts) return "-";
  if (typeof ts === "string")
    return new Date(ts).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  if (typeof ts === "object" && ts !== null && "_seconds" in ts)
    return new Date((ts as { _seconds: number })._seconds * 1000).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  return "-";
}

// --- Component ---

export default function Observability() {
  const { token } = useAuth();
  const [data, setData] = useState<PageData>({ metrics: [], quality: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = getApiBaseUrl();

      const results = await Promise.allSettled([
        fetch(`${baseUrl}/v1/ops/metrics/daily`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        fetch(`${baseUrl}/v1/ops/alerts/quality`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      ]);

      const metricResult = results[0];
      const qualityResult = results[1];

      const metrics: DailyMetric[] =
        metricResult.status === "fulfilled" ? metricResult.value.data?.metrics ?? [] : [];

      const quality: QualityData | null =
        qualityResult.status === "fulfilled" ? qualityResult.value.data?.quality ?? null : null;

      setData({ metrics, quality });
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // --- Derived ---

  const latest = data.metrics.length > 0 ? data.metrics[data.metrics.length - 1] : null;
  const deliveryRate = data.quality?.deliveryRate ?? 0;

  // --- KPI Card helper ---

  function kpiCard(emoji: string, label: string, value: string | number, color?: string) {
    return (
      <div className="ar-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>{emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>{label}</span>
        </div>
        <div
          className="ar-tabular"
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            color: color ?? "var(--ar-ink)",
          }}
        >
          {loading ? "-" : value}
        </div>
      </div>
    );
  }

  // --- Render ---

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>관측</h1>
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

      {/* Section 1 — Daily Metrics KPI Cards */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px", color: "var(--ar-graphite)" }}>
          일일 메트릭
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {kpiCard("📡", "API 호출수", latest?.apiCallCount?.toLocaleString() ?? "-")}
          {kpiCard("⏱", "평균 응답시간", latest ? `${latest.avgResponseMs}ms` : "-")}
          {kpiCard(
            "💥",
            "에러율",
            latest ? `${(latest.errorRate * 100).toFixed(2)}%` : "-",
            latest && latest.errorRate > 0.05 ? "var(--ar-danger)" : undefined,
          )}
          {kpiCard("👥", "활성 사용자", latest?.activeUsers?.toLocaleString() ?? "-")}
        </div>
      </div>

      {/* Section 2 — Alert Quality */}
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
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>알림 품질</h3>
          {data.quality && (
            <span className="ar-badge ar-badge-accent">
              전달률 {deliveryRate.toFixed(1)}%
            </span>
          )}
        </div>
        {data.quality ? (
          <div style={{ padding: 20 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div className="ar-card" style={{ padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>총 발송</div>
                <div className="ar-tabular" style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>
                  {data.quality.totalSent.toLocaleString()}
                </div>
              </div>
              <div className="ar-card" style={{ padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>전달 성공</div>
                <div
                  className="ar-tabular"
                  style={{ fontSize: 18, fontWeight: 800, marginTop: 6, color: "var(--ar-success)" }}
                >
                  {data.quality.delivered.toLocaleString()}
                </div>
              </div>
              <div className="ar-card" style={{ padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>실패</div>
                <div
                  className="ar-tabular"
                  style={{ fontSize: 18, fontWeight: 800, marginTop: 6, color: "var(--ar-danger)" }}
                >
                  {data.quality.failed.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Delivery Rate Bar Chart */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span className="ar-label">전달률</span>
                <span className="ar-tabular" style={{ fontSize: 13, fontWeight: 700 }}>
                  {deliveryRate.toFixed(1)}%
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: 12,
                  background: "var(--ar-surface-muted)",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(deliveryRate * 100, 100)}%`,
                    height: "100%",
                    background:
                      deliveryRate >= 0.95
                        ? "var(--ar-success)"
                        : deliveryRate >= 0.8
                          ? "var(--ar-warning)"
                          : "var(--ar-danger)",
                    borderRadius: 6,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 6,
                  fontSize: 11,
                  color: "var(--ar-slate)",
                }}
              >
                <span>0%</span>
                <span>목표 95%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "32px", color: "var(--ar-slate)" }}>
            {loading ? "불러오는 중..." : "알림 품질 데이터가 없습니다."}
          </div>
        )}
      </div>

      {/* Section 3 — Top Endpoints (from latest metrics) */}
      {latest?.topEndpoints && latest.topEndpoints.length > 0 && (
        <div className="ar-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px" }}>인기 엔드포인트</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {latest.topEndpoints.map((ep, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    background: "var(--ar-surface-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--ar-slate)",
                  }}
                >
                  {idx + 1}
                </span>
                <span className="ar-mono" style={{ fontSize: 12 }}>
                  {ep}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
