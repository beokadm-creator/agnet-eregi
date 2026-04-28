import React, { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function AccessControl() {
  const { busy, data, error, callApi } = useOpsApi();
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
        <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/access/users`)}>권한 목록 조회</Button>
        <Button disabled={busy} variant="danger" onClick={() => callApi(`/v1/ops/access/breakglass`, { method: "POST", body: JSON.stringify({ reason: accessReason || "Emergency access" }) })}>Break-glass 활성화</Button>
        <Button disabled={busy || !accessTargetUid || !accessRole} onClick={() => callApi(`/v1/ops/access/grant`, { method: "POST", body: JSON.stringify({ targetUid: accessTargetUid, role: accessRole, reason: accessReason }) })}>권한 부여</Button>
        <Button disabled={busy || !accessTargetUid} variant="danger" onClick={() => callApi(`/v1/ops/access/revoke`, { method: "POST", body: JSON.stringify({ targetUid: accessTargetUid, reason: accessReason }) })}>권한 회수</Button>
      </div>

      {error && <pre className="im-log" style={{ marginTop: "2rem", background: "var(--error-light)", color: "var(--error)" }}>{error}</pre>}
      {!error && data && <pre className="im-log" style={{ marginTop: "2rem" }}>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
