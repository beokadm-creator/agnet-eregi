import React from "react";
import { Button } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function Observability() {
  const { busy, log, callApi } = useOpsApi();

  return (
    <div className="im-panel">
      <h2 className="im-panel-title">Observability</h2>
      
      <div className="im-actions">
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/webhooks/dlq`)}>DLQ 메시지 조회</Button>
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/errors`)}>시스템 에러 통계 조회</Button>
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/ocr/stats`)}>OCR 품질 지표 조회</Button>
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/metrics/daily`)}>일일 시스템 메트릭 조회</Button>
      </div>

      {log && <pre className="im-log" style={{ marginTop: '2rem' }}>{log}</pre>}
    </div>
  );
}
