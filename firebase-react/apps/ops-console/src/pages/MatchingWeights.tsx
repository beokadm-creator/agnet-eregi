import { useEffect, useState } from "react";
import { useOpsApi } from "../hooks";

function prettyJson(v: any): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v ?? "");
  }
}

export default function MatchingWeights() {
  const { busy, data, error, callApi } = useOpsApi();
  const [text, setText] = useState<string>("");

  async function refresh() {
    await callApi("/v1/ops/settings/matching-weights");
  }

  async function save() {
    const parsed = JSON.parse(text || "{}");
    await callApi("/v1/ops/settings/matching-weights", { method: "PUT", body: JSON.stringify(parsed) });
    await refresh();
  }

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data?.settings) return;
    setText(prettyJson(data.settings));
  }, [data?.settings]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 className="ops-title">점수 규칙</h1>
        <p className="ops-subtitle">매칭 점수 계산에 들어가는 항목별 비중을 조절합니다. 저장 후 신규 추천 결과에 반영됩니다.</p>
      </div>

      {error && <div style={{ padding: "12px 16px", background: "var(--ops-danger-soft)", color: "var(--ops-danger)", borderRadius: "var(--ops-radius)", fontSize: 13 }}>{error}</div>}

      <div className="ops-panel">
        <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button className="ops-btn" onClick={refresh} disabled={busy}>새로고침</button>
            <button className="ops-btn ops-btn-brand" onClick={save} disabled={busy}>저장</button>
          </div>

          <textarea
            className="ops-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ height: 520, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: 1.5 }}
            placeholder="{ }"
          />
        </div>
      </div>
    </div>
  );
}
