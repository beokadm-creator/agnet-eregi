import React from "react";
import { useAppContext } from "../../context/AppContext";

export default function PackagesManager() {
  const { packages, selectedCase } = useAppContext();

  if (!selectedCase) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1em", borderBottom: "1px solid #eee", paddingBottom: 8 }}>📦 패키지물 (Packages)</h3>
      {packages.length === 0 ? (
        <div style={{ color: "#999", fontSize: "0.9em" }}>생성된 패키지물이 없습니다.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>파일 링크</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>상태</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>생성일</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((p: any) => (
              <tr key={p.id}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{p.filename}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{p.status}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{new Date(p.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
