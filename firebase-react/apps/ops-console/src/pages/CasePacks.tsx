import React, { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function CasePacks() {
  const { busy, data, error, callApi } = useOpsApi();
  const [casePackId, setCasePackId] = useState("");
  const [casePackName, setCasePackName] = useState("");
  const [casePackSchema, setCasePackSchema] = useState('{\n  "type": "object",\n  "properties": {}\n}');

  return (
    <div className="im-panel">
      <h2 className="im-panel-title">사건 팩</h2>
      
      <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
        <Input label="사건 팩 ID" value={casePackId} onChange={(e) => setCasePackId(e.target.value)} placeholder="예: real_estate_transfer_v1" />
        <Input label="사건명" value={casePackName} onChange={(e) => setCasePackName(e.target.value)} placeholder="예: 부동산 소유권 이전" />
        <div>
          <label className="block text-[0.75rem] font-medium tracking-[0.12em] uppercase text-[var(--ar-slate)] mb-2">입력 폼 스키마</label>
          <textarea
            value={casePackSchema}
            onChange={(e) => setCasePackSchema(e.target.value)}
            className="block w-full px-3 py-2.5 border rounded-[var(--ar-r1)] text-sm bg-[var(--ar-canvas)] text-[var(--ar-ink)] border-[var(--ar-hairline)] focus:outline-none focus:ring-2 focus:ring-[var(--ar-accent)] focus:border-[var(--ar-accent)] h-40 font-mono"
          />
        </div>
      </div>

      <div className="im-actions">
        <Button
          disabled={busy || !casePackId || !casePackName}
          onClick={() => {
            let parsedSchema = { type: "object", properties: {} };
            try { parsedSchema = JSON.parse(casePackSchema); } catch (e) {}
            callApi(`/v1/ops/case-packs`, {
              method: "POST",
              body: JSON.stringify({ id: casePackId, nameKo: casePackName, active: true, formSchema: parsedSchema, workflow: { stages: ["draft_filing", "review", "completed"], requiredSlots: ["id_card"] } }),
            });
          }}
        >생성</Button>
        <Button
          disabled={busy || !casePackId}
          variant="secondary"
          onClick={() => {
            let parsedSchema = { type: "object", properties: {} };
            try { parsedSchema = JSON.parse(casePackSchema); } catch (e) {}
            callApi(`/v1/ops/case-packs/${casePackId}`, {
              method: "PUT",
              body: JSON.stringify({ nameKo: casePackName, active: true, formSchema: parsedSchema, workflow: { stages: ["draft_filing", "review", "completed"], requiredSlots: ["id_card"] } }),
            });
          }}
        >수정</Button>
      </div>

      {error && <pre className="im-log" style={{ marginTop: "2rem", background: "var(--ar-danger-soft)", color: "var(--ar-danger)" }}>{error}</pre>}
      {!error && data && <pre className="im-log" style={{ marginTop: "2rem" }}>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
