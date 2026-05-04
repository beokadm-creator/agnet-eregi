import { useAppContext } from "../../context/AppContext";

export default function PackagesManager() {
  const { packages, selectedCase } = useAppContext();

  if (!selectedCase) return null;

  return (
    <div className="pc-card">
      <div className="pc-card-header" style={{ borderBottom: "1px solid var(--pc-border)", paddingBottom: 16, marginBottom: 16 }}>
        <h3 className="pc-card-title" style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📦</span> 패키지 (제출용 통합문서)
        </h3>
      </div>

      {packages.length === 0 ? (
        <div style={{ color: "var(--pc-text-muted)", fontSize: 13, textAlign: "center", padding: 24 }}>생성된 패키지가 없습니다.</div>
      ) : (
        <div style={{ border: "1px solid var(--pc-border)", borderRadius: "var(--pc-radius)", overflow: "hidden" }}>
          <table className="pc-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>파일명</th>
                <th>상태</th>
                <th>생성일</th>
              </tr>
            </thead>
            <tbody>
              {packages?.map((p: any) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.filename}</td>
                  <td>
                    <span className={`pc-badge ${p.status === 'completed' ? 'pc-badge-success' : 'pc-badge-neutral'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="pc-mono" style={{ fontSize: 12, color: "var(--pc-text-muted)" }}>{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
