import { useState, useEffect, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

// --- Types ---

interface RiskMetrics {
  criticalIncidents24h: number;
  warnIncidents24h: number;
  totalIncidents24h: number;
}

interface RiskSummary {
  riskLevel: "Low" | "Medium" | "High";
  metrics: RiskMetrics;
  evaluatedAt: string;
}

interface Incident {
  id: string;
  gateKey: string;
  summary: string;
  severity: string;
  status: string;
  startAt: string | { _seconds: number; _nanoseconds: number };
  counters?: Record<string, number>;
}

interface BackupStatus {
  lastBackupAt: string | { _seconds: number; _nanoseconds: number };
  status: string;
  backupCount: number;
}

interface QueryHealthIssue {
  id: string;
  gateKey: string;
  queryName: string;
  status: string;
  failCount: number;
  lastFailedAt: string | { _seconds: number; _nanoseconds: number };
}

interface DashboardData {
  riskSummary: RiskSummary | null;
  incidents: Incident[];
  backupStatus: BackupStatus | null;
  queryHealth: QueryHealthIssue[];
}

interface ActionResult {
  key: string;
  label: string;
  ok: boolean;
  message: string;
  at: number;
}

// --- Constants ---

const RISK_BADGES: Record<string, string> = {
  Low: "ar-badge-success",
  Medium: "ar-badge-warning",
  High: "ar-badge-danger",
};

const RISK_LABELS: Record<string, string> = {
  Low: "안전",
  Medium: "주의",
  High: "위험",
};

const SEVERITY_BADGES: Record<string, string> = {
  critical: "ar-badge-danger",
  warn: "ar-badge-warning",
  info: "ar-badge-info",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "심각",
  warn: "경고",
  info: "정보",
};

const INCIDENT_STATUS_BADGES: Record<string, string> = {
  ACTIVE: "ar-badge-danger",
  INVESTIGATING: "ar-badge-warning",
  MITIGATING: "ar-badge-info",
  CLOSED: "ar-badge-neutral",
  RESOLVED: "ar-badge-success",
};

interface FeatureCard {
  id: string;
  emoji: string;
  name: string;
  description: string;
  route?: string;
  group: "A" | "B";
}

const FEATURE_CARDS: FeatureCard[] = [
  // Group A — has dedicated page
  { id: "observability", emoji: "📈", name: "관측 (Observability)", description: "일일 메트릭, 알림 품질 지표를 조회합니다", route: "/observability", group: "A" },
  { id: "sla", emoji: "📊", name: "SLO 대시보드", description: "서비스 수준 목표 및 번레이트를 모니터링합니다", route: "/sla-dashboard", group: "A" },
  { id: "case-packs", emoji: "📋", name: "Case Packs", description: "사건 팩 템플릿을 생성하고 관리합니다", route: "/case-packs", group: "A" },
  { id: "access", emoji: "🔐", name: "접근 제어", description: "운영자 권한 및 역할을 관리합니다", route: "/access", group: "A" },
  { id: "review-queue", emoji: "📝", name: "리뷰 큐", description: "검토 대기 중인 건을 확인합니다", route: "/review-queue", group: "A" },
  { id: "audit-logs", emoji: "📜", name: "감사 로그", description: "모든 운영 이벤트 기록을 조회합니다", route: "/audit-logs", group: "A" },
  // Group B — no dedicated page
  { id: "incidents", emoji: "🚨", name: "인시던트 관리", description: "장애 자동 감지, 플레이북 실행, 장애 이력 관리", group: "B" },
  { id: "circuit-breaker", emoji: "🛡️", name: "서킷 브레이커", description: "API 장애 시 자동 차단, 수동 리셋", group: "B" },
  { id: "risk", emoji: "⚠️", name: "리스크 관리", description: "리스크 평가 및 완화 조치 실행", group: "B" },
  { id: "release", emoji: "🚀", name: "릴리즈 관리", description: "배포 전 사전 점검, 스모크 테스트", group: "B" },
  { id: "backup", emoji: "💾", name: "백업 관리", description: "Firestore 백업 상태 조회 및 수동 백업 실행", group: "B" },
  { id: "query-health", emoji: "🔍", name: "쿼리 헬스", description: "Firestore 쿼리 성능 이슈 감지 및 해결", group: "B" },
];

// --- Helpers ---

function formatTimestamp(ts: unknown): string {
  if (!ts) return "-";
  if (typeof ts === "string") return new Date(ts).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (typeof ts === "object" && ts !== null && "_seconds" in ts) return new Date((ts as { _seconds: number })._seconds * 1000).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  return "-";
}

function severityBadge(sev: string): string {
  return SEVERITY_BADGES[sev] || "ar-badge-neutral";
}

function severityLabel(sev: string): string {
  return SEVERITY_LABELS[sev] || sev;
}

function incidentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "활성",
    INVESTIGATING: "조사중",
    MITIGATING: "완화중",
    CLOSED: "종료",
    RESOLVED: "해결",
  };
  return map[status] || status;
}

function incidentStatusBadge(status: string): string {
  return INCIDENT_STATUS_BADGES[status] || "ar-badge-neutral";
}

// --- Component ---

export default function Dashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData>({
    riskSummary: null,
    incidents: [],
    backupStatus: null,
    queryHealth: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // --- Data Fetching ---

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = getApiBaseUrl();

      const results = await Promise.allSettled([
        fetch(`${baseUrl}/v1/ops/risk/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        fetch(`${baseUrl}/v1/ops/incidents?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        fetch(`${baseUrl}/v1/ops/backup/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        fetch(`${baseUrl}/v1/ops/query-health?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      ]);

      const riskResult = results[0];
      const incidentResult = results[1];
      const backupResult = results[2];
      const queryResult = results[3];

      setData({
        riskSummary: riskResult.status === "fulfilled" ? riskResult.value.data?.summary ?? null : null,
        incidents: incidentResult.status === "fulfilled" ? incidentResult.value.data?.items ?? [] : [],
        backupStatus: backupResult.status === "fulfilled" ? backupResult.value.data?.status ?? null : null,
        queryHealth: queryResult.status === "fulfilled" ? queryResult.value.data?.items ?? [] : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // --- Quick Actions ---

  const runAction = useCallback(
    async (key: string, label: string, method: string, path: string, body?: Record<string, unknown>) => {
      setActionRunning(true);
      setActionResult(null);
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json();
        if (json.ok) {
          setActionResult({ key, label, ok: true, message: json.data ? JSON.stringify(json.data) : "완료", at: Date.now() });
        fetchAll();
        } else {
          setActionResult({ key, label, ok: false, message: json.error?.messageKo || json.error?.message || "실패", at: Date.now() });
        }
      } catch (e) {
        setActionResult({ key, label, ok: false, message: e instanceof Error ? e.message : "요청 실패", at: Date.now() });
      } finally {
        setActionRunning(false);
      }
    },
    [token, fetchAll],
  );

  // --- Derived Data ---

  const activeIncidents = data.incidents.filter((i) => i.status !== "CLOSED");
  const unresolvedQueries = data.queryHealth.filter((q) => q.status !== "resolved" && q.status !== "RESOLVED");
  const circuitBreakerOpen = data.incidents.some((i) => i.summary?.toLowerCase().includes("circuit_breaker") && i.status !== "CLOSED");

  const recentIncidents = [...data.incidents]
    .sort((a, b) => {
      const aTime = typeof a.startAt === "string" ? new Date(a.startAt).getTime() : a.startAt?._seconds ? a.startAt._seconds * 1000 : 0;
      const bTime = typeof b.startAt === "string" ? new Date(b.startAt).getTime() : b.startAt?._seconds ? b.startAt._seconds * 1000 : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  // --- Inline Panel Data for Group B ---

  function getCardStatus(feature: FeatureCard): { text: string; badge: string } {
    switch (feature.id) {
      case "incidents":
        return { text: `${activeIncidents.length}건 활성`, badge: activeIncidents.length > 0 ? "ar-badge-warning" : "ar-badge-success" };
      case "circuit-breaker":
        return { text: circuitBreakerOpen ? "OPEN" : "CLOSED", badge: circuitBreakerOpen ? "ar-badge-danger" : "ar-badge-success" };
      case "risk":
        if (!data.riskSummary) return { text: "-", badge: "ar-badge-neutral" };
        return { text: RISK_LABELS[data.riskSummary.riskLevel] || data.riskSummary.riskLevel, badge: RISK_BADGES[data.riskSummary.riskLevel] || "ar-badge-neutral" };
      case "release":
        return { text: "준비됨", badge: "ar-badge-success" };
      case "backup":
        if (!data.backupStatus) return { text: "-", badge: "ar-badge-neutral" };
        return { text: data.backupStatus.status, badge: data.backupStatus.status === "SUCCESS" ? "ar-badge-success" : "ar-badge-warning" };
      case "query-health":
        return { text: `${unresolvedQueries.length}건 이슈`, badge: unresolvedQueries.length > 0 ? "ar-badge-warning" : "ar-badge-success" };
      default:
        return { text: "-", badge: "ar-badge-neutral" };
    }
  }

  function renderExpandedPanel(feature: FeatureCard) {
    if (feature.id === "incidents") {
      return (
        <div style={{ marginTop: 12 }}>
          <table className="ar-table">
            <thead>
              <tr>
                <th>게이트</th>
                <th>내용</th>
                <th>심각도</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {activeIncidents.length > 0 ? (
                activeIncidents.slice(0, 10).map((inc) => (
                  <tr key={inc.id}>
                    <td className="ar-mono" style={{ fontSize: 12 }}>{inc.gateKey}</td>
                    <td style={{ fontSize: 13 }}>{inc.summary || inc.id}</td>
                    <td>
                      <span className={`ar-badge ${severityBadge(inc.severity)}`}>
                        {severityLabel(inc.severity)}
                      </span>
                    </td>
                    <td>
                      <span className={`ar-badge ${incidentStatusBadge(inc.status)}`}>
                        {incidentStatusLabel(inc.status)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "24px", color: "var(--ar-slate)" }}>
                    활성 인시던트가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ marginTop: 12 }}>
            <button
              className="ar-btn ar-btn-sm ar-btn-soft"
              disabled={actionRunning}
              onClick={() => runAction("incidents-rebuild", "인시던트 재빌드", "POST", "/v1/ops/incidents/rebuild")}
            >
              인시던트 재빌드
            </button>
          </div>
        </div>
      );
    }

    if (feature.id === "circuit-breaker") {
      return (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, color: "var(--ar-graphite)" }}>
            현재 상태: <span className={`ar-badge ${circuitBreakerOpen ? "ar-badge-danger" : "ar-badge-success"}`}>{circuitBreakerOpen ? "OPEN" : "CLOSED"}</span>
          </div>
          {data.incidents.filter((i) => i.summary?.toLowerCase().includes("circuit_breaker")).length > 0 ? (
            <div style={{ fontSize: 12, color: "var(--ar-slate)" }}>
              서킷 브레이커 관련 이벤트가 감지되었습니다.
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--ar-slate)" }}>
              서킷 브레이커 이벤트가 없습니다.
            </div>
          )}
        </div>
      );
    }

    if (feature.id === "risk") {
      return (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {data.riskSummary ? (
            <>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <span style={{ fontSize: 12, color: "var(--ar-slate)" }}>리스크 수준: </span>
                  <span className={`ar-badge ${RISK_BADGES[data.riskSummary.riskLevel]}`}>
                    {RISK_LABELS[data.riskSummary.riskLevel]}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--ar-slate)" }}>
                심각 {data.riskSummary.metrics.criticalIncidents24h}건 / 경고 {data.riskSummary.metrics.warnIncidents24h}건 (24h)
              </div>
              <button
                className="ar-btn ar-btn-sm ar-btn-soft"
                disabled={actionRunning}
                onClick={() => runAction("risk-mitigate", "리스크 완화", "POST", `/v1/ops/risk/default/mitigate`, { actionKey: "circuit_breaker_reset" })}
              >
                서킷 브레이커 리셋
              </button>
            </>
          ) : (
            <div style={{ fontSize: 13, color: "var(--ar-slate)" }}>리스크 데이터를 불러올 수 없습니다.</div>
          )}
        </div>
      );
    }

    if (feature.id === "release") {
      return (
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button
            className="ar-btn ar-btn-sm ar-btn-ghost"
            disabled={actionRunning}
            onClick={() => runAction("preflight", "배포 전 점검", "POST", "/v1/ops/preflight", {})}
          >
            배포 전 점검 (Preflight)
          </button>
          <button
            className="ar-btn ar-btn-sm ar-btn-ghost"
            disabled={actionRunning}
            onClick={() => runAction("smoke-test", "스모크 테스트", "POST", "/v1/ops/smoke-test", { mode: "read_only" })}
          >
            스모크 테스트
          </button>
        </div>
      );
    }

    if (feature.id === "backup") {
      return (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {data.backupStatus ? (
            <>
              <div style={{ fontSize: 13, color: "var(--ar-graphite)" }}>
                마지막 백업: <span className="ar-mono">{formatTimestamp(data.backupStatus.lastBackupAt)}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--ar-graphite)" }}>
                누적 백업: <span className="ar-tabular">{data.backupStatus.backupCount}</span>건
              </div>
              <div style={{ fontSize: 13, color: "var(--ar-graphite)" }}>
                상태: <span className={`ar-badge ${data.backupStatus.status === "SUCCESS" ? "ar-badge-success" : "ar-badge-warning"}`}>{data.backupStatus.status}</span>
              </div>
              <button
                className="ar-btn ar-btn-sm ar-btn-soft"
                disabled={actionRunning}
                onClick={() => runAction("backup-trigger", "백업 실행", "POST", "/v1/ops/backup/trigger")}
              >
                수동 백업 실행
              </button>
            </>
          ) : (
            <div style={{ fontSize: 13, color: "var(--ar-slate)" }}>백업 데이터를 불러올 수 없습니다.</div>
          )}
        </div>
      );
    }

    if (feature.id === "query-health") {
      return (
        <div style={{ marginTop: 12 }}>
          {unresolvedQueries.length > 0 ? (
            <table className="ar-table">
              <thead>
                <tr>
                  <th>게이트</th>
                  <th>쿼리</th>
                  <th>실패</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {unresolvedQueries.map((q) => (
                  <tr key={q.id}>
                    <td className="ar-mono" style={{ fontSize: 12 }}>{q.gateKey}</td>
                    <td style={{ fontSize: 13 }}>{q.queryName}</td>
                    <td className="ar-tabular" style={{ fontSize: 13 }}>{q.failCount}</td>
                    <td>
                      <span className="ar-badge ar-badge-warning">{q.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 13, color: "var(--ar-slate)" }}>해결되지 않은 쿼리 이슈가 없습니다.</div>
          )}
        </div>
      );
    }

    return null;
  }

  // --- Render ---

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            운영 관리
          </h1>
          <div className="ar-eyebrow" style={{ marginTop: 6, marginBottom: 0 }}>
            플랫폼 운영 허브 — 시스템 상태 및 기능 접근
          </div>
        </div>
        <button className="ar-btn ar-btn-sm ar-btn-ink" onClick={fetchAll} disabled={loading}>
          {loading ? "불러오는 중..." : "새로고침"}
        </button>
      </div>

      {error && (
        <div style={{ color: "var(--ar-danger)", fontSize: 13, padding: "12px 16px", background: "var(--ar-danger-soft)", borderRadius: "var(--ar-r1)" }}>
          {error}
        </div>
      )}

      {/* Section 1 — System Health Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {/* 리스크 수준 */}
        <div className="ar-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>리스크 수준</span>
          </div>
          {data.riskSummary ? (
            <>
              <span className={`ar-badge ${RISK_BADGES[data.riskSummary.riskLevel]}`} style={{ fontSize: 14, padding: "6px 14px" }}>
                {RISK_LABELS[data.riskSummary.riskLevel]}
              </span>
              <div style={{ fontSize: 11, color: "var(--ar-slate)", marginTop: 10 }}>
                24h: 심각 {data.riskSummary.metrics.criticalIncidents24h} / 경고 {data.riskSummary.metrics.warnIncidents24h}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: "var(--ar-fog)", fontWeight: 700 }}>-</div>
          )}
        </div>

        {/* 활성 인시던트 */}
        <div className="ar-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>활성 인시던트</span>
          </div>
          <div className="ar-tabular" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {loading ? "-" : activeIncidents.length}
          </div>
          <div style={{ fontSize: 11, color: "var(--ar-slate)", marginTop: 8 }}>
            전체 {data.incidents.length}건 중 미종료
          </div>
        </div>

        {/* 백업 상태 */}
        <div className="ar-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>💾</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>백업 상태</span>
          </div>
          {data.backupStatus ? (
            <>
              <span className={`ar-badge ${data.backupStatus.status === "SUCCESS" ? "ar-badge-success" : "ar-badge-warning"}`}>
                {data.backupStatus.status}
              </span>
              <div style={{ fontSize: 11, color: "var(--ar-slate)", marginTop: 10 }}>
                마지막: {formatTimestamp(data.backupStatus.lastBackupAt)} · {data.backupStatus.backupCount}건 누적
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: "var(--ar-fog)", fontWeight: 700 }}>-</div>
          )}
        </div>

        {/* 쿼리 헬스 */}
        <div className="ar-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🔍</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ar-slate)" }}>쿼리 헬스</span>
          </div>
          <div className="ar-tabular" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {loading ? "-" : unresolvedQueries.length}
          </div>
          <div style={{ fontSize: 11, color: "var(--ar-slate)", marginTop: 8 }}>
            미해결 쿼리 이슈
          </div>
        </div>
      </div>

      {/* Section 2 — Feature Directory */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 14px" }}>기능 디렉토리</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {FEATURE_CARDS.map((feature) => {
            const status = getCardStatus(feature);
            const isExpanded = expandedCard === feature.id;
            const card = (
              <div
                key={feature.id}
                className="ar-card"
                style={{
                  padding: 20,
                  cursor: feature.group === "B" ? "pointer" : undefined,
                  transition: "box-shadow 0.15s ease",
                  borderBottomLeftRadius: isExpanded ? 0 : undefined,
                  borderBottomRightRadius: isExpanded ? 0 : undefined,
                  borderBottom: isExpanded ? "none" : undefined,
                }}
                onClick={feature.group === "B" ? () => setExpandedCard(isExpanded ? null : feature.id) : undefined}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 24 }}>{feature.emoji}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{feature.name}</div>
                      <div style={{ fontSize: 12, color: "var(--ar-slate)", marginTop: 2 }}>{feature.description}</div>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {feature.group === "A" ? (
                      <span className="ar-badge ar-badge-info" style={{ fontSize: 11 }}>페이지 이동 →</span>
                    ) : (
                      <span className={`ar-badge ${status.badge}`}>{status.text}</span>
                    )}
                  </div>
                </div>
              </div>
            );

            return (
              <div key={feature.id}>
                {feature.group === "A" ? (
                  <NavLink to={feature.route!} style={{ textDecoration: "none", color: "inherit" }}>
                    {card}
                  </NavLink>
                ) : (
                  card
                )}
                {isExpanded && feature.group === "B" && (
                  <div className="ar-card" style={{ padding: 20, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: "1px solid var(--ar-hairline)" }}>
                    {renderExpandedPanel(feature)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3 — Recent Incidents */}
      <div className="ar-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ar-hairline)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>최근 인시던트</h3>
          <span className="ar-badge ar-badge-accent">{recentIncidents.length}</span>
        </div>
        <table className="ar-table">
          <thead>
            <tr>
              <th>Gate</th>
              <th>내용</th>
              <th>심각도</th>
              <th>상태</th>
              <th>발생시간</th>
            </tr>
          </thead>
          <tbody>
            {recentIncidents.length > 0 ? (
              recentIncidents.map((inc) => (
                <tr key={inc.id}>
                  <td className="ar-mono" style={{ fontSize: 12 }}>{inc.gateKey}</td>
                  <td style={{ fontSize: 13, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {inc.summary || inc.id}
                  </td>
                  <td>
                    <span className={`ar-badge ${severityBadge(inc.severity)}`}>
                      {severityLabel(inc.severity)}
                    </span>
                  </td>
                  <td>
                    <span className={`ar-badge ${incidentStatusBadge(inc.status)}`}>
                      {incidentStatusLabel(inc.status)}
                    </span>
                  </td>
                  <td className="ar-tabular" style={{ fontSize: 12, color: "var(--ar-slate)" }}>
                    {formatTimestamp(inc.startAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--ar-slate)" }}>
                  {loading ? "불러오는 중..." : "인시던트가 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Section 4 — Quick Actions */}
      <div className="ar-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>빠른 실행</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            className="ar-btn ar-btn-sm ar-btn-ghost"
            disabled={actionRunning}
            onClick={() => runAction("preflight", "배포 전 점검", "POST", "/v1/ops/preflight", {})}
          >
            🚀 배포 전 점검
          </button>
          <button
            className="ar-btn ar-btn-sm ar-btn-ghost"
            disabled={actionRunning}
            onClick={() => runAction("smoke-test", "스모크 테스트", "POST", "/v1/ops/smoke-test", { mode: "read_only" })}
          >
            🧪 스모크 테스트
          </button>
          <button
            className="ar-btn ar-btn-sm ar-btn-ghost"
            disabled={actionRunning}
            onClick={() => runAction("backup-trigger", "백업 실행", "POST", "/v1/ops/backup/trigger")}
          >
            💾 백업 실행
          </button>
          <button
            className="ar-btn ar-btn-sm ar-btn-ghost"
            disabled={actionRunning}
            onClick={() => runAction("metrics-regen", "메트릭 재생성", "POST", "/v1/ops/metrics/rebuild", {})}
          >
            📈 메트릭 재생성
          </button>
          <button
            className="ar-btn ar-btn-sm ar-btn-soft"
            disabled={actionRunning}
            onClick={() => runAction("incidents-rebuild", "인시던트 재빌드", "POST", "/v1/ops/incidents/rebuild")}
          >
            🔄 인시던트 재빌드
          </button>
        </div>

        {/* Action Result */}
        {actionResult && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: "var(--ar-r1)",
              background: actionResult.ok ? "var(--ar-success-soft)" : "var(--ar-danger-soft)",
              color: actionResult.ok ? "var(--ar-success)" : "var(--ar-danger)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {actionResult.ok ? "✅" : "❌"} {actionResult.label}:{" "}
            <span style={{ fontWeight: 500 }}>{actionResult.message}</span>
          </div>
        )}
        {actionRunning && !actionResult && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: "var(--ar-r1)",
              background: "var(--ar-info-soft)",
              color: "var(--ar-info)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ⏳ 실행 중...
          </div>
        )}
      </div>
    </div>
  );
}
