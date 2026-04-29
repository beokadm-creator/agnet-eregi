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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, background: "var(--pc-surface)", padding: 24, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
      <div>
        <h2 style={{ margin: "0 0 8px 0", color: "var(--pc-text)", fontSize: 24, fontWeight: 700 }}>{selectedCase.title}</h2>
        <div className="pc-mono" style={{ fontSize: 13, color: "var(--pc-text-muted)", marginBottom: 8 }}>ID: {selectedCase.id}</div>
        {selectedCase.submissionId && (
          <div style={{ fontSize: 13, color: "var(--pc-brand)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🔗</span> 원본 User Submission 연동됨: <span className="pc-mono">{selectedCase.submissionId}</span>
          </div>
        )}
        <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
          {lastPolledAt && (
            <span style={{ fontSize: 12, color: "var(--pc-text-muted)" }}>
              마지막 갱신: {lastPolledAt.toLocaleTimeString()}
            </span>
          )}
          {pollError && (
            <span style={{ fontSize: 12, color: "var(--pc-danger)", background: "var(--pc-danger-soft)", padding: "4px 8px", borderRadius: 4, fontWeight: 600 }}>
              ⚠️ 연결 오류
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "var(--pc-text-muted)", fontWeight: 600 }}>상태:</span>
          <span className="pc-badge pc-badge-brand" style={{ fontSize: 14 }}>{statusText[selectedCase.status] || selectedCase.status.toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button 
            onClick={() => loadCaseDetail(selectedCase.id)} 
            disabled={busy} 
            className="pc-btn"
          >
            상세 새로고침
          </button>
          <button 
            onClick={() => setSelectedCase(null)} 
            className="pc-btn"
          >
            뒤로가기
          </button>
        </div>
      </div>
    </div>
  );
}
