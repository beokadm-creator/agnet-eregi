import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

// --- Types ---

interface CaseStatusCounts {
  [status: string]: number;
}

interface RecentCase {
  id: string;
  title: string;
  status: string;
  partnerId: string;
  createdAt: string;
}

interface RecentPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  createdAt: string;
}

interface BusinessSummaryData {
  cases: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    byStatus: CaseStatusCounts;
    recent: RecentCase[];
  };
  partners: {
    total: number;
    active: number;
  };
  payments: {
    totalRevenue: number;
    thisMonthRevenue: number;
    lastMonthRevenue: number;
    recent: RecentPayment[];
  };
  funnel: {
    sessionsThisMonth: number;
    completedThisMonth: number;
    conversionRate: number;
  };
}

// --- Constants ---

const STATUS_LABELS: Record<string, string> = {
  draft: "임시저장",
  waiting_partner: "파트너 대기",
  collecting: "서류 수집",
  packaging: "패키징",
  ready: "제출 준비",
  completed: "완료",
  failed: "실패",
  cancelled: "취소",
};

const STATUS_VARIANT: Record<string, string> = {
  completed: "ar-badge-success",
  collecting: "ar-badge-info",
  packaging: "ar-badge-info",
  ready: "ar-badge-info",
  waiting_partner: "ar-badge-warning",
  draft: "ar-badge-neutral",
  failed: "ar-badge-danger",
  cancelled: "ar-badge-danger",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  succeeded: "결제완료",
  pending: "대기",
  failed: "실패",
  refunded: "환불",
  cancelled: "취소",
};

const PAYMENT_STATUS_VARIANT: Record<string, string> = {
  succeeded: "ar-badge-success",
  pending: "ar-badge-warning",
  failed: "ar-badge-danger",
  refunded: "ar-badge-neutral",
  cancelled: "ar-badge-neutral",
};

const BAR_COLORS: Record<string, string> = {
  completed: "var(--ar-success)",
  collecting: "var(--ar-info)",
  packaging: "var(--ar-info)",
  ready: "var(--ar-info)",
  waiting_partner: "var(--ar-warning)",
  draft: "var(--ar-warning)",
  failed: "var(--ar-danger)",
  cancelled: "var(--ar-danger)",
  unknown: "var(--ar-fog)",
};

// --- Helpers ---

function formatKRW(amount: number): string {
  if (!amount) return "₩0";
  return "₩" + new Intl.NumberFormat("ko-KR").format(amount);
}

function formatDate(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] || status;
}

function barColor(status: string): string {
  return BAR_COLORS[status] || BAR_COLORS.unknown;
}

// --- Component ---

export default function BusinessDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<BusinessSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/business/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Revenue change calculation
  const revenueChange = data
    ? data.payments.lastMonthRevenue
      ? ((data.payments.thisMonthRevenue - data.payments.lastMonthRevenue) / data.payments.lastMonthRevenue) * 100
      : 0
    : 0;

  // Case status totals for bar chart
  const statusEntries = data
    ? Object.entries(data.cases.byStatus).sort((a, b) => b[1] - a[1])
    : [];
  const totalByStatus = statusEntries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            비즈니스 대시보드
          </h1>
          <div className="ar-eyebrow" style={{ marginTop: 6, marginBottom: 0 }}>
            플랫폼 핵심 지표 현황
          </div>
        </div>
        <button
          className="ar-btn ar-btn-sm ar-btn-ink"
          onClick={fetchSummary}
          disabled={loading}
        >
          {loading ? "불러오는 중..." : "새로고침"}
        </button>
      </div>

      {error && (
        <div style={{ color: "var(--ar-danger)", fontSize: 13 }}>{error}</div>
      )}

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {/* 케이스 */}
        <div className="ar-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>케이스</span>
          </div>
          <div className="ar-tabular" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {data?.cases.total ?? "-"}
          </div>
          <div style={{ fontSize: 11, color: "var(--ar-slate)", marginTop: 8 }}>
            {data ? (
              <>
                <span style={{ color: "var(--ar-success)" }}>+{data.cases.today}</span> 오늘 /{" "}
                <span style={{ color: "var(--ar-accent)" }}>+{data.cases.thisMonth}</span> 이번달
              </>
            ) : "-"}
          </div>
        </div>

        {/* 활성 파트너 */}
        <div className="ar-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>👥</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>활성 파트너</span>
          </div>
          <div className="ar-tabular" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {data ? `${data.partners.active}` : "-"}
          </div>
          <div style={{ fontSize: 11, color: "var(--ar-slate)", marginTop: 8 }}>
            {data ? `전체 ${data.partners.total}명 중 활성` : "-"}
          </div>
        </div>

        {/* 이번달 매출 */}
        <div className="ar-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>💰</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>이번달 매출</span>
          </div>
          <div className="ar-tabular" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {data ? formatKRW(data.payments.thisMonthRevenue) : "-"}
          </div>
          <div style={{ fontSize: 11, color: "var(--ar-slate)", marginTop: 8 }}>
            {data && data.payments.lastMonthRevenue > 0 ? (
              <span style={{ color: revenueChange >= 0 ? "var(--ar-success)" : "var(--ar-danger)" }}>
                {revenueChange >= 0 ? "▲" : "▼"} {Math.abs(revenueChange).toFixed(1)}% 지난달 대비
              </span>
            ) : data ? (
              "이전 데이터 없음"
            ) : (
              "-"
            )}
          </div>
        </div>

        {/* 전환율 */}
        <div className="ar-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🎯</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>전환율</span>
          </div>
          <div className="ar-tabular" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {data ? `${(data.funnel.conversionRate * 100).toFixed(1)}%` : "-"}
          </div>
          <div style={{ fontSize: 11, color: "var(--ar-slate)", marginTop: 8 }}>
            {data ? `${data.funnel.completedThisMonth} / ${data.funnel.sessionsThisMonth} 세션` : "-"}
          </div>
        </div>
      </div>

      {/* Two-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Case status bar chart */}
          <div className="ar-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>케이스 상태 분포</h3>
            {statusEntries.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {statusEntries.map(([status, count]) => {
                  const pct = totalByStatus > 0 ? (count / totalByStatus) * 100 : 0;
                  return (
                    <div key={status}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-graphite)" }}>
                          {statusLabel(status)}
                        </span>
                        <span className="ar-tabular" style={{ fontSize: 12, color: "var(--ar-slate)" }}>
                          {count} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: "var(--ar-canvas)", overflow: "hidden" }}>
                        <div
                          style={{
                            height: 8,
                            borderRadius: 4,
                            background: barColor(status),
                            width: `${pct}%`,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: "var(--ar-slate)", textAlign: "center", padding: 20, fontSize: 13 }}>
                데이터가 없습니다.
              </div>
            )}
          </div>

          {/* Recent cases table */}
          <div className="ar-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ar-hairline)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>최근 케이스</h3>
              {data && <span className="ar-badge ar-badge-accent">{data.cases.recent.length}</span>}
            </div>
            <table className="ar-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>상태</th>
                  <th>파트너</th>
                  <th>생성일</th>
                </tr>
              </thead>
              <tbody>
                {data && data.cases.recent.length > 0 ? (
                  data.cases.recent.slice(0, 10).map((c) => (
                    <tr key={c.id}>
                      <td className="ar-mono" style={{ fontSize: 12 }}>{c.id.slice(0, 12)}</td>
                      <td>
                        <span className={`ar-badge ${STATUS_VARIANT[c.status] || "ar-badge-neutral"}`}>
                          {statusLabel(c.status)}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{c.partnerId ? c.partnerId.slice(0, 10) + "…" : "-"}</td>
                      <td className="ar-tabular" style={{ fontSize: 12, color: "var(--ar-slate)" }}>
                        {formatDate(c.createdAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "var(--ar-slate)" }}>
                      케이스가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Revenue summary card */}
          <div className="ar-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>매출 현황</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "총 매출", value: data?.payments.totalRevenue ?? 0, accent: false },
                { label: "이번달", value: data?.payments.thisMonthRevenue ?? 0, accent: true },
                { label: "지난달", value: data?.payments.lastMonthRevenue ?? 0, accent: false },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ar-graphite)" }}>{row.label}</span>
                  <span
                    className="ar-tabular"
                    style={{
                      fontSize: row.accent ? 16 : 14,
                      fontWeight: row.accent ? 700 : 500,
                      color: row.accent ? "var(--ar-ink)" : "var(--ar-slate)",
                    }}
                  >
                    {data ? formatKRW(row.value) : "-"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent payments table */}
          <div className="ar-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ar-hairline)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>최근 결제</h3>
              {data && <span className="ar-badge ar-badge-accent">{data.payments.recent.length}</span>}
            </div>
            <table className="ar-table">
              <thead>
                <tr>
                  <th>금액</th>
                  <th>통화</th>
                  <th>상태</th>
                  <th>결제수단</th>
                  <th>일자</th>
                </tr>
              </thead>
              <tbody>
                {data && data.payments.recent.length > 0 ? (
                  data.payments.recent.slice(0, 10).map((p) => (
                    <tr key={p.id}>
                      <td className="ar-tabular" style={{ fontSize: 13, fontWeight: 600 }}>
                        {data ? formatKRW(p.amount) : "-"}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--ar-slate)" }}>{(p.currency || "").toUpperCase()}</td>
                      <td>
                        <span className={`ar-badge ${PAYMENT_STATUS_VARIANT[p.status] || "ar-badge-neutral"}`}>
                          {paymentStatusLabel(p.status)}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--ar-slate)" }}>{p.provider || "-"}</td>
                      <td className="ar-tabular" style={{ fontSize: 12, color: "var(--ar-slate)" }}>
                        {formatDate(p.createdAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--ar-slate)" }}>
                      결제 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
