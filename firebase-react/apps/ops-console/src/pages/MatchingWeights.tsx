import { useEffect, useState } from "react";
import { useOpsApi } from "../hooks";

function prettyJson(v: any): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v ?? "");
  }
}

const FIELD_GROUPS = [
  {
    title: "기본 품질",
    fields: [
      { key: "ratingWeight", label: "평점 반영", help: "파트너 평점을 점수에 반영하는 비중" },
      { key: "slaWeight", label: "SLA 반영", help: "응답 속도/처리 준수 수준 반영" },
      { key: "tierWeight", label: "티어 반영", help: "파트너 등급 기본 비중" },
    ],
  },
  {
    title: "조건 일치",
    fields: [
      { key: "regionMatchWeight", label: "지역 일치", help: "희망 지역과 일치할 때 가점" },
      { key: "regionMismatchWeight", label: "지역 불일치", help: "희망 지역과 다를 때 감점" },
      { key: "specialtyMatchWeight", label: "전문분야 일치", help: "전문분야가 맞을 때 가점" },
      { key: "specialtyMismatchWeight", label: "전문분야 불일치", help: "전문분야가 안 맞을 때 감점" },
      { key: "scenarioKeyMatchWeight", label: "시나리오 일치", help: "scenarioKey를 직접 처리 가능할 때 가점" },
      { key: "scenarioKeyMismatchWeight", label: "시나리오 불일치", help: "scenarioKey 처리 불일치 감점" },
      { key: "preferredTagMatchWeight", label: "선호 태그 일치", help: "preferred tag가 맞을 때 가점" },
    ],
  },
  {
    title: "운영상 보정",
    fields: [
      { key: "urgentEtaWeight", label: "긴급 ETA", help: "긴급 건에서 ETA 반영 비중" },
      { key: "normalEtaWeight", label: "일반 ETA", help: "일반 건에서 ETA 반영 비중" },
      { key: "priceWeight", label: "가격 반영", help: "가격 경쟁력 반영 비중" },
      { key: "availableBonus", label: "가용 보너스", help: "즉시 대응 가능 상태 보너스" },
      { key: "notAvailablePenalty", label: "비가용 패널티", help: "대응 불가 상태 감점" },
      { key: "highQualityLowTierPenalty", label: "고품질/저티어 패널티", help: "조건이 높은데 저티어인 경우 감점" },
      { key: "reviewBonus50", label: "리뷰 50 보너스", help: "리뷰 수 50개 이상 보너스" },
      { key: "reviewBonus200", label: "리뷰 200 보너스", help: "리뷰 수 200개 이상 보너스" },
    ],
  },
] as const;

export default function MatchingWeights() {
  const { busy, data, error, callApi } = useOpsApi();
  const [text, setText] = useState<string>("");
  const [form, setForm] = useState<Record<string, number>>({});

  async function refresh() {
    await callApi("/v1/ops/settings/matching-weights");
  }

  async function save() {
    const parsed = JSON.parse(text || "{}");
    await callApi("/v1/ops/settings/matching-weights", { method: "PUT", body: JSON.stringify(parsed) });
    await refresh();
  }

  async function saveForm() {
    await callApi("/v1/ops/settings/matching-weights", { method: "PUT", body: JSON.stringify(form) });
    await refresh();
  }

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data?.settings) return;
    setText(prettyJson(data.settings));
    setForm(data.settings);
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: "var(--ops-text-muted)", lineHeight: 1.6 }}>
              일반 조정은 아래 숫자 입력으로 처리하고, 구조 변경이 필요할 때만 raw JSON을 사용합니다.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ops-btn" onClick={refresh} disabled={busy}>새로고침</button>
              <button className="ops-btn ops-btn-brand" onClick={saveForm} disabled={busy}>폼 저장</button>
              <button className="ops-btn" onClick={save} disabled={busy}>JSON 저장</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {FIELD_GROUPS.map((group) => (
              <div key={group.title} className="ops-panel" style={{ background: "var(--ops-bg)" }}>
                <div className="ops-panel-header">
                  <h2 className="ops-panel-title">{group.title}</h2>
                </div>
                <div className="ops-panel-body" style={{ display: "grid", gap: 12 }}>
                  {group.fields.map((field) => (
                    <label key={field.key} style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>{field.label}</span>
                      <input
                        className="ops-input"
                        type="number"
                        step="0.1"
                        value={form[field.key] ?? 0}
                        onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))}
                      />
                      <span style={{ fontSize: 11, color: "var(--ops-text-faint)", lineHeight: 1.4 }}>{field.help}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="ops-panel" style={{ background: "var(--ops-bg)" }}>
            <div className="ops-panel-header">
              <h2 className="ops-panel-title">Raw JSON</h2>
              <span className="ops-badge">advanced</span>
            </div>
            <div className="ops-panel-body">
              <textarea
                className="ops-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ height: 360, padding: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: 1.5 }}
                placeholder="{ }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
