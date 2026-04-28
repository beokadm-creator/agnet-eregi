import React from "react";
import { Button } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function AuditLogs() {
  const { busy, log, callApi } = useOpsApi();

  return (
    <div className="im-panel">
      <h2 className="im-panel-title">Audit Logs</h2>
      <p className="im-lede">시스템 내 모든 감사 로그(Audit) 내역입니다.</p>
      
      <div className="im-actions">
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/audit-logs?limit=50`)}>최근 감사로그 조회 (개발중)</Button>
      </div>

      {log && <pre className="im-log" style={{ marginTop: '2rem' }}>{log}</pre>}
    </div>
  );
}
