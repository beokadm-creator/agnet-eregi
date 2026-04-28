import React, { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function Dashboard() {
  const { busy, log, callApi } = useOpsApi();
  const [gateKey, setGateKey] = useState("pilot-gate");
  const [summaryDate, setSummaryDate] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()));
  const [caseId, setCaseId] = useState("");

  return (
    <div className="im-panel">
      <h2 className="im-panel-title">Gate / Operations</h2>
      <p className="im-lede">파일럿 운영 체크리스트 핵심 루프</p>
      
      <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
        <Input label="Gate Key" value={gateKey} onChange={(e) => setGateKey(e.target.value)} />
        <Input type="date" label="Summary Date" value={summaryDate} onChange={(e) => setSummaryDate(e.target.value)} />
        <Input label="Case ID" value={caseId} onChange={(e) => setCaseId(e.target.value)} placeholder="case id for troubleshooting" />
      </div>

      <div className="im-actions">
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/reports/${gateKey}/daily?date=${summaryDate}`)}>일일 Gate 요약</Button>
        <Button disabled={busy || !caseId} variant="secondary" onClick={() => callApi(`/v1/ops/cases/${caseId}/detail`)}>케이스 상세</Button>
        <Button disabled={busy || !caseId} variant="secondary" onClick={() => callApi(`/v1/ops/cases/${caseId}/packages/regenerate`, { method: "POST", body: "{}" })}>패키지 재생성</Button>
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/settlements/batch`, { method: "POST", body: JSON.stringify({ periodEnd: new Date().toISOString() }) })}>정산 배치 실행</Button>
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/ads/batch`, { method: "POST", body: JSON.stringify({ targetDate: summaryDate }) })}>광고 과금 배치 실행</Button>
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/subscriptions/batch`, { method: "POST", body: JSON.stringify({ targetDate: summaryDate }) })}>구독 결제 배치 실행</Button>
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/risk/summary?gateKey=${gateKey}`)}>리스크 지표 확인</Button>
        <Button disabled={busy} variant="danger" onClick={() => callApi(`/v1/ops/risk/${gateKey}/mitigate`, { method: "POST", body: JSON.stringify({ actionKey: "circuit_breaker_reset" }) })}>리스크 완화 실행</Button>
      </div>

      {log && <pre className="im-log" style={{ marginTop: '2rem' }}>{log}</pre>}
    </div>
  );
}
