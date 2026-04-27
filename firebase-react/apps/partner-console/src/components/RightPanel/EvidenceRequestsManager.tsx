import React from "react";
import { useAppContext } from "../../context/AppContext";

export default function EvidenceRequestsManager() {
  const { evidenceRequests, selectedCase } = useAppContext();

  if (!selectedCase) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1em", borderBottom: "1px solid #eee", paddingBottom: 8 }}>📝 추가 서류 요청 (Evidence Requests)</h3>
      {/* ... simplified for now ... */}
      {evidenceRequests.length === 0 ? (
        <div style={{ color: "#999", fontSize: "0.9em" }}>서류 요청 내역이 없습니다.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>요청 항목</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>메시지</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {evidenceRequests.map((req: any) => (
              <tr key={req.id}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: "bold" }}>{req.itemTitle}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", color: "#555" }}>{req.messageToUser}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: "0.85em", fontWeight: "bold", background: req.status === "fulfilled" ? "#e8f5e9" : "#fff3e0", color: req.status === "fulfilled" ? "#2e7d32" : "#ef6c00" }}>
                    {req.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
