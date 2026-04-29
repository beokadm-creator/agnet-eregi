import { useAppContext } from "../../context/AppContext";

export default function EvidenceRequestsManager() {
  const { evidenceRequests, selectedCase } = useAppContext();

  if (!selectedCase) return null;

  return (
    <div className="pc-card">
      <div className="pc-card-header" style={{ borderBottom: "1px solid var(--pc-border)", paddingBottom: 16, marginBottom: 16 }}>
        <h3 className="pc-card-title" style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📝</span> 추가 서류 요청
        </h3>
      </div>
      
      {evidenceRequests.length === 0 ? (
        <div style={{ color: "var(--pc-text-muted)", fontSize: 13, textAlign: "center", padding: 24 }}>서류 요청 내역이 없습니다.</div>
      ) : (
        <div style={{ border: "1px solid var(--pc-border)", borderRadius: "var(--pc-radius)", overflow: "hidden" }}>
          <table className="pc-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>요청 항목</th>
                <th>메시지</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {evidenceRequests?.map((req: any) => (
                <tr key={req.id}>
                  <td style={{ fontWeight: 600 }}>{req.itemTitle}</td>
                  <td style={{ color: "var(--pc-text-muted)", fontSize: 13 }}>{req.messageToUser}</td>
                  <td>
                    <span className={`pc-badge ${req.status === "fulfilled" ? "pc-badge-success" : "pc-badge-warning"}`}>
                      {req.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
