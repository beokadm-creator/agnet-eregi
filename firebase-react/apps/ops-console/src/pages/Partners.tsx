import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

function prettyJson(v: any): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v ?? "");
  }
}

export default function Partners() {
  const { token } = useAuth();
  const apiBase = useMemo(() => getApiBaseUrl(), []);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [editor, setEditor] = useState<string>("{}");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [message, setMessage] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const [normalizePreview, setNormalizePreview] = useState<any | null>(null);

  const selected = useMemo(() => items.find((i) => i.partnerId === selectedId) || null, [items, selectedId]);

  async function refresh() {
    setMessage("");
    setError("");
    setBusy(true);
    try {
      if (!token) throw new Error("인증이 필요합니다.");
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}&limit=200` : "?limit=200";
      const res = await fetch(`${apiBase}/v1/ops/partners${qs}`, { headers });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.messageKo || json.error?.code || "조회 실패");
      setItems(json.data?.items || []);
      if (!selectedId && json.data?.items?.[0]?.partnerId) setSelectedId(json.data.items[0].partnerId);
    } catch (e: any) {
      setError(e?.message || "조회 실패");
    } finally {
      setBusy(false);
    }
  }

  async function loadDetail(partnerId: string) {
    setMessage("");
    setError("");
    setBusy(true);
    try {
      if (!token) throw new Error("인증이 필요합니다.");
      const res = await fetch(`${apiBase}/v1/ops/partners/${encodeURIComponent(partnerId)}`, { headers });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.messageKo || json.error?.code || "조회 실패");
      setDetail(json.data?.partner || null);
    } catch (e: any) {
      setError(e?.message || "조회 실패");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setMessage("");
    if (!selectedId) return;
    setError("");
    setBusy(true);
    try {
      if (!token) throw new Error("인증이 필요합니다.");
      const parsed = JSON.parse(editor || "{}");
      const res = await fetch(`${apiBase}/v1/ops/partners/${encodeURIComponent(selectedId)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(parsed)
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.messageKo || json.error?.code || "저장 실패");
      setMessage("저장 완료");
      await refresh();
    } catch (e: any) {
      setError(e?.message || "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  async function normalize(dryRun: boolean) {
    setMessage("");
    setError("");
    setBusy(true);
    try {
      if (!token) throw new Error("인증이 필요합니다.");
      let confirm = "";
      let maxChanged = 200;
      if (!dryRun) {
        maxChanged = parseInt(prompt("최대 변경 허용 건수(maxChanged)", "200") || "200", 10) || 200;
        confirm = prompt("적용 실행 확인: APPLY 를 입력하세요", "") || "";
      }
      const res = await fetch(`${apiBase}/v1/ops/partners/normalize-taxonomy`, {
        method: "POST",
        headers,
        body: JSON.stringify({ dryRun, limit: 500, confirm, maxChanged })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.messageKo || json.error?.code || "실행 실패");
      const changedCount = json.data?.changedCount ?? 0;
      setNormalizePreview(json.data || null);
      setMessage(dryRun ? `정규화 dry-run 완료 (변경 ${changedCount})` : `정규화 적용 완료 (변경 ${changedCount})`);
      if (!dryRun) await refresh();
    } catch (e: any) {
      setError(e?.message || "실행 실패");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    refresh();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) return;
    const item = items.find((i) => i.partnerId === selectedId);
    if (!item) return;
    setEditor(prettyJson({
      regions: item.regions || [],
      specialties: item.specialties || [],
      tags: item.tags || [],
      qualityTier: item.qualityTier || "Bronze",
      isSponsored: item.isSponsored === true,
      isAvailable: item.isAvailable !== false,
      price: item.price || 0,
      etaHours: item.etaHours || 24,
      maxCapacity: item.maxCapacity || 50
    }));
    setDetail(null);
  }, [selectedId, items]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 className="ops-title">파트너 관리</h1>
        <p className="ops-subtitle">regions/specialties/tags 정리 및 가용성/가격/ETA/티어를 관리합니다.</p>
      </div>

      {error && <div style={{ padding: "12px 16px", background: "var(--ops-danger-soft)", color: "var(--ops-danger)", borderRadius: "var(--ops-radius)", fontSize: 13 }}>{error}</div>}
      {message && <div style={{ padding: "12px 16px", background: "var(--ops-success-soft)", color: "var(--ops-success)", borderRadius: "var(--ops-radius)", fontSize: 13 }}>{message}</div>}

      <div className="ops-panel">
        <div className="ops-panel-body" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select className="ops-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ flex: 1 }}>
                <option value="">전체</option>
                <option value="active">active</option>
                <option value="pending">pending</option>
                <option value="inactive">inactive</option>
              </select>
              <button className="ops-btn" onClick={refresh} disabled={busy}>새로고침</button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="ops-btn" onClick={() => normalize(true)} disabled={busy}>정규화(dry)</button>
              <button className="ops-btn ops-btn-danger" onClick={() => normalize(false)} disabled={busy}>정규화(적용)</button>
            </div>

            <div style={{ border: "1px solid var(--ops-border)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ maxHeight: 520, overflowY: "auto" }}>
                {items.map((it) => (
                  <button
                    key={it.partnerId}
                    className="ops-btn"
                    style={{
                      width: "100%",
                      justifyContent: "space-between",
                      borderRadius: 0,
                      border: "none",
                      borderBottom: "1px solid var(--ops-border)",
                      background: it.partnerId === selectedId ? "var(--ops-surface)" : "transparent"
                    }}
                    onClick={() => { setSelectedId(it.partnerId); }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", overflow: "hidden" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                        {it.name || it.partnerId}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--ops-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                        {it.partnerId}
                      </span>
                    </span>
                    <span className={`ops-badge ${it.isAvailable !== false ? "ops-badge-success" : "ops-badge-danger"}`}>{it.isAvailable !== false ? "ON" : "OFF"}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 13, color: "var(--ops-text-muted)" }}>
                  {selectedId ? `선택: ${selectedId}` : "파트너를 선택하세요"}
                </div>
                {selected?.isSponsored && <span className="ops-badge ops-badge-warning">Sponsored</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ops-btn" onClick={() => selectedId && loadDetail(selectedId)} disabled={busy || !selectedId}>상세</button>
                <button className="ops-btn ops-btn-brand" onClick={save} disabled={busy || !selectedId}>저장</button>
              </div>
            </div>

            <textarea
              className="ops-input"
              value={editor}
              onChange={(e) => setEditor(e.target.value)}
              style={{ height: 520, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: 1.5 }}
              placeholder="{ }"
              disabled={!selectedId}
            />
          </div>
        </div>
      </div>

      {detail && (
        <div className="ops-panel">
          <div className="ops-panel-header">
            <h2 className="ops-panel-title">상세</h2>
          </div>
          <div className="ops-panel-body">
            <pre className="ops-mono" style={{ margin: 0, fontSize: 12, color: "var(--ops-text-muted)", background: "var(--ops-bg)", padding: 12, borderRadius: "var(--ops-radius-sm)", border: "1px solid var(--ops-border)", overflowX: "auto" }}>
              {prettyJson(detail)}
            </pre>
          </div>
        </div>
      )}

      {normalizePreview && (
        <div className="ops-panel">
          <div className="ops-panel-header">
            <h2 className="ops-panel-title">정규화 결과</h2>
            <span className="ops-badge ops-badge-brand">{normalizePreview.changedCount ?? 0}</span>
          </div>
          <div className="ops-panel-body">
            <pre className="ops-mono" style={{ margin: 0, fontSize: 12, color: "var(--ops-text-muted)", background: "var(--ops-bg)", padding: 12, borderRadius: "var(--ops-radius-sm)", border: "1px solid var(--ops-border)", overflowX: "auto" }}>
              {prettyJson(normalizePreview)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
