import React from "react";
import { Button } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function ReviewQueue() {
  const { busy, log, callApi } = useOpsApi();

  return (
    <div className="im-panel">
      <h2 className="im-panel-title">Review Queue</h2>
      <p className="im-lede">운영자 수동 검토가 필요한 케이스 대기열입니다.</p>
      
      <div className="im-actions">
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/reviews/pending`)}>대기열 조회 (개발중)</Button>
      </div>

      {log && <pre className="im-log" style={{ marginTop: '2rem' }}>{log}</pre>}
    </div>
  );
}
