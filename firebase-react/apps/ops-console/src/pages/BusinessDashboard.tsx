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
  completed: "ops-badge-success",
  collecting: "ops-badge-brand",
  packaging: "ops-badge-brand",
  ready: "ops-badge-brand",
  waiting_partner: "ops-badge-warning",
  draft: "ops-badge-neutral",
  failed: "ops-badge-danger",
  cancelled: "ops-badge-danger",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  succeeded: "결제완료",
  pending: "대기",
  failed: "실패",
  refunded: "환불",
  cancelled: "취소",
};

const PAYMENT_STATUS_VARIANT: Record<string, string> = {
  succeeded: "ops-badge-success",
  pending: "ops-badge-warning",
  failed: "ops-badge-danger",
  refunded: "ops-badge-neutral",
  cancelled: "ops-badge-neutral",
};

const BAR_COLORS: Record<string, string> = {
  completed: "var(--ops-success)",
  collecting: "var(--ops-brand)",
  packaging: "var(--ops-brand)",
  ready: "var(--ops-brand)",
  waiting_partner: "var(--ops-warning)",
  draft: "var(--ops-warning)",
  failed: "var(--ops-danger)",
  cancelled: "var(--ops-danger)",
  unknown: "var(--ops-border)",
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
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/business/summary`, {
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

  const revenueChange = data
    ? data.payments.lastMonthRevenue
      ? ((data.payments.thisMonthRevenue - data.payments.lastMonthRevenue) / data.payments.lastMonthRevenue) * 100
      : 0
    : 0;

  const statusEntries = data
    ? Object.entries(data.cases.byStatus).sort((a, b) => b[1] - a[1])
    : [];
  const totalByStatus = statusEntries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="ops-title">비즈니스 대시보드</h1>
          <p className="ops-subtitle">플랫폼 핵심 지표 현황을 실시간으로 확인합니다.</p>
        </div>
        <button
          className="ops-btn"
          onClick={fetchSummary}
          disabled={loading}
        >
          {loading ? "갱신 중..." : "↻ 새로고침"}
        </button>
      </div>

      {error && (
        <div style={{ color: "var(--ops-danger)", fontSize: 13, padding: "12px", background: "var(--ops-danger-soft)", borderRadius: "var(--ops-radius)" }}>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="ops-grid">
        {/* 케이스 */}
        <div className="ops-metric">
          <div className="ops-metric-label">총 케이스</div>
          <div className="ops-metric-value">{data?.cases.total ?? "-"}</div>
          <div className="ops-metric-change">
            <span style={{ color: "var(--ops-success)" }}>+{data?.cases.today ?? 0}</span> 오늘 / <span style={{ color: "var(--ops-brand)" }}>+{data?.cases.thisMonth ?? 0}</span> 이번달
          </div>
        </div>

        {/* 활성 파트너 */}
        <div className="ops-metric">
          <div className="ops-metric-label">활성 파트너</div>
          <div className="ops-metric-value">{data ? `${data.partners.active}` : "-"}</div>
          <div className="ops-metric-change">
            <span style={{ color: "var(--ops-text-muted)" }}>전체 {data?.partners.total ?? 0}명 중 활성</span>
          </div>
        </div>

        {/* 이번달 매출 */}
        <div className="ops-metric">
          <div className="ops-metric-label">이번달 매출</div>
          <div className="ops-metric-value">{data ? formatKRW(data.payments.thisMonthRevenue) : "-"}</div>
          <div className="ops-metric-change">
            {data && data.payments.lastMonthRevenue > 0 ? (
              <span className={revenueChange >= 0 ? "ops-metric-up" : "ops-metric-down"}>
                {revenueChange >= 0 ? "▲" : "▼"} {Math.abs(revenueChange).toFixed(1)}% 지난달 대비
              </span>
            ) : "이전 데이터 없음"}
          </div>
        </div>

        {/* 전환율 */}
        <div className="ops-metric">
          <div className="ops-metric-label">전환율 (이번달)</div>
          <div className="ops-metric-value">{data ? `${(data.funnel.conversionRate * 100).toFixed(1)}%` : "-"}</div>
          <div className="ops-metric-change">
            <span style={{ color: "var(--ops-text-muted)" }}>{data?.funnel.completedThisMonth ?? 0} / {data?.funnel.sessionsThisMonth ?? 0} 세션</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Case status bar chart */}
          <div className="ops-panel">
            <div className="ops-panel-header"><h3 className="ops-panel-title">케이스 상태 분포</h3></div>
            <div className="ops-panel-body">
              {statusEntries.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {statusEntries.map(([status, count]) => {
                    const pct = totalByStatus > 0 ? (count / totalByStatus) * 100 : 0;
                    return (
                      <div key={status}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>
                            {statusLabel(status)}
                          </span>
                          <span className="ops-mono" style={{ fontSize: 12, color: "var(--ops-text-muted)" }}>
                            {count} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: "var(--ops-surface-active)", overflow: "hidden" }}>
                          <div
                            style={{
                              height: 6,
                              borderRadius: 3,
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
                <div style={{ color: "var(--ops-text-muted)", textAlign: "center", padding: 20, fontSize: 12 }}>데이터가 없습니다.</div>
              )}
            </div>
          </div>

          {/* Recent cases table */}
          <div className="ops-panel">
            <div className="ops-panel-header">
              <h3 className="ops-panel-title">최근 케이스</h3>
              {data && <span className="ops-badge ops-badge-brand">{data.cases.recent.length}</span>}
            </div>
            <div className="ops-table-wrap">
              <table className="ops-table">
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
                        <td className="ops-mono" style={{ fontSize: 11 }}>{c.id.slice(0, 12)}</td>
                        <td>
                          <span className={`ops-badge ${STATUS_VARIANT[c.status] || "ops-badge-neutral"}`}>
                            {statusLabel(c.status)}
                          </span>
                        </td>
                        <td className="ops-mono" style={{ fontSize: 11, color: "var(--ops-text-muted)" }}>{c.partnerId ? c.partnerId.slice(0, 10) + "…" : "-"}</td>
                        <td className="ops-mono" style={{ fontSize: 11, color: "var(--ops-text-muted)" }}>
                          {formatDate(c.createdAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "var(--ops-text-muted)" }}>
                        케이스가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Revenue summary card */}
          <div className="ops-panel">
            <div className="ops-panel-header"><h3 className="ops-panel-title">매출 현황</h3></div>
            <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "총 매출", value: data?.payments.totalRevenue ?? 0, accent: false },
                { label: "이번달", value: data?.payments.thisMonthRevenue ?? 0, accent: true },
                { label: "지난달", value: data?.payments.lastMonthRevenue ?? 0, accent: false },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--ops-border)" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>{row.label}</span>
                  <span
                    className="ops-mono"
                    style={{
                      fontSize: row.accent ? 16 : 13,
                      fontWeight: row.accent ? 700 : 500,
                      color: row.accent ? "var(--ops-text)" : "var(--ops-text-muted)",
                    }}
                  >
                    {data ? formatKRW(row.value) : "-"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent payments table */}
          <div className="ops-panel">
            <div className="ops-panel-header">
              <h3 className="ops-panel-title">최근 결제</h3>
              {data && <span className="ops-badge ops-badge-brand">{data.payments.recent.length}</span>}
            </div>
            <div className="ops-table-wrap">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>금액</th>
                    <th>상태</th>
                    <th>수단</th>
                    <th>일자</th>
                  </tr>
                </thead>
                <tbody>
                  {data && data.payments.recent.length > 0 ? (
                    data.payments.recent.slice(0, 10).map((p) => (
                      <tr key={p.id}>
                        <td className="ops-mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text)" }}>
                          {data ? formatKRW(p.amount) : "-"}
                        </td>
                        <td>
                          <span className={`ops-badge ${PAYMENT_STATUS_VARIANT[p.status] || "ops-badge-neutral"}`}>
                            {paymentStatusLabel(p.status)}
                          </span>
                        </td>
                        <td className="ops-mono" style={{ fontSize: 11, color: "var(--ops-text-muted)" }}>{p.provider || "-"}</td>
                        <td className="ops-mono" style={{ fontSize: 11, color: "var(--ops-text-muted)" }}>
                          {formatDate(p.createdAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "var(--ops-text-muted)" }}>
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
    </div>
  );
}
