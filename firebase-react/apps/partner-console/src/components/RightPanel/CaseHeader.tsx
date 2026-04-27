import React from "react";
import { useAppContext } from "../../context/AppContext";

export default function CaseHeader() {
  const { selectedCase, setSelectedCase, lastPolledAt, pollError, busy, loadCaseDetail } = useAppContext();

  if (!selectedCase) return null;

  const statusText: Record<string, string> = {
    draft: "작성중",
    collecting: "수집중",
    packaging: "패키징중",
    ready: "준비됨",
    failed: "실패",
    completed: "완료됨"
  };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div>
        <h2 style={{ margin: "0 0 4px 0", color: "#00695c", fontSize: "1.4em" }}>{selectedCase.title}</h2>
        <div style={{ fontSize: "0.85em", color: "#666" }}>ID: {selectedCase.id}</div>
        {selectedCase.submissionId && (
          <div style={{ fontSize: "0.85em", color: "#1565c0", fontWeight: "bold", marginTop: 4 }}>
            🔗 원본 User Submission 연동됨: {selectedCase.submissionId}
          </div>
        )}
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          {lastPolledAt && (
            <span style={{ fontSize: "0.8em", color: "#666" }}>
              마지막 갱신: {lastPolledAt.toLocaleTimeString()}
            </span>
          )}
          {pollError && (
            <span style={{ fontSize: "0.8em", color: "#c62828", background: "#ffebee", padding: "2px 6px", borderRadius: 4 }}>
              ⚠️ 연결 오류
            </span>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>상태: {statusText[selectedCase.status] || selectedCase.status.toUpperCase()}</div>
        <button 
          onClick={() => loadCaseDetail(selectedCase.id)} 
          disabled={busy} 
          style={{ background: "#eee", border: "1px solid #ccc", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.8em", marginRight: 8 }}
        >
          상세 새로고침
        </button>
        <button 
          onClick={() => setSelectedCase(null)} 
          style={{ background: "none", border: "1px solid #ccc", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.8em" }}
        >
          뒤로가기
        </button>
      </div>
    </div>
  );
}
