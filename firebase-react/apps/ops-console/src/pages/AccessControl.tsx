import React, { useState } from "react";
import { useOpsApi } from "../hooks";

export default function AccessControl() {
  const { busy, data, error, callApi } = useOpsApi();
  const [accessTargetUid, setAccessTargetUid] = useState("");
  const [accessRole, setAccessRole] = useState("ops_operator");
  const [accessReason, setAccessReason] = useState("");
  const [partnerTargetUid, setPartnerTargetUid] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [partnerRole, setPartnerRole] = useState("viewer");
  const [partnerApprove, setPartnerApprove] = useState(true);
  const [partnerReason, setPartnerReason] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="ops-title">권한 관리</h1>
          <p className="ops-subtitle">운영자 및 파트너 계정의 권한을 관리합니다. 모든 변경사항은 감사 로그에 기록됩니다.</p>
        </div>
      </div>

      {error && <div style={{ padding: "12px 16px", background: "var(--ops-danger-soft)", color: "var(--ops-danger)", borderRadius: "var(--ops-radius)", fontSize: 13 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Ops Roles */}
        <div className="ops-panel">
          <div className="ops-panel-header">
            <h2 className="ops-panel-title">운영자 권한 제어</h2>
          </div>
          <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>대상 UID</label>
              <input className="ops-input" value={accessTargetUid} onChange={(e) => setAccessTargetUid(e.target.value)} placeholder="Target user UID" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>역할 (Role)</label>
              <select className="ops-input" value={accessRole} onChange={(e) => setAccessRole(e.target.value)}>
                <option value="ops_admin">ops_admin (최고 관리자)</option>
                <option value="ops_operator">ops_operator (운영자)</option>
                <option value="ops_viewer">ops_viewer (뷰어)</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>사유 (Audit Log)</label>
              <input className="ops-input" value={accessReason} onChange={(e) => setAccessReason(e.target.value)} placeholder="사유를 입력하세요" />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button className="ops-btn" disabled={busy} onClick={() => callApi(`/v1/ops/access/users`)}>목록 조회</button>
              <button className="ops-btn ops-btn-brand" disabled={busy || !accessTargetUid || !accessRole} onClick={() => callApi(`/v1/ops/access/grant`, { method: "POST", body: JSON.stringify({ targetUid: accessTargetUid, role: accessRole, reason: accessReason }) })}>권한 부여</button>
              <button className="ops-btn ops-btn-danger" disabled={busy || !accessTargetUid} onClick={() => callApi(`/v1/ops/access/revoke`, { method: "POST", body: JSON.stringify({ targetUid: accessTargetUid, reason: accessReason }) })}>권한 회수</button>
            </div>
            <div style={{ borderTop: "1px solid var(--ops-border)", paddingTop: 16 }}>
              <button className="ops-btn ops-btn-danger" style={{ width: "100%", border: "1px solid var(--ops-danger)" }} disabled={busy} onClick={() => callApi(`/v1/ops/access/breakglass`, { method: "POST", body: JSON.stringify({ reason: accessReason || "Emergency access" }) })}>🚨 긴급 권한 활성화 (Breakglass)</button>
            </div>
          </div>
        </div>

        {/* Partner Roles */}
        <div className="ops-panel">
          <div className="ops-panel-header">
            <h2 className="ops-panel-title">파트너 권한 강제 주입</h2>
          </div>
          <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>대상 UID</label>
              <input className="ops-input" value={partnerTargetUid} onChange={(e) => setPartnerTargetUid(e.target.value)} placeholder="Target user UID" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>파트너 ID</label>
              <input className="ops-input" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} placeholder="예: partners/h6b9..." />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>역할 (Role)</label>
                <select className="ops-input" value={partnerRole} onChange={(e) => setPartnerRole(e.target.value)}>
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                  <option value="editor">editor</option>
                  <option value="viewer">viewer</option>
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>자동 승인</label>
                <select className="ops-input" value={String(partnerApprove)} onChange={(e) => setPartnerApprove(e.target.value === "true")}>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>사유 (Audit Log)</label>
              <input className="ops-input" value={partnerReason} onChange={(e) => setPartnerReason(e.target.value)} placeholder="사유를 입력하세요" />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="ops-btn ops-btn-brand" disabled={busy || !partnerTargetUid || !partnerId || !partnerRole || !partnerReason} onClick={() => callApi(`/v1/ops/access/partner/grant`, { method: "POST", body: JSON.stringify({ targetUid: partnerTargetUid, partnerId, partnerRole, approvePartner: partnerApprove, reason: partnerReason }) })}>부여</button>
              <button className="ops-btn ops-btn-danger" disabled={busy || !partnerTargetUid || !partnerReason} onClick={() => callApi(`/v1/ops/access/partner/revoke`, { method: "POST", body: JSON.stringify({ targetUid: partnerTargetUid, reason: partnerReason }) })}>회수</button>
            </div>
          </div>
        </div>
      </div>

      {data && (
        <div className="ops-panel">
          <div className="ops-panel-header">
            <h2 className="ops-panel-title">API 응답 결과</h2>
          </div>
          <div className="ops-panel-body">
            <pre className="ops-mono" style={{ margin: 0, fontSize: 12, color: "var(--ops-text-muted)", background: "var(--ops-bg)", padding: 12, borderRadius: "var(--ops-radius-sm)", border: "1px solid var(--ops-border)", overflowX: "auto" }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
