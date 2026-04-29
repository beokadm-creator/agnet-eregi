import React, { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function AccessControl() {
  const { busy, data, error, callApi } = useOpsApi();
  const [accessTargetUid, setAccessTargetUid] = useState("");
  const [accessRole, setAccessRole] = useState("ops_operator");
  const [accessReason, setAccessReason] = useState("");
  const [partnerTargetUid, setPartnerTargetUid] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [partnerRole, setPartnerRole] = useState("member");
  const [partnerApprove, setPartnerApprove] = useState(true);
  const [partnerReason, setPartnerReason] = useState("");

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

      <div style={{ height: 1, background: "var(--ar-hairline)", margin: "2rem 0" }} />

      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--ar-ink)" }}>Partner Access</h3>

      <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem', marginBottom: '2rem' }}>
        <Input label="Target UID" value={partnerTargetUid} onChange={(e) => setPartnerTargetUid(e.target.value)} />
        <Input label="Partner ID" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} placeholder="partners/{partnerId}" />
        <Input label="Partner Role" value={partnerRole} onChange={(e) => setPartnerRole(e.target.value)} placeholder="owner, admin, member" />
        <Input label="Approve Partner (true/false)" value={String(partnerApprove)} onChange={(e) => setPartnerApprove(e.target.value === "true")} />
        <Input label="Reason (for audit)" value={partnerReason} onChange={(e) => setPartnerReason(e.target.value)} />
      </div>

      <div className="im-actions">
        <Button
          disabled={busy || !partnerTargetUid || !partnerId || !partnerRole || !partnerReason}
          onClick={() => callApi(`/v1/ops/access/partner/grant`, { method: "POST", body: JSON.stringify({ targetUid: partnerTargetUid, partnerId, partnerRole, approvePartner: partnerApprove, reason: partnerReason }) })}
        >
          파트너 권한 부여
        </Button>
        <Button
          disabled={busy || !partnerTargetUid || !partnerReason}
          variant="danger"
          onClick={() => callApi(`/v1/ops/access/partner/revoke`, { method: "POST", body: JSON.stringify({ targetUid: partnerTargetUid, reason: partnerReason }) })}
        >
          파트너 권한 회수
        </Button>
      </div>

      {error && <pre className="im-log" style={{ marginTop: "2rem", background: "var(--ar-danger-soft)", color: "var(--ar-danger)" }}>{error}</pre>}
      {!error && data && <pre className="im-log" style={{ marginTop: "2rem" }}>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
