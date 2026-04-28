const fs = require('fs');
const path = require('path');
const srcDir = './firebase-react/apps/ops-console/src';

const reviewQueueCode = `import React from "react";
import { Button } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function ReviewQueue() {
  const { busy, log, callApi } = useOpsApi();

  return (
    <div className="im-panel">
      <h2 className="im-panel-title">Review Queue</h2>
      <p className="im-lede">운영자 수동 검토가 필요한 케이스 대기열입니다.</p>
      
      <div className="im-actions">
        <Button disabled={busy} variant="secondary" onClick={() => callApi(\`/v1/ops/reviews/pending\`)}>대기열 조회 (개발중)</Button>
      </div>

      {log && <pre className="im-log" style={{ marginTop: '2rem' }}>{log}</pre>}
    </div>
  );
}
`;
fs.writeFileSync(path.join(srcDir, 'pages', 'ReviewQueue.tsx'), reviewQueueCode);

const slaDashboardCode = `import React from "react";
import { Button } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function SlaDashboard() {
  const { busy, log, callApi } = useOpsApi();

  return (
    <div className="im-panel">
      <h2 className="im-panel-title">SLA Dashboard</h2>
      <p className="im-lede">케이스 처리 기한 및 지연 경고 현황입니다.</p>
      
      <div className="im-actions">
        <Button disabled={busy} variant="secondary" onClick={() => callApi(\`/v1/ops/sla/breaches\`)}>SLA 초과 조회 (개발중)</Button>
      </div>

      {log && <pre className="im-log" style={{ marginTop: '2rem' }}>{log}</pre>}
    </div>
  );
}
`;
fs.writeFileSync(path.join(srcDir, 'pages', 'SlaDashboard.tsx'), slaDashboardCode);

const auditLogsCode = `import React from "react";
import { Button } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function AuditLogs() {
  const { busy, log, callApi } = useOpsApi();

  return (
    <div className="im-panel">
      <h2 className="im-panel-title">Audit Logs</h2>
      <p className="im-lede">시스템 내 모든 감사 로그(Audit) 내역입니다.</p>
      
      <div className="im-actions">
        <Button disabled={busy} variant="secondary" onClick={() => callApi(\`/v1/ops/audit-logs?limit=50\`)}>최근 감사로그 조회 (개발중)</Button>
      </div>

      {log && <pre className="im-log" style={{ marginTop: '2rem' }}>{log}</pre>}
    </div>
  );
}
`;
fs.writeFileSync(path.join(srcDir, 'pages', 'AuditLogs.tsx'), auditLogsCode);

