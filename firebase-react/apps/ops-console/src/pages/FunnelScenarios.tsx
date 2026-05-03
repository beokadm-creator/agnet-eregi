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

export default function FunnelScenarios() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [items, setItems] = useState<any[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [draftText, setDraftText] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"draft" | "published">("draft");

  const selected = useMemo(() => items.find((i) => i.scenarioKey === selectedKey) || null, [items, selectedKey]);

  async function loadList() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/funnel-scenarios`, { headers });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.messageKo || json.error?.code || "API Error");
      setItems(json.data?.items || []);
      if (!selectedKey && json.data?.items?.[0]?.scenarioKey) setSelectedKey(json.data.items[0].scenarioKey);
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "불러오기 실패" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadList();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) return;
    const draft = selected.draft || null;
    setDraftText(draft ? prettyJson(draft) : "");
    setActiveTab("draft");
  }, [selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function bootstrapDefaults(force: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/funnel-scenarios/bootstrap-defaults`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ force })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.messageKo || json.error?.code || "생성 실패");
      const created = (json.data?.results || []).filter((r: any) => r.created).length;
      const skipped = (json.data?.results || []).filter((r: any) => !r.created).length;
      setMsg({ ok: true, text: `기본 시나리오 처리 완료 (생성 ${created}, 유지 ${skipped})` });
      await loadList();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "생성 실패" });
    } finally {
      setBusy(false);
    }
  }

  async function bootstrap() {
    if (!selectedKey) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/funnel-scenarios/${encodeURIComponent(selectedKey)}/bootstrap`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" }
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.messageKo || json.error?.code || "API Error");
      setMsg({ ok: true, text: "draft 초기화 완료" });
      await loadList();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "초기화 실패" });
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!selectedKey) return;
    setBusy(true);
    setMsg(null);
    try {
      const parsed = JSON.parse(draftText || "{}");
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/funnel-scenarios/${encodeURIComponent(selectedKey)}/draft`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.messageKo || json.error?.code || "저장 실패");
      setMsg({ ok: true, text: "draft 저장 완료" });
      await loadList();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "저장 실패" });
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!selectedKey) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/funnel-scenarios/${encodeURIComponent(selectedKey)}/publish`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" }
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.messageKo || json.error?.code || "publish 실패");
      setMsg({ ok: true, text: "publish 완료" });
      await loadList();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "publish 실패" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 className="ops-title">퍼널 시나리오</h1>
        <p className="ops-subtitle">등기 종류/프로세스(질문 흐름·필수서류·견적·검증·매칭)를 시나리오로 관리합니다.</p>
      </div>

      <div className="ops-panel">
        <div className="ops-panel-body" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ops-text-muted)" }}>시나리오 목록</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ops-btn" onClick={() => bootstrapDefaults(false)} disabled={loading || busy}>기본 생성</button>
                <button className="ops-btn" onClick={loadList} disabled={loading || busy}>새로고침</button>
              </div>
            </div>

            <div style={{ border: "1px solid var(--ops-border)", borderRadius: 12, overflow: "hidden" }}>
              {loading ? (
                <div style={{ padding: 12, fontSize: 13, color: "var(--ops-text-muted)" }}>불러오는 중...</div>
              ) : (
                <div style={{ maxHeight: 520, overflowY: "auto" }}>
                  {(items || []).map((it) => (
                    <button
                      key={it.scenarioKey}
                      className="ops-btn"
                      style={{
                        width: "100%",
                        justifyContent: "space-between",
                        borderRadius: 0,
                        border: "none",
                        borderBottom: "1px solid var(--ops-border)",
                        background: it.scenarioKey === selectedKey ? "var(--ops-surface)" : "transparent"
                      }}
                      onClick={() => setSelectedKey(it.scenarioKey)}
                    >
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", overflow: "hidden" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>{it.scenarioKey}</span>
                        <span style={{ fontSize: 11, color: "var(--ops-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>
                          {it.published?.title || it.draft?.title || ""}
                        </span>
                      </span>
                      <span className={`ops-badge ${it.enabled ? "ops-badge-success" : "ops-badge-danger"}`}>{it.enabled ? "ON" : "OFF"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="ops-input"
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                placeholder="scenarioKey"
              />
              <button className="ops-btn ops-btn-brand" onClick={bootstrap} disabled={!selectedKey || busy}>초기화</button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="ops-btn" onClick={() => bootstrapDefaults(true)} disabled={loading || busy}>기본 강제생성</button>
            </div>

            {msg && <div style={{ fontSize: 13, color: msg.ok ? "var(--ops-success)" : "var(--ops-danger)" }}>{msg.text}</div>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ops-btn" onClick={() => setActiveTab("draft")} disabled={activeTab === "draft"}>draft</button>
                <button className="ops-btn" onClick={() => setActiveTab("published")} disabled={activeTab === "published"}>published</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ops-btn ops-btn-brand" onClick={saveDraft} disabled={busy || !selectedKey}>draft 저장</button>
                <button className="ops-btn" onClick={publish} disabled={busy || !selectedKey}>publish</button>
              </div>
            </div>

            {activeTab === "draft" ? (
              <textarea
                className="ops-input"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                style={{ height: 520, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: 1.5 }}
                placeholder="draft JSON"
              />
            ) : (
              <textarea
                className="ops-input"
                value={selected?.published ? prettyJson(selected.published) : ""}
                readOnly
                style={{ height: 520, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: 1.5, opacity: 0.85 }}
                placeholder="published JSON"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
