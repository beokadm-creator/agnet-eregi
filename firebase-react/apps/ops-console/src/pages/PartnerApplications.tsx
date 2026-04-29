import React from "react";
import { Button } from "@agentregi/ui-components";
import { useOpsApi } from "../hooks";

export default function PartnerApplications() {
  const { busy, data, error, callApi } = useOpsApi();
  const items: any[] = data?.items || [];

  async function refresh() {
    await callApi(`/v1/ops/partner-applications?status=pending&limit=100`);
  }

  async function approve(uid: string, bizName: string) {
    const partnerName = prompt("파트너 표시명(선택)", bizName || "");
    const reason = prompt("승인 메모(선택)") || "";
    await callApi(`/v1/ops/partner-applications/${encodeURIComponent(uid)}/approve`, {
      method: "POST",
      body: JSON.stringify({ partnerName: partnerName || bizName || "", reason }),
    });
    await refresh();
  }

  async function reject(uid: string) {
    const reason = prompt("거부 사유(선택)") || "";
    await callApi(`/v1/ops/partner-applications/${encodeURIComponent(uid)}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    await refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="ops-title">파트너 신청 검토</h1>
          <p className="ops-subtitle">대기 중인 파트너 신청 건들을 검토하고 승인합니다.</p>
        </div>
        <button className="ops-btn" onClick={refresh} disabled={busy}>
          {busy ? "갱신 중..." : "↻ 새로고침"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "var(--ops-danger-soft)", color: "var(--ops-danger)", borderRadius: "var(--ops-radius)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Applications list */}
      {!error && (
        <div className="ops-panel">
          <div className="ops-panel-header">
            <h2 className="ops-panel-title">대기 중인 신청 목록</h2>
            <span className="ops-badge ops-badge-brand">{items.length}</span>
          </div>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>상호명</th>
                  <th>신청자 계정</th>
                  <th>담당자 및 연락처</th>
                  <th>사업자번호</th>
                  <th>추가 메모</th>
                  <th style={{ textAlign: "right" }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--ops-text-muted)" }}>
                      대기 중인 신청이 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map((it: any) => (
                    <tr key={it.id}>
                      <td style={{ fontWeight: 600 }}>{it.bizName || "이름 없음"}</td>
                      <td className="ops-mono">{it.email || it.id}</td>
                      <td>
                        {it.contactName || "-"}
                        <div style={{ color: "var(--ops-text-muted)", marginTop: 2 }}>{it.contactPhone || "-"}</div>
                      </td>
                      <td className="ops-mono">{it.bizRegNo || "-"}</td>
                      <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.note}>
                        {it.note || "-"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button className="ops-btn ops-btn-brand" disabled={busy} onClick={() => approve(it.id, it.bizName || "")}>승인</button>
                          <button className="ops-btn ops-btn-danger" disabled={busy} onClick={() => reject(it.id)}>거부</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
