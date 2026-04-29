import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

// --- Types ---

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

interface RetentionPreviewItem {
  id: string;
  createdAt: string | { _seconds: number; _nanoseconds: number };
}

interface RetentionPreview {
  items: RetentionPreviewItem[];
  totalCandidates: number;
  collection: string;
}

interface RetentionResult {
  deleted: number;
  dryRun: boolean;
  collection: string;
}

// --- Helpers ---

function formatTimestamp(ts: unknown): string {
  if (!ts) return "-";
  if (typeof ts === "string") return new Date(ts).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (typeof ts === "object" && ts !== null && "_seconds" in ts) return new Date((ts as { _seconds: number })._seconds * 1000).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  return "-";
}

function formatAge(ts: unknown): string {
  if (!ts) return "-";
  let ms: number;
  if (typeof ts === "string") ms = Date.now() - new Date(ts).getTime();
  else if (typeof ts === "object" && ts !== null && "_seconds" in ts) ms = Date.now() - (ts as { _seconds: number })._seconds * 1000;
  else return "-";
  const days = Math.floor(ms / 86400000);
  if (days < 1) return "< 1일";
  return `${days}일`;
}

function queryHealthBadge(status: string): string {
  if (status === "unhealthy") return "ar-badge-danger";
  if (status === "degraded") return "ar-badge-warning";
  return "ar-badge-success";
}

const COLLECTIONS = ["ops_audit_events", "ops_retry_jobs", "ops_alert_jobs"] as const;

// --- Component ---

export default function System() {
  const { token } = useAuth();

  // Page-level state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Backup state
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupResult, setBackupResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Query health state
  const [queryHealth, setQueryHealth] = useState<QueryHealthIssue[]>([]);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());

  // Retention state
  const [selectedCollection, setSelectedCollection] = useState<string>(COLLECTIONS[0]);
  const [retentionPreview, setRetentionPreview] = useState<RetentionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [retentionRunning, setRetentionRunning] = useState(false);
  const [retentionResult, setRetentionResult] = useState<RetentionResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // --- Data Fetching (page load) ---

  const fetchPageData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = getApiBaseUrl();

      const results = await Promise.allSettled([
        fetch(`${baseUrl}/v1/ops/backup/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        fetch(`${baseUrl}/v1/ops/query-health?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      ]);

      setBackupStatus(results[0].status === "fulfilled" ? results[0].value.data?.status ?? null : null);
      setQueryHealth(results[1].status === "fulfilled" ? results[1].value.data?.items ?? [] : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  // --- Backup Trigger ---

  const triggerBackup = useCallback(async () => {
    setBackupRunning(true);
    setBackupResult(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/backup/trigger`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.ok) {
        setBackupResult({ ok: true, message: "백업이 완료되었습니다." });
        fetchPageData();
      } else {
        setBackupResult({ ok: false, message: json.error?.message || "백업 실패" });
      }
    } catch (e) {
      setBackupResult({ ok: false, message: e instanceof Error ? e.message : "요청 실패" });
    } finally {
      setBackupRunning(false);
    }
  }, [token, fetchPageData]);

  // --- Resolve Query Health ---

  const resolveIssue = useCallback(async (id: string) => {
    setResolvingIds((prev) => new Set(prev).add(id));
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/query-health/${id}/resolve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.ok) {
        setQueryHealth((prev) => prev.map((q) => (q.id === id ? { ...q, status: "resolved" } : q)));
      }
    } catch {
      // silently fail — the row stays
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [token]);

  // --- Retention Preview ---

  const fetchRetentionPreview = useCallback(async () => {
    setPreviewLoading(true);
    setRetentionResult(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/retention/preview?collection=${selectedCollection}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) {
        setRetentionPreview(json.data);
      } else {
        setRetentionPreview(null);
      }
    } catch {
      setRetentionPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [token, selectedCollection]);

  // --- Retention Run ---

  const runRetention = useCallback(async () => {
    setRetentionRunning(true);
    setRetentionResult(null);
    setShowConfirm(false);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/retention/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const json = await res.json();
      if (json.ok) {
        setRetentionResult(json.data);
      }
    } catch {
      // silent fail
    } finally {
      setRetentionRunning(false);
    }
  }, [token, dryRun]);

  const handleRetentionClick = useCallback(() => {
    if (!dryRun) {
      setShowConfirm(true);
    } else {
      runRetention();
    }
  }, [dryRun, runRetention]);

  // --- Derived ---

  const unresolvedQueries = queryHealth.filter((q) => q.status !== "resolved" && q.status !== "RESOLVED");

  // --- Render ---

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            시스템 관리
          </h1>
          <div className="ar-eyebrow" style={{ marginTop: 6, marginBottom: 0 }}>
            백업, 쿼리 헬스, 데이터 보관 정책
          </div>
        </div>
        <button className="ar-btn ar-btn-sm ar-btn-ink" onClick={fetchPageData} disabled={loading}>
          {loading ? "불러오는 중..." : "새로고침"}
        </button>
      </div>

      {error && (
        <div style={{ color: "var(--ar-danger)", fontSize: 13, padding: "12px 16px", background: "var(--ar-danger-soft)", borderRadius: "var(--ar-r1)" }}>
          {error}
        </div>
      )}

      {/* Section 1 — Backup */}
      <div className="ar-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>
          💾 백업 관리
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Left: Status info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {backupStatus ? (
              <>
                <div style={{ fontSize: 13, color: "var(--ar-graphite)" }}>
                  상태:{" "}
                  <span className={`ar-badge ${backupStatus.status === "SUCCESS" ? "ar-badge-success" : "ar-badge-warning"}`}>
                    {backupStatus.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ar-graphite)" }}>
                  마지막 백업: <span className="ar-mono">{formatTimestamp(backupStatus.lastBackupAt)}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ar-graphite)" }}>
                  누적 백업: <span className="ar-tabular">{backupStatus.backupCount}</span>건
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "var(--ar-slate)" }}>
                {loading ? "불러오는 중..." : "백업 데이터를 불러올 수 없습니다."}
              </div>
            )}
          </div>
          {/* Right: Action */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
            <button
              className="ar-btn ar-btn-sm ar-btn-soft"
              disabled={backupRunning}
              onClick={triggerBackup}
            >
              수동 백업 실행
            </button>
            {backupRunning && (
              <div style={{ fontSize: 12, color: "var(--ar-info)", fontWeight: 600 }}>실행 중...</div>
            )}
            {backupResult && !backupRunning && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: backupResult.ok ? "var(--ar-success)" : "var(--ar-danger)",
                }}
              >
                {backupResult.ok ? "✅" : "❌"} {backupResult.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2 — Query Health */}
      <div className="ar-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ar-hairline)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🔍 쿼리 헬스</h3>
          <span className="ar-badge ar-badge-warning">{unresolvedQueries.length}</span>
        </div>
        <table className="ar-table">
          <thead>
            <tr>
              <th>게이트</th>
              <th>쿼리 이름</th>
              <th>실패 횟수</th>
              <th>상태</th>
              <th>마지막 실패</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {unresolvedQueries.length > 0 ? (
              unresolvedQueries.map((q) => (
                <tr key={q.id}>
                  <td className="ar-mono" style={{ fontSize: 12 }}>{q.gateKey}</td>
                  <td style={{ fontSize: 13 }}>{q.queryName}</td>
                  <td className="ar-tabular" style={{ fontSize: 13 }}>{q.failCount}</td>
                  <td>
                    <span className={`ar-badge ${queryHealthBadge(q.status)}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="ar-tabular" style={{ fontSize: 12, color: "var(--ar-slate)" }}>
                    {formatTimestamp(q.lastFailedAt)}
                  </td>
                  <td>
                    <button
                      className="ar-btn ar-btn-sm ar-btn-ghost"
                      disabled={resolvingIds.has(q.id)}
                      onClick={() => resolveIssue(q.id)}
                    >
                      {resolvingIds.has(q.id) ? "처리 중..." : "해결"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--ar-slate)" }}>
                  해결되지 않은 쿼리 이슈가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Section 3 — Data Retention */}
      <div className="ar-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>
          🗄️ 데이터 보관 정책
        </h3>

        {/* Controls row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <select
            className="ar-input ar-input-sm"
            style={{ width: 200 }}
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
          >
            {COLLECTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            className="ar-btn ar-btn-sm ar-btn-ghost"
            disabled={previewLoading}
            onClick={fetchRetentionPreview}
          >
            미리보기
          </button>
          {previewLoading && (
            <span style={{ fontSize: 12, color: "var(--ar-info)", fontWeight: 600 }}>불러오는 중...</span>
          )}
        </div>

        {/* Preview table */}
        {retentionPreview && (
          <div style={{ marginTop: 16 }}>
            <table className="ar-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Created</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {retentionPreview.items.slice(0, 10).map((item) => (
                  <tr key={item.id}>
                    <td className="ar-mono" style={{ fontSize: 12 }}>{item.id}</td>
                    <td className="ar-tabular" style={{ fontSize: 12, color: "var(--ar-slate)" }}>
                      {formatTimestamp(item.createdAt)}
                    </td>
                    <td style={{ fontSize: 13 }}>{formatAge(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--ar-graphite)", fontWeight: 600 }}>
              총 <span className="ar-tabular">{retentionPreview.totalCandidates}</span>건 삭제 대상
            </div>
          </div>
        )}

        {/* Dry-run toggle + execute */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className={`ar-btn ar-btn-sm ${dryRun ? "ar-btn-ink" : "ar-btn-ghost"}`}
            onClick={() => setDryRun(true)}
          >
            드라이런
          </button>
          <button
            className={`ar-btn ar-btn-sm ${!dryRun ? "ar-btn-ink" : "ar-btn-ghost"}`}
            onClick={() => setDryRun(false)}
          >
            실제 실행
          </button>
          <button
            className="ar-btn ar-btn-sm ar-btn-soft"
            disabled={retentionRunning}
            onClick={handleRetentionClick}
          >
            실행
          </button>
          {retentionRunning && (
            <span style={{ fontSize: 12, color: "var(--ar-info)", fontWeight: 600 }}>실행 중...</span>
          )}
        </div>

        {/* Confirmation dialog for actual run */}
        {showConfirm && (
          <div
            style={{
              marginTop: 12,
              padding: "14px 18px",
              borderRadius: "var(--ar-r1)",
              background: "var(--ar-danger-soft)",
              border: "1px solid var(--ar-danger)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ color: "var(--ar-danger)", fontWeight: 600 }}>
              ⚠️ 실제 삭제를 실행합니다. 이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?
            </span>
            <button className="ar-btn ar-btn-sm ar-btn-ink" onClick={runRetention}>확인</button>
            <button className="ar-btn ar-btn-sm ar-btn-ghost" onClick={() => setShowConfirm(false)}>취소</button>
          </div>
        )}

        {/* Retention result */}
        {retentionResult && !retentionRunning && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: "var(--ar-r1)",
              background: "var(--ar-success-soft)",
              color: "var(--ar-success)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ✅ {retentionResult.dryRun ? "드라이런 완료" : "삭제 완료"}:{" "}
            <span style={{ fontWeight: 500 }} className="ar-tabular">
              {retentionResult.deleted}건{retentionResult.dryRun ? " (시뮬레이션)" : ""}
            </span>
            {" "}— {retentionResult.collection}
          </div>
        )}
      </div>
    </div>
  );
}
