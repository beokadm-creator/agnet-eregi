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
  if (status === "unhealthy") return "ops-badge-danger";
  if (status === "degraded") return "ops-badge-warning";
  return "ops-badge-success";
}

const COLLECTIONS = ["ops_audit_events", "ops_retry_jobs", "ops_alert_jobs"] as const;

export default function System() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupResult, setBackupResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [queryHealth, setQueryHealth] = useState<QueryHealthIssue[]>([]);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
  const [selectedCollection, setSelectedCollection] = useState<string>(COLLECTIONS[0]);
  const [retentionPreview, setRetentionPreview] = useState<RetentionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [retentionRunning, setRetentionRunning] = useState(false);
  const [retentionResult, setRetentionResult] = useState<RetentionResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchPageData = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const baseUrl = getApiBaseUrl();
      const results = await Promise.allSettled([
        fetch(`${baseUrl}/v1/ops/backup/status`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
        fetch(`${baseUrl}/v1/ops/query-health?limit=50`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
      ]);
      setBackupStatus(results[0].status === "fulfilled" ? results[0].value.data?.status ?? null : null);
      setQueryHealth(results[1].status === "fulfilled" ? results[1].value.data?.items ?? [] : []);
    } catch (e) { setError(e instanceof Error ? e.message : "데이터를 불러올 수 없습니다."); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchPageData(); }, [fetchPageData]);

  const triggerBackup = useCallback(async () => {
    setBackupRunning(true); setBackupResult(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/backup/trigger`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      const json = await res.json();
      if (json.ok) { setBackupResult({ ok: true, message: "백업이 완료되었습니다." }); fetchPageData(); }
      else { setBackupResult({ ok: false, message: json.error?.message || "백업 실패" }); }
    } catch (e) { setBackupResult({ ok: false, message: e instanceof Error ? e.message : "요청 실패" }); } finally { setBackupRunning(false); }
  }, [token, fetchPageData]);

  const resolveIssue = useCallback(async (id: string) => {
    setResolvingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/query-health/${id}/resolve`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      const json = await res.json();
      if (json.ok) setQueryHealth((prev) => prev.map((q) => (q.id === id ? { ...q, status: "resolved" } : q)));
    } catch {} finally { setResolvingIds((prev) => { const next = new Set(prev); next.delete(id); return next; }); }
  }, [token]);

  const fetchRetentionPreview = useCallback(async () => {
    setPreviewLoading(true); setRetentionResult(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/retention/preview?collection=${selectedCollection}&limit=20`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setRetentionPreview(json.ok ? json.data : null);
    } catch { setRetentionPreview(null); } finally { setPreviewLoading(false); }
  }, [token, selectedCollection]);

  const runRetention = useCallback(async () => {
    setRetentionRunning(true); setRetentionResult(null); setShowConfirm(false);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/retention/run`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ dryRun }) });
      const json = await res.json();
      if (json.ok) setRetentionResult(json.data);
    } catch {} finally { setRetentionRunning(false); }
  }, [token, dryRun]);

  const unresolvedQueries = queryHealth.filter((q) => q.status !== "resolved" && q.status !== "RESOLVED");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="ops-title">시스템 관리</h1>
          <p className="ops-subtitle">백업, 쿼리 헬스, 데이터 보관 정책 관리</p>
        </div>
        <button className="ops-btn" onClick={fetchPageData} disabled={loading}>{loading ? "불러오는 중..." : "↻ 새로고침"}</button>
      </div>

      {error && <div style={{ padding: "12px 16px", background: "var(--ops-danger-soft)", color: "var(--ops-danger)", borderRadius: "var(--ops-radius)", fontSize: 13 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
        <div className="ops-panel">
          <div className="ops-panel-header">
            <h2 className="ops-panel-title">백업 상태</h2>
          </div>
          <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {backupStatus ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ops-text-muted)" }}>상태</span>
                  <span className={`ops-badge ${backupStatus.status === "SUCCESS" ? "ops-badge-success" : "ops-badge-warning"}`}>{backupStatus.status}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ops-text-muted)" }}>마지막 백업</span>
                  <span className="ops-mono">{formatTimestamp(backupStatus.lastBackupAt)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ops-text-muted)" }}>누적 백업</span>
                  <span className="ops-mono">{backupStatus.backupCount}건</span>
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--ops-text-muted)", fontSize: 12 }}>데이터를 불러올 수 없습니다.</div>
            )}
            
            <div style={{ borderTop: "1px solid var(--ops-border)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="ops-btn ops-btn-brand" disabled={backupRunning} onClick={triggerBackup} style={{ width: "100%" }}>수동 백업 실행</button>
              {backupRunning && <div style={{ fontSize: 12, color: "var(--ops-text-muted)", textAlign: "center" }}>실행 중...</div>}
              {backupResult && !backupRunning && (
                <div style={{ fontSize: 12, color: backupResult.ok ? "var(--ops-success)" : "var(--ops-danger)", textAlign: "center" }}>
                  {backupResult.message}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ops-panel">
          <div className="ops-panel-header">
            <h2 className="ops-panel-title">쿼리 헬스</h2>
            <span className={`ops-badge ${unresolvedQueries.length > 0 ? "ops-badge-warning" : "ops-badge-success"}`}>{unresolvedQueries.length}</span>
          </div>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>게이트</th>
                  <th>쿼리 이름</th>
                  <th>실패</th>
                  <th>상태</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {unresolvedQueries.length > 0 ? (
                  unresolvedQueries.map((q) => (
                    <tr key={q.id}>
                      <td className="ops-mono" style={{ fontSize: 11 }}>{q.gateKey}</td>
                      <td style={{ fontSize: 12 }}>{q.queryName}</td>
                      <td className="ops-mono" style={{ fontSize: 12, color: "var(--ops-danger)" }}>{q.failCount}</td>
                      <td><span className={`ops-badge ${queryHealthBadge(q.status)}`}>{q.status}</span></td>
                      <td>
                        <button className="ops-btn" disabled={resolvingIds.has(q.id)} onClick={() => resolveIssue(q.id)}>
                          {resolvingIds.has(q.id) ? "처리 중" : "해결 기록"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--ops-text-muted)" }}>
                      모든 쿼리가 정상 작동 중입니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="ops-panel">
        <div className="ops-panel-header">
          <h2 className="ops-panel-title">데이터 보관 정책 (Retention)</h2>
        </div>
        <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <select className="ops-input" style={{ width: 250 }} value={selectedCollection} onChange={(e) => setSelectedCollection(e.target.value)}>
              {COLLECTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="ops-btn" disabled={previewLoading} onClick={fetchRetentionPreview}>미리보기</button>
          </div>

          {retentionPreview && (
            <div style={{ border: "1px solid var(--ops-border)", borderRadius: "var(--ops-radius-sm)", overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", background: "var(--ops-surface-hover)", borderBottom: "1px solid var(--ops-border)", fontSize: 12, color: "var(--ops-text-muted)" }}>
                삭제 대상 (상위 10건) — 총 <span style={{ color: "var(--ops-text)", fontWeight: 600 }}>{retentionPreview.totalCandidates}</span>건
              </div>
              <table className="ops-table">
                <thead><tr><th>ID</th><th>생성일</th><th>경과일</th></tr></thead>
                <tbody>
                  {retentionPreview.items.slice(0, 10).map((item) => (
                    <tr key={item.id}>
                      <td className="ops-mono">{item.id}</td>
                      <td className="ops-mono" style={{ color: "var(--ops-text-muted)" }}>{formatTimestamp(item.createdAt)}</td>
                      <td>{formatAge(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <div style={{ display: "flex", background: "var(--ops-bg)", border: "1px solid var(--ops-border)", borderRadius: "var(--ops-radius-sm)", overflow: "hidden" }}>
              <button className={`ops-btn ${dryRun ? "ops-btn-brand" : ""}`} style={{ border: "none", borderRadius: 0 }} onClick={() => setDryRun(true)}>드라이런</button>
              <button className={`ops-btn ${!dryRun ? "ops-btn-danger" : ""}`} style={{ border: "none", borderRadius: 0 }} onClick={() => setDryRun(false)}>실제 실행</button>
            </div>
            <button className={`ops-btn ${!dryRun ? "ops-btn-danger" : "ops-btn-brand"}`} disabled={retentionRunning} onClick={() => dryRun ? runRetention() : setShowConfirm(true)}>
              {retentionRunning ? "실행 중..." : (dryRun ? "테스트 실행" : "삭제 승인")}
            </button>
          </div>

          {showConfirm && (
            <div style={{ padding: 12, background: "var(--ops-danger-soft)", border: "1px solid var(--ops-danger)", borderRadius: "var(--ops-radius-sm)", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: "var(--ops-danger)", fontSize: 13, fontWeight: 600 }}>⚠️ 실제 데이터를 삭제합니다. 이 작업은 되돌릴 수 없습니다.</span>
              <button className="ops-btn ops-btn-danger" onClick={runRetention}>확인</button>
              <button className="ops-btn" onClick={() => setShowConfirm(false)}>취소</button>
            </div>
          )}

          {retentionResult && !retentionRunning && (
            <div style={{ padding: 12, background: "var(--ops-success-soft)", color: "var(--ops-success)", borderRadius: "var(--ops-radius-sm)", fontSize: 13, fontWeight: 600 }}>
              {retentionResult.dryRun ? "드라이런 완료" : "삭제 완료"}: {retentionResult.deleted}건 {retentionResult.dryRun && "(시뮬레이션)"} — {retentionResult.collection}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
