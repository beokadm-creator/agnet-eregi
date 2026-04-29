import { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
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
      <h2 style={{ margin: "0 0 16px 0", color: "var(--ar-accent)", fontSize: "1.2em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        내 케이스 목록
        <Button onClick={loadCases} disabled={busy} style={{ background: "var(--ar-surface-muted)", border: "1px solid var(--ar-fog)", padding: "4px 8px", borderRadius: "var(--ar-r1)", cursor: "pointer", fontSize: "0.8em" }}>새로고침</Button>
      </h2>
      
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Input value={newCaseTitle} onChange={e => setNewCaseTitle(e.target.value)} placeholder="새 케이스 제목" style={{ flex: 1, padding: 6 }} />
        <Button onClick={createCase} disabled={busy || !newCaseTitle} style={{ padding: "6px 12px", background: "var(--ar-accent)", color: "var(--ar-canvas)", border: "none", borderRadius: "var(--ar-r1)", cursor: "pointer" }}>생성</Button>
      </div>

      {cases.length === 0 ? (
        <div style={{ color: "var(--ar-slate)", textAlign: "center", padding: 20 }}>케이스가 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {cases?.map(c => (
            <div 
              key={c.id} 
              onClick={() => loadCaseDetail(c.id)}
              style={{ padding: 12, border: "1px solid var(--ar-surface-muted)", borderRadius: "var(--ar-r1)", cursor: "pointer", background: selectedCase?.id === c.id ? "var(--ar-accent-soft)" : "var(--ar-paper-alt)", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <div>
                <div style={{ fontWeight: "bold" }}>{c.title}</div>
                <div style={{ fontSize: "0.8em", color: "var(--ar-graphite)" }}>{new Date(c.createdAt).toLocaleString()}</div>
              </div>
              <span style={{ padding: "4px 8px", borderRadius: "var(--ar-r2)", fontSize: "0.8em", fontWeight: "bold", background: c.status === "draft" ? "var(--ar-surface-muted)" : c.status === "ready" ? "var(--ar-success-soft)" : c.status === "failed" ? "var(--ar-danger-soft)" : "var(--ar-warning-soft)", color: c.status === "draft" ? "var(--ar-graphite)" : c.status === "ready" ? "var(--ar-success)" : c.status === "failed" ? "var(--ar-danger)" : "var(--ar-warning)" }}>
                {statusText[c.status] || c.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
