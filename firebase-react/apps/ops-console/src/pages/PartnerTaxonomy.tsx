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

function listToText(values: string[] | undefined): string {
  return Array.isArray(values) ? values.join("\n") : "";
}

function textToList(value: string): string[] {
  return Array.from(new Set(value.split(/\n|,/).map((v) => v.trim()).filter(Boolean)));
}

export default function PartnerTaxonomy() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [text, setText] = useState<string>("");
  const [scenarioKeys, setScenarioKeys] = useState<string[]>([]);
  const [regionsText, setRegionsText] = useState("");
  const [specialtiesText, setSpecialtiesText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [regionAliasesText, setRegionAliasesText] = useState("{}");
  const [specialtyAliasesText, setSpecialtyAliasesText] = useState("{}");
  const [tagAliasesText, setTagAliasesText] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function applyForm(settings: any) {
    setRegionsText(listToText(settings?.regions));
    setSpecialtiesText(listToText(settings?.specialties));
    setTagsText(listToText(settings?.tags));
    setRegionAliasesText(prettyJson(settings?.aliases?.regions || {}));
    setSpecialtyAliasesText(prettyJson(settings?.aliases?.specialties || {}));
    setTagAliasesText(prettyJson(settings?.aliases?.tags || {}));
  }

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/settings/partner-taxonomy`, { headers });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.messageKo || json.error?.code || "불러오기 실패");
      const settings = json.data?.settings || {};
      setText(prettyJson(settings));
      applyForm(settings);
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

  async function saveForm() {
    setBusy(true);
    setMsg(null);
    try {
      const parsed = {
        regions: textToList(regionsText),
        specialties: textToList(specialtiesText),
        tags: textToList(tagsText),
        aliases: {
          regions: JSON.parse(regionAliasesText || "{}"),
          specialties: JSON.parse(specialtyAliasesText || "{}"),
          tags: JSON.parse(tagAliasesText || "{}"),
        },
      };
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/settings/partner-taxonomy`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.messageKo || json.error?.code || "저장 실패");
      const settings = json.data?.settings || parsed;
      setText(prettyJson(settings));
      applyForm(settings);
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
        <h1 className="ops-title">매칭 기준값</h1>
        <p className="ops-subtitle">파트너의 지역, 전문분야, 태그, scenarioKey 허용값을 관리합니다. 매칭과 필터링의 공통 기준입니다.</p>
      </div>

      <div className="ops-panel">
        <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: "var(--ops-text-muted)", lineHeight: 1.6 }}>
              운영자는 아래 폼으로 기준값을 관리하고, 고급 수정이 필요할 때만 raw JSON을 사용하면 됩니다.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ops-btn" onClick={load} disabled={loading || busy}>새로고침</button>
              <button className="ops-btn ops-btn-brand" onClick={saveForm} disabled={loading || busy}>폼 저장</button>
              <button className="ops-btn" onClick={save} disabled={loading || busy}>JSON 저장</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div className="ops-panel" style={{ background: "var(--ops-bg)" }}>
              <div className="ops-panel-header">
                <h2 className="ops-panel-title">허용값</h2>
              </div>
              <div className="ops-panel-body" style={{ display: "grid", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>지역</span>
                  <textarea
                    className="ops-input"
                    value={regionsText}
                    onChange={(e) => setRegionsText(e.target.value)}
                    style={{ minHeight: 120, padding: 10, fontFamily: "var(--ops-font-ui)", lineHeight: 1.5 }}
                    placeholder={"서울\n경기\n인천"}
                    readOnly={loading}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>전문분야</span>
                  <textarea
                    className="ops-input"
                    value={specialtiesText}
                    onChange={(e) => setSpecialtiesText(e.target.value)}
                    style={{ minHeight: 160, padding: 10, fontFamily: "var(--ops-font-ui)", lineHeight: 1.5 }}
                    placeholder={"설립\n기본 변경\n자본·주식"}
                    readOnly={loading}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>태그</span>
                  <textarea
                    className="ops-input"
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    style={{ minHeight: 140, padding: 10, fontFamily: "var(--ops-font-ui)", lineHeight: 1.5 }}
                    placeholder={"긴급대응\n외국인케이스\n프리미엄"}
                    readOnly={loading}
                  />
                </label>
              </div>
            </div>

            <div className="ops-panel" style={{ background: "var(--ops-bg)" }}>
              <div className="ops-panel-header">
                <h2 className="ops-panel-title">별칭 매핑</h2>
              </div>
              <div className="ops-panel-body" style={{ display: "grid", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>지역 alias JSON</span>
                  <textarea
                    className="ops-input ops-mono"
                    value={regionAliasesText}
                    onChange={(e) => setRegionAliasesText(e.target.value)}
                    style={{ minHeight: 120, padding: 10, lineHeight: 1.5 }}
                    readOnly={loading}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>전문분야 alias JSON</span>
                  <textarea
                    className="ops-input ops-mono"
                    value={specialtyAliasesText}
                    onChange={(e) => setSpecialtyAliasesText(e.target.value)}
                    style={{ minHeight: 180, padding: 10, lineHeight: 1.5 }}
                    readOnly={loading}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>태그 alias JSON</span>
                  <textarea
                    className="ops-input ops-mono"
                    value={tagAliasesText}
                    onChange={(e) => setTagAliasesText(e.target.value)}
                    style={{ minHeight: 140, padding: 10, lineHeight: 1.5 }}
                    readOnly={loading}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="ops-panel" style={{ background: "var(--ops-bg)" }}>
            <div className="ops-panel-header">
              <h2 className="ops-panel-title">Raw JSON</h2>
              <span className="ops-badge">{loading ? "loading" : "advanced"}</span>
            </div>
            <div className="ops-panel-body">
              <textarea
                className="ops-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ height: 360, padding: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: 1.5 }}
                placeholder={loading ? "불러오는 중..." : "{ \"regions\": [], \"specialties\": [], \"tags\": [] }"}
                readOnly={loading}
              />
            </div>
          </div>

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
