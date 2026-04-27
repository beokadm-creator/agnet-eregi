import React, { useState } from "react";
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
      <h2 style={{ margin: "0 0 16px 0", color: "#00695c", fontSize: "1.2em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        내 케이스 목록
        <Button onClick={loadCases} disabled={busy} style={{ background: "#eee", border: "1px solid #ccc", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.8em" }}>새로고침</Button>
      </h2>
      
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Input value={newCaseTitle} onChange={e => setNewCaseTitle(e.target.value)} placeholder="새 케이스 제목" style={{ flex: 1, padding: 6 }} />
        <Button onClick={createCase} disabled={busy || !newCaseTitle} style={{ padding: "6px 12px", background: "#00897b", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>생성</Button>
      </div>

      {cases.length === 0 ? (
        <div style={{ color: "#999", textAlign: "center", padding: 20 }}>케이스가 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {cases.map(c => (
            <div 
              key={c.id} 
              onClick={() => loadCaseDetail(c.id)}
              style={{ padding: 12, border: "1px solid #eee", borderRadius: 6, cursor: "pointer", background: selectedCase?.id === c.id ? "#e0f2f1" : "#fafafa", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <div>
                <div style={{ fontWeight: "bold" }}>{c.title}</div>
                <div style={{ fontSize: "0.8em", color: "#666" }}>{new Date(c.createdAt).toLocaleString()}</div>
              </div>
              <span style={{ padding: "4px 8px", borderRadius: 12, fontSize: "0.8em", fontWeight: "bold", background: c.status === "draft" ? "#eee" : c.status === "ready" ? "#e8f5e9" : c.status === "failed" ? "#ffebee" : "#fff3e0", color: c.status === "draft" ? "#666" : c.status === "ready" ? "#2e7d32" : c.status === "failed" ? "#c62828" : "#ef6c00" }}>
                {statusText[c.status] || c.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
