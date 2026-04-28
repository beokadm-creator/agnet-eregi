import React from "react";
import { Button } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function SlaDashboard() {
  const { busy, log, callApi } = useOpsApi();

  return (
    <div className="im-panel">
      <h2 className="im-panel-title">SLA Dashboard</h2>
      <p className="im-lede">케이스 처리 기한 및 지연 경고 현황입니다.</p>
      
      <div className="im-actions">
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/sla/breaches`)}>SLA 초과 조회 (개발중)</Button>
      </div>

      {log && <pre className="im-log" style={{ marginTop: '2rem' }}>{log}</pre>}
    </div>
  );
}
