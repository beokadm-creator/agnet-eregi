const fs = require('fs');
const path = require('path');
const srcDir = './firebase-react/apps/ops-console/src';

const commonHooks = `import { useState, useMemo } from "react";
import { getApiBaseUrl } from "../apiBase";
import { useAuth } from "../context/AuthContext";

export function useOpsApi() {
  const { token } = useAuth();
  const apiBase = useMemo(() => getApiBaseUrl(), []);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");

  async function callApi(path: string, init: RequestInit = {}) {
    setBusy(true);
    try {
      if (!token) throw new Error("인증이 필요합니다.");
      const res = await fetch(\`\${apiBase}\${path}\`, {
        ...init,
        headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json", ...(init.headers || {}) },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) throw new Error(json?.error?.messageKo || json?.error?.code || \`HTTP \${res.status}\`);
      setLog(JSON.stringify(json?.data || json, null, 2));
    } catch (error) {
      setLog(error instanceof Error ? \`[Error] \${error.message}\` : "[Error] Unknown failure");
    } finally {
      setBusy(false);
    }
  }

  return { busy, log, setLog, callApi };
}
`;
fs.writeFileSync(path.join(srcDir, 'hooks.ts'), commonHooks);

const dashboardCode = `import React, { useState } from "react";
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
        <Button disabled={busy} variant="secondary" onClick={() => callApi(\`/v1/ops/reports/\${gateKey}/daily?date=\${summaryDate}\`)}>일일 Gate 요약</Button>
        <Button disabled={busy || !caseId} variant="secondary" onClick={() => callApi(\`/v1/ops/cases/\${caseId}/detail\`)}>케이스 상세</Button>
        <Button disabled={busy || !caseId} variant="secondary" onClick={() => callApi(\`/v1/ops/cases/\${caseId}/packages/regenerate\`, { method: "POST", body: "{}" })}>패키지 재생성</Button>
        <Button disabled={busy} variant="secondary" onClick={() => callApi(\`/v1/ops/settlements/batch\`, { method: "POST", body: JSON.stringify({ periodEnd: new Date().toISOString() }) })}>정산 배치 실행</Button>
        <Button disabled={busy} variant="secondary" onClick={() => callApi(\`/v1/ops/ads/batch\`, { method: "POST", body: JSON.stringify({ targetDate: summaryDate }) })}>광고 과금 배치 실행</Button>
        <Button disabled={busy} variant="secondary" onClick={() => callApi(\`/v1/ops/subscriptions/batch\`, { method: "POST", body: JSON.stringify({ targetDate: summaryDate }) })}>구독 결제 배치 실행</Button>
        <Button disabled={busy} variant="secondary" onClick={() => callApi(\`/v1/ops/risk/summary?gateKey=\${gateKey}\`)}>리스크 지표 확인</Button>
        <Button disabled={busy} variant="danger" onClick={() => callApi(\`/v1/ops/risk/\${gateKey}/mitigate\`, { method: "POST", body: JSON.stringify({ actionKey: "circuit_breaker_reset" }) })}>리스크 완화 실행</Button>
      </div>

      {log && <pre className="im-log" style={{ marginTop: '2rem' }}>{log}</pre>}
    </div>
  );
}
`;
fs.writeFileSync(path.join(srcDir, 'pages', 'Dashboard.tsx'), dashboardCode);

const casePacksCode = `import React, { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function CasePacks() {
  const { busy, log, callApi } = useOpsApi();
  const [casePackId, setCasePackId] = useState("");
  const [casePackName, setCasePackName] = useState("");
  const [casePackSchema, setCasePackSchema] = useState('{\n  "type": "object",\n  "properties": {}\n}');

  return (
    <div className="im-panel">
      <h2 className="im-panel-title">Case Pack</h2>
      
      <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
        <Input label="Case Pack ID" value={casePackId} onChange={(e) => setCasePackId(e.target.value)} placeholder="ex: real_estate_transfer_v1" />
        <Input label="사건명" value={casePackName} onChange={(e) => setCasePackName(e.target.value)} placeholder="ex: 부동산 소유권 이전" />
        <div>
          <label className="block text-[0.75rem] font-medium tracking-[0.12em] uppercase text-[var(--text-tertiary)] mb-2">입력 폼 스키마</label>
          <textarea
            value={casePackSchema}
            onChange={(e) => setCasePackSchema(e.target.value)}
            className="block w-full px-3 py-2.5 border rounded-[2px] text-sm bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] h-40 font-mono"
          />
        </div>
      </div>

      <div className="im-actions">
        <Button
          disabled={busy || !casePackId || !casePackName}
          onClick={() => {
            let parsedSchema = { type: "object", properties: {} };
            try { parsedSchema = JSON.parse(casePackSchema); } catch (e) {}
            callApi(\`/v1/ops/case-packs\`, {
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
            callApi(\`/v1/ops/case-packs/\${casePackId}\`, {
              method: "PUT",
              body: JSON.stringify({ nameKo: casePackName, active: true, formSchema: parsedSchema, workflow: { stages: ["draft_filing", "review", "completed"], requiredSlots: ["id_card"] } }),
            });
          }}
        >수정</Button>
      </div>

      {log && <pre className="im-log" style={{ marginTop: '2rem' }}>{log}</pre>}
    </div>
  );
}
`;
fs.writeFileSync(path.join(srcDir, 'pages', 'CasePacks.tsx'), casePacksCode);

const accessControlCode = `import React, { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function AccessControl() {
  const { busy, log, callApi } = useOpsApi();
  const [accessTargetUid, setAccessTargetUid] = useState("");
  const [accessRole, setAccessRole] = useState("ops_operator");
  const [accessReason, setAccessReason] = useState("");

  return (
    <div className="im-panel">
      <h2 className="im-panel-title">Access Control</h2>
      
      <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
        <Input label="Target UID" value={accessTargetUid} onChange={(e) => setAccessTargetUid(e.target.value)} />
        <Input label="Role" value={accessRole} onChange={(e) => setAccessRole(e.target.value)} placeholder="ops_admin, ops_operator, ops_viewer" />
        <Input label="Reason (for audit)" value={accessReason} onChange={(e) => setAccessReason(e.target.value)} />
      </div>

      <div className="im-actions">
        <Button disabled={busy} variant="secondary" onClick={() => callApi(\`/v1/ops/access/users\`)}>권한 목록 조회</Button>
        <Button disabled={busy} variant="danger" onClick={() => callApi(\`/v1/ops/access/breakglass\`, { method: "POST", body: JSON.stringify({ reason: accessReason || "Emergency access" }) })}>Break-glass 활성화</Button>
        <Button disabled={busy || !accessTargetUid || !accessRole} onClick={() => callApi(\`/v1/ops/access/grant\`, { method: "POST", body: JSON.stringify({ targetUid: accessTargetUid, role: accessRole, reason: accessReason }) })}>권한 부여</Button>
        <Button disabled={busy || !accessTargetUid} variant="danger" onClick={() => callApi(\`/v1/ops/access/revoke\`, { method: "POST", body: JSON.stringify({ targetUid: accessTargetUid, reason: accessReason }) })}>권한 회수</Button>
      </div>

      {log && <pre className="im-log" style={{ marginTop: '2rem' }}>{log}</pre>}
    </div>
  );
}
`;
fs.writeFileSync(path.join(srcDir, 'pages', 'AccessControl.tsx'), accessControlCode);

const observabilityCode = `import React from "react";
import { Button } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function Observability() {
  const { busy, log, callApi } = useOpsApi();

  return (
    <div className="im-panel">
      <h2 className="im-panel-title">Observability</h2>
      
      <div className="im-actions">
        <Button disabled={busy} variant="secondary" onClick={() => callApi(\`/v1/ops/webhooks/dlq\`)}>DLQ 메시지 조회</Button>
        <Button disabled={busy} variant="secondary" onClick={() => callApi(\`/v1/ops/errors\`)}>시스템 에러 통계 조회</Button>
        <Button disabled={busy} variant="secondary" onClick={() => callApi(\`/v1/ops/ocr/stats\`)}>OCR 품질 지표 조회</Button>
        <Button disabled={busy} variant="secondary" onClick={() => callApi(\`/v1/ops/metrics/daily\`)}>일일 시스템 메트릭 조회</Button>
      </div>

      {log && <pre className="im-log" style={{ marginTop: '2rem' }}>{log}</pre>}
    </div>
  );
}
`;
fs.writeFileSync(path.join(srcDir, 'pages', 'Observability.tsx'), observabilityCode);

