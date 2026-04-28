import { useAppContext } from "../../context/AppContext";

export default function B2gSubmissions() {
  const { b2gSubmissions, selectedCase } = useAppContext();

  if (!selectedCase) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1em", borderBottom: "1px solid #eee", paddingBottom: 8 }}>🏛️ 공공기관 제출 내역 (B2G)</h3>
      {b2gSubmissions.length === 0 ? (
        <div style={{ color: "#999", fontSize: "0.9em" }}>제출 내역이 없습니다.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>기관</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>접수번호</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {b2gSubmissions.map((s: any) => (
              <tr key={s.id}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: "bold" }}>{s.agency || s.agencyType || "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{s.receiptNumber || "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
