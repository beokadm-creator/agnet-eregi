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

export default function PartnerTaxonomy() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [text, setText] = useState<string>("");
  const [scenarioKeys, setScenarioKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/settings/partner-taxonomy`, { headers });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.messageKo || json.error?.code || "불러오기 실패");
      setText(prettyJson(json.data?.settings || {}));
      setScenarioKeys(Array.isArray(json.data?.scenarioKeys) ? json.data.scenarioKeys : []);
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "불러오기 실패" });
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const parsed = JSON.parse(text || "{}");
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/settings/partner-taxonomy`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.messageKo || json.error?.code || "저장 실패");
      setText(prettyJson(json.data?.settings || parsed));
      setMsg({ ok: true, text: "저장 완료" });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "저장 실패" });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 className="ops-title">파트너 분류</h1>
        <p className="ops-subtitle">regions / specialties / tags 허용값을 정의합니다. 매칭 및 필터링의 기준이 됩니다.</p>
      </div>

      <div className="ops-panel">
        <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <button className="ops-btn" onClick={load} disabled={loading || busy}>새로고침</button>
            <button className="ops-btn ops-btn-brand" onClick={save} disabled={loading || busy}>저장</button>
          </div>

          <textarea
            className="ops-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ height: 520, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: 1.5 }}
            placeholder={loading ? "불러오는 중..." : "{ \"regions\": [], \"specialties\": [], \"tags\": [] }"}
            readOnly={loading}
          />

          <div className="ops-panel" style={{ background: "var(--ops-bg)" }}>
            <div className="ops-panel-header">
              <h2 className="ops-panel-title">허용 scenarioKeys</h2>
              <span className="ops-badge ops-badge-brand">{scenarioKeys.length}</span>
            </div>
            <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, color: "var(--ops-text-muted)" }}>
                파트너 문서의 <code>scenarioKeysHandled</code> 는 아래 키 중에서만 넣는 것을 권장합니다.
              </div>
              <pre className="ops-mono" style={{ margin: 0, fontSize: 12, color: "var(--ops-text-muted)", background: "var(--ops-surface)", padding: 12, borderRadius: "var(--ops-radius-sm)", border: "1px solid var(--ops-border)", overflowX: "auto", whiteSpace: "pre-wrap" }}>
{prettyJson({
  specialtiesExample: ["설립", "자본·주식"],
  scenarioKeysHandledExample: scenarioKeys.slice(0, 6),
  tagsExample: ["외국인케이스", "긴급대응"]
})}
              </pre>
              <pre className="ops-mono" style={{ margin: 0, fontSize: 12, color: "var(--ops-text-muted)", background: "var(--ops-surface)", padding: 12, borderRadius: "var(--ops-radius-sm)", border: "1px solid var(--ops-border)", overflowX: "auto", whiteSpace: "pre-wrap", maxHeight: 240, overflowY: "auto" }}>
                {scenarioKeys.join("\n")}
              </pre>
            </div>
          </div>

          {msg && <div style={{ fontSize: 13, color: msg.ok ? "var(--ops-success)" : "var(--ops-danger)" }}>{msg.text}</div>}
        </div>
      </div>
    </div>
  );
}
