import { useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

// --- Types ---
interface PreflightCheck {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  message: string;
}
interface SmokeTestResult {
  name: string;
  status: "PASS" | "FAIL";
  latencyMs: number;
  message: string;
}
interface HistoryEntry {
  type: "preflight" | "smoke";
  at: number;
  passed: number;
  total: number;
}

export default function Release() {
  const { token } = useAuth();

  const [preflightGateKey, setPreflightGateKey] = useState("");
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightChecks, setPreflightChecks] = useState<PreflightCheck[]>([]);
  const [preflightError, setPreflightError] = useState<string | null>(null);

  const [smokeGateKey, setSmokeGateKey] = useState("");
  const [smokeMode, setSmokeMode] = useState<"read_only" | "full">("read_only");
  const [smokeLoading, setSmokeLoading] = useState(false);
  const [smokeResults, setSmokeResults] = useState<SmokeTestResult[]>([]);
  const [smokeError, setSmokeError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const runPreflight = useCallback(async () => {
    setPreflightLoading(true); setPreflightError(null);
    try {
      const body: Record<string, unknown> = {};
      if (preflightGateKey.trim()) body.gateKey = preflightGateKey.trim();
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/preflight`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.ok) {
        const checks: PreflightCheck[] = json.data?.checks ?? [];
        setPreflightChecks(checks);
        const passed = checks.filter((c: PreflightCheck) => c.status === "PASS").length;
        setHistory((prev) => [{ type: "preflight", at: Date.now(), passed, total: checks.length }, ...prev]);
      } else setPreflightError(json.error?.messageKo || json.error?.message || "실패");
    } catch (e) { setPreflightError("요청 실패"); } finally { setPreflightLoading(false); }
  }, [token, preflightGateKey]);

  const runSmokeTest = useCallback(async () => {
    setSmokeLoading(true); setSmokeError(null);
    try {
      const body: Record<string, unknown> = { mode: smokeMode };
      if (smokeGateKey.trim()) body.gateKey = smokeGateKey.trim();
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/smoke-test`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.ok) {
        const results: SmokeTestResult[] = json.data?.results ?? [];
        setSmokeResults(results);
        const passed = results.filter((r: SmokeTestResult) => r.status === "PASS").length;
        setHistory((prev) => [{ type: "smoke", at: Date.now(), passed, total: results.length }, ...prev]);
      } else setSmokeError(json.error?.messageKo || json.error?.message || "실패");
    } catch (e) { setSmokeError("요청 실패"); } finally { setSmokeLoading(false); }
  }, [token, smokeGateKey, smokeMode]);

  function preflightIcon(status: PreflightCheck["status"]): string {
    return status === "PASS" ? "✅" : status === "WARN" ? "⚠️" : "❌";
  }
  function smokeIcon(status: SmokeTestResult["status"]): string {
    return status === "PASS" ? "✅" : "❌";
  }
  function formatTime(at: number): string {
    return new Date(at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function preflightSummaryBadge(checks: PreflightCheck[]) {
    const passed = checks.filter((c) => c.status === "PASS").length;
    const total = checks.length;
    return <span className={`ops-badge ${passed === total ? "ops-badge-success" : "ops-badge-danger"}`}>{passed}/{total} 통과</span>;
  }
  function smokeSummaryBadge(results: SmokeTestResult[]) {
    const passed = results.filter((r) => r.status === "PASS").length;
    const total = results.length;
    return <span className={`ops-badge ${passed === total ? "ops-badge-success" : "ops-badge-danger"}`}>{passed}/{total} 통과</span>;
  }
  function historyResultBadge(entry: HistoryEntry) {
    return <span className={`ops-badge ${entry.passed === entry.total ? "ops-badge-success" : "ops-badge-danger"}`}>{entry.passed}/{entry.total} 통과</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 className="ops-title">릴리즈 관리</h1>
        <p className="ops-subtitle">배포 전 사전 점검 및 프로덕션 스모크 테스트를 실행합니다.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="ops-panel">
          <div className="ops-panel-header">
            <h2 className="ops-panel-title">배포 전 점검 (Preflight)</h2>
          </div>
          <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="ops-input" placeholder="gateKey (선택)" value={preflightGateKey} onChange={(e) => setPreflightGateKey(e.target.value)} />
              <button className="ops-btn ops-btn-brand" disabled={preflightLoading} onClick={runPreflight} style={{ width: 100 }}>{preflightLoading ? "실행 중" : "실행"}</button>
            </div>
            {preflightError && <div style={{ padding: 12, background: "var(--ops-danger-soft)", color: "var(--ops-danger)", borderRadius: "var(--ops-radius-sm)", fontSize: 13 }}>❌ {preflightError}</div>}
            
            {preflightChecks.length > 0 && (
              <div style={{ borderTop: "1px solid var(--ops-border)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {preflightChecks.map((check, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingBottom: 12, borderBottom: i < preflightChecks.length - 1 ? "1px solid var(--ops-border)" : undefined }}>
                    <span style={{ fontSize: 16 }}>{preflightIcon(check.status)}</span>
                    <div style={{ flex: 1 }}>
                      <div className="ops-mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text)" }}>{check.name}</div>
                      <div style={{ fontSize: 12, color: "var(--ops-text-muted)", marginTop: 4 }}>{check.message}</div>
                    </div>
                    <span className={`ops-badge ${check.status === "PASS" ? "ops-badge-success" : check.status === "WARN" ? "ops-badge-warning" : "ops-badge-danger"}`}>{check.status}</span>
                  </div>
                ))}
                <div style={{ marginTop: 8 }}>{preflightSummaryBadge(preflightChecks)}</div>
              </div>
            )}
          </div>
        </div>

        <div className="ops-panel">
          <div className="ops-panel-header">
            <h2 className="ops-panel-title">스모크 테스트 (Smoke Test)</h2>
          </div>
          <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 8, background: "var(--ops-surface-active)", padding: 4, borderRadius: "var(--ops-radius-sm)", width: "fit-content" }}>
              <button className={`ops-btn ${smokeMode === "read_only" ? "ops-btn-brand" : ""}`} style={{ border: "none", background: smokeMode === "read_only" ? undefined : "transparent" }} onClick={() => setSmokeMode("read_only")}>읽기 전용</button>
              <button className={`ops-btn ${smokeMode === "full" ? "ops-btn-brand" : ""}`} style={{ border: "none", background: smokeMode === "full" ? undefined : "transparent" }} onClick={() => setSmokeMode("full")}>전체 동작</button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="ops-input" placeholder="gateKey (선택)" value={smokeGateKey} onChange={(e) => setSmokeGateKey(e.target.value)} />
              <button className="ops-btn ops-btn-brand" disabled={smokeLoading} onClick={runSmokeTest} style={{ width: 100 }}>{smokeLoading ? "실행 중" : "실행"}</button>
            </div>
            {smokeError && <div style={{ padding: 12, background: "var(--ops-danger-soft)", color: "var(--ops-danger)", borderRadius: "var(--ops-radius-sm)", fontSize: 13 }}>❌ {smokeError}</div>}

            {smokeResults.length > 0 && (
              <div style={{ borderTop: "1px solid var(--ops-border)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {smokeResults.map((result, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 12, borderBottom: i < smokeResults.length - 1 ? "1px solid var(--ops-border)" : undefined }}>
                    <span style={{ fontSize: 16 }}>{smokeIcon(result.status)}</span>
                    <div style={{ flex: 1 }}>
                      <div className="ops-mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text)" }}>{result.name}</div>
                      {result.message && <div style={{ fontSize: 12, color: "var(--ops-text-muted)", marginTop: 4 }}>{result.message}</div>}
                    </div>
                    <span className="ops-mono" style={{ fontSize: 12, color: "var(--ops-text-muted)" }}>{result.latencyMs}ms</span>
                    <span className={`ops-badge ${result.status === "PASS" ? "ops-badge-success" : "ops-badge-danger"}`}>{result.status}</span>
                  </div>
                ))}
                <div style={{ marginTop: 8 }}>{smokeSummaryBadge(smokeResults)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ops-panel">
        <div className="ops-panel-header">
          <h3 className="ops-panel-title">실행 이력 (현재 세션)</h3>
          <span className="ops-badge ops-badge-brand">{history.length}</span>
        </div>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr><th>유형</th><th>시간</th><th>결과</th><th>상세</th></tr>
            </thead>
            <tbody>
              {history.length > 0 ? (
                history.map((entry, i) => (
                  <tr key={i}>
                    <td><span className={`ops-badge ${entry.type === "preflight" ? "ops-badge-brand" : "ops-badge-warning"}`}>{entry.type.toUpperCase()}</span></td>
                    <td className="ops-mono" style={{ fontSize: 12, color: "var(--ops-text-muted)" }}>{formatTime(entry.at)}</td>
                    <td>{historyResultBadge(entry)}</td>
                    <td style={{ fontSize: 12, color: "var(--ops-text-muted)" }}>{entry.total}개 항목 테스트 완료</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "var(--ops-text-muted)" }}>아직 실행된 점검이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
