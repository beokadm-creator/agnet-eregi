import { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

export default function CaseList() {
  const { cases, selectedCase, loadCases, loadCaseDetail, busy, setBusy, setLog } = useAppContext();
  const [newCaseTitle, setNewCaseTitle] = useState("");

  const statusText: Record<string, string> = {
    draft: "작성중",
    collecting: "수집중",
    packaging: "패키징중",
    ready: "준비됨",
    failed: "실패",
    completed: "완료됨"
  };

  async function createCase() {
    if (!newCaseTitle) return;
    setBusy(true);
    setLog("케이스 생성 중...");
    try {
      const res = await getApi().post("/v1/partner/cases", { title: newCaseTitle });
      setLog(`케이스 생성 완료: ${res.case.id}`);
      setNewCaseTitle("");
      await loadCases();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "var(--pc-text)", fontSize: 16, fontWeight: 700 }}>
          내 케이스 목록
        </h2>
        <button onClick={loadCases} disabled={busy} className="pc-btn">새로고침</button>
      </div>
      
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input 
          className="pc-input"
          value={newCaseTitle} 
          onChange={e => setNewCaseTitle(e.target.value)} 
          placeholder="새 케이스 제목" 
        />
        <button onClick={createCase} disabled={busy || !newCaseTitle} className="pc-btn pc-btn-brand" style={{ whiteSpace: "nowrap" }}>
          생성
        </button>
      </div>

      {cases.length === 0 ? (
        <div style={{ color: "var(--pc-text-muted)", textAlign: "center", padding: 20, fontSize: 14 }}>케이스가 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24, overflowY: "auto", flex: 1 }}>
          {cases?.map(c => (
            <div 
              key={c.id} 
              onClick={() => loadCaseDetail(c.id)}
              style={{ 
                padding: 12, 
                border: "1px solid", 
                borderColor: selectedCase?.id === c.id ? "var(--pc-brand)" : "var(--pc-border)", 
                borderRadius: "var(--pc-radius)", 
                cursor: "pointer", 
                background: selectedCase?.id === c.id ? "var(--pc-surface-active)" : "var(--pc-surface)", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                transition: "all 0.2s ease"
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: selectedCase?.id === c.id ? "var(--pc-brand)" : "var(--pc-text)" }}>{c.title}</div>
                <div className="pc-mono" style={{ fontSize: 11, color: "var(--pc-text-muted)", marginTop: 4 }}>{new Date(c.createdAt).toLocaleString()}</div>
              </div>
              <span className={`pc-badge ${c.status === "draft" ? "pc-badge-neutral" : c.status === "ready" || c.status === "completed" ? "pc-badge-success" : c.status === "failed" ? "pc-badge-danger" : "pc-badge-brand"}`}>
                {statusText[c.status] || c.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
