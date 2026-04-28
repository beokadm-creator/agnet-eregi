import { useAppContext } from "../../context/AppContext";

export default function EvidenceRequestsManager() {
  const { evidenceRequests, selectedCase } = useAppContext();

  if (!selectedCase) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1em", borderBottom: "1px solid var(--ar-surface-muted)", paddingBottom: 8 }}>📝 추가 서류 요청 (Evidence Requests)</h3>
      {evidenceRequests.length === 0 ? (
        <div style={{ color: "var(--ar-slate)", fontSize: "0.9em" }}>서류 요청 내역이 없습니다.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid var(--ar-hairline)" }}>요청 항목</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid var(--ar-hairline)" }}>메시지</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid var(--ar-hairline)" }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {evidenceRequests.map((req: any) => (
              <tr key={req.id}>
                <td style={{ padding: 8, borderBottom: "1px solid var(--ar-surface-muted)", fontWeight: "bold" }}>{req.itemTitle}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--ar-surface-muted)", color: "var(--ar-graphite)" }}>{req.messageToUser}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--ar-surface-muted)" }}>
                  <span style={{ padding: "2px 6px", borderRadius: "var(--ar-r1)", fontSize: "0.85em", fontWeight: "bold", background: req.status === "fulfilled" ? "var(--ar-success-soft)" : "var(--ar-warning-soft)", color: req.status === "fulfilled" ? "var(--ar-success)" : "var(--ar-warning)" }}>
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
