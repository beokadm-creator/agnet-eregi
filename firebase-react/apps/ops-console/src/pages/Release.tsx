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

// --- Component ---

export default function Release() {
  const { token } = useAuth();

  // Preflight state
  const [preflightGateKey, setPreflightGateKey] = useState("");
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightChecks, setPreflightChecks] = useState<PreflightCheck[]>([]);
  const [preflightError, setPreflightError] = useState<string | null>(null);

  // Smoke test state
  const [smokeGateKey, setSmokeGateKey] = useState("");
  const [smokeMode, setSmokeMode] = useState<"read_only" | "full">("read_only");
  const [smokeLoading, setSmokeLoading] = useState(false);
  const [smokeResults, setSmokeResults] = useState<SmokeTestResult[]>([]);
  const [smokeError, setSmokeError] = useState<string | null>(null);

  // Session history
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // --- Preflight ---

  const runPreflight = useCallback(async () => {
    setPreflightLoading(true);
    setPreflightError(null);
    try {
      const baseUrl = getApiBaseUrl();
      const body: Record<string, unknown> = {};
      if (preflightGateKey.trim()) body.gateKey = preflightGateKey.trim();

      const res = await fetch(`${baseUrl}/v1/ops/preflight`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.ok) {
        const checks: PreflightCheck[] = json.data?.checks ?? [];
        setPreflightChecks(checks);
        const passed = checks.filter((c: PreflightCheck) => c.status === "PASS").length;
        setHistory((prev) => [
          { type: "preflight", at: Date.now(), passed, total: checks.length },
          ...prev,
        ]);
      } else {
        setPreflightError(json.error?.messageKo || json.error?.message || "실패");
      }
    } catch (e) {
      setPreflightError(e instanceof Error ? e.message : "요청 실패");
    } finally {
      setPreflightLoading(false);
    }
  }, [token, preflightGateKey]);

  // --- Smoke Test ---

  const runSmokeTest = useCallback(async () => {
    setSmokeLoading(true);
    setSmokeError(null);
    try {
      const baseUrl = getApiBaseUrl();
      const body: Record<string, unknown> = { mode: smokeMode };
      if (smokeGateKey.trim()) body.gateKey = smokeGateKey.trim();

      const res = await fetch(`${baseUrl}/v1/ops/smoke-test`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.ok) {
        const results: SmokeTestResult[] = json.data?.results ?? [];
        setSmokeResults(results);
        const passed = results.filter((r: SmokeTestResult) => r.status === "PASS").length;
        setHistory((prev) => [
          { type: "smoke", at: Date.now(), passed, total: results.length },
          ...prev,
        ]);
      } else {
        setSmokeError(json.error?.messageKo || json.error?.message || "실패");
      }
    } catch (e) {
      setSmokeError(e instanceof Error ? e.message : "요청 실패");
    } finally {
      setSmokeLoading(false);
    }
  }, [token, smokeGateKey, smokeMode]);

  // --- Helpers ---

  function preflightIcon(status: PreflightCheck["status"]): string {
    if (status === "PASS") return "✅";
    if (status === "WARN") return "⚠️";
    return "❌";
  }

  function smokeIcon(status: SmokeTestResult["status"]): string {
    return status === "PASS" ? "✅" : "❌";
  }

  function formatTime(at: number): string {
    return new Date(at).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function preflightSummaryBadge(checks: PreflightCheck[]): React.ReactNode {
    const passed = checks.filter((c) => c.status === "PASS").length;
    const total = checks.length;
    const allPass = passed === total;
    const hasFail = checks.some((c) => c.status === "FAIL");
    const badgeClass = allPass ? "ar-badge-success" : hasFail ? "ar-badge-danger" : "ar-badge-warning";
    return <span className={`ar-badge ${badgeClass}`}>{passed}/{total} 통과</span>;
  }

  function smokeSummaryBadge(results: SmokeTestResult[]): React.ReactNode {
    const passed = results.filter((r) => r.status === "PASS").length;
    const total = results.length;
    const allPass = passed === total;
    const badgeClass = allPass ? "ar-badge-success" : "ar-badge-danger";
    return <span className={`ar-badge ${badgeClass}`}>{passed}/{total} 통과</span>;
  }

  function historyResultBadge(entry: HistoryEntry): React.ReactNode {
    const allPass = entry.passed === entry.total;
    const badgeClass = allPass ? "ar-badge-success" : "ar-badge-danger";
    return <span className={`ar-badge ${badgeClass}`}>{entry.passed}/{entry.total} 통과</span>;
  }

  // --- Render ---

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
          릴리즈 관리
        </h1>
        <div className="ar-eyebrow" style={{ marginTop: 6, marginBottom: 0 }}>
          배포 전 사전 점검 및 스모크 테스트
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Left — Preflight Check */}
        <div className="ar-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>배포 전 점검 (Preflight)</div>
            <div style={{ fontSize: 12, color: "var(--ar-slate)", marginTop: 4 }}>
              배포 전 필수 인프라 상태를 확인합니다
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="ar-input ar-input-sm"
              placeholder="gateKey (선택)"
              value={preflightGateKey}
              onChange={(e) => setPreflightGateKey(e.target.value)}
            />
            <button
              className="ar-btn ar-btn-sm ar-btn-ink"
              disabled={preflightLoading}
              onClick={runPreflight}
              style={{ flexShrink: 0 }}
            >
              {preflightLoading ? "실행 중..." : "실행"}
            </button>
          </div>

          {preflightError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--ar-r1)",
                background: "var(--ar-danger-soft)",
                color: "var(--ar-danger)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ❌ {preflightError}
            </div>
          )}

          {preflightChecks.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {preflightChecks.map((check, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: i < preflightChecks.length - 1 ? "1px solid var(--ar-hairline)" : undefined,
                  }}
                >
                  <span style={{ flexShrink: 0, lineHeight: "20px" }}>{preflightIcon(check.status)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ar-ink2)" }}>{check.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ar-slate)", marginTop: 2 }}>{check.message}</div>
                  </div>
                  <span
                    className={`ar-badge ${
                      check.status === "PASS"
                        ? "ar-badge-success"
                        : check.status === "WARN"
                          ? "ar-badge-warning"
                          : "ar-badge-danger"
                    }`}
                  >
                    {check.status}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 12 }}>{preflightSummaryBadge(preflightChecks)}</div>
            </div>
          )}
        </div>

        {/* Right — Smoke Test */}
        <div className="ar-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>스모크 테스트</div>
            <div style={{ fontSize: 12, color: "var(--ar-slate)", marginTop: 4 }}>
              시스템 핵심 기능의 정상 동작을 확인합니다
            </div>
          </div>

          {/* Mode selector */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`ar-btn ar-btn-sm ${smokeMode === "read_only" ? "ar-btn-ink" : "ar-btn-ghost"}`}
              onClick={() => setSmokeMode("read_only")}
            >
              읽기 전용
            </button>
            <button
              className={`ar-btn ar-btn-sm ${smokeMode === "full" ? "ar-btn-ink" : "ar-btn-ghost"}`}
              onClick={() => setSmokeMode("full")}
            >
              전체
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="ar-input ar-input-sm"
              placeholder="gateKey (선택)"
              value={smokeGateKey}
              onChange={(e) => setSmokeGateKey(e.target.value)}
            />
            <button
              className="ar-btn ar-btn-sm ar-btn-ink"
              disabled={smokeLoading}
              onClick={runSmokeTest}
              style={{ flexShrink: 0 }}
            >
              {smokeLoading ? "실행 중..." : "실행"}
            </button>
          </div>

          {smokeError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--ar-r1)",
                background: "var(--ar-danger-soft)",
                color: "var(--ar-danger)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ❌ {smokeError}
            </div>
          )}

          {smokeResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {smokeResults.map((result, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: i < smokeResults.length - 1 ? "1px solid var(--ar-hairline)" : undefined,
                  }}
                >
                  <span style={{ flexShrink: 0, lineHeight: "20px" }}>{smokeIcon(result.status)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ar-ink2)" }}>{result.name}</div>
                    {result.status === "FAIL" && result.message && (
                      <div style={{ fontSize: 12, color: "var(--ar-slate)", marginTop: 2 }}>{result.message}</div>
                    )}
                  </div>
                  <span className="ar-tabular" style={{ fontSize: 12, color: "var(--ar-graphite)", flexShrink: 0 }}>
                    {result.latencyMs}ms
                  </span>
                  <span
                    className={`ar-badge ${result.status === "PASS" ? "ar-badge-success" : "ar-badge-danger"}`}
                  >
                    {result.status}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 12 }}>{smokeSummaryBadge(smokeResults)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom — Session History */}
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
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>실행 이력 (현재 세션)</h3>
          <span className="ar-badge ar-badge-info">{history.length}</span>
        </div>
        <table className="ar-table">
          <thead>
            <tr>
              <th>유형</th>
              <th>시간</th>
              <th>결과</th>
              <th>상세</th>
            </tr>
          </thead>
          <tbody>
            {history.length > 0 ? (
              history.map((entry, i) => (
                <tr key={i}>
                  <td>
                    <span className={`ar-badge ${entry.type === "preflight" ? "ar-badge-accent" : "ar-badge-info"}`}>
                      {entry.type === "preflight" ? "Preflight" : "Smoke"}
                    </span>
                  </td>
                  <td className="ar-tabular" style={{ fontSize: 12, color: "var(--ar-slate)" }}>
                    {formatTime(entry.at)}
                  </td>
                  <td>{historyResultBadge(entry)}</td>
                  <td style={{ fontSize: 13, color: "var(--ar-graphite)" }}>
                    {entry.type === "preflight"
                      ? `${entry.total}항목 점검 완료`
                      : `${entry.total}개 엔드포인트 테스트 완료`}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "var(--ar-slate)" }}>
                  아직 실행된 점검이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
