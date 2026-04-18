import { useState, useEffect } from "react";
import { apiGet, apiPost } from "../api";

export function CaseQueue({ onSelectCase }: { onSelectCase: (id: string) => void }) {
  const [cases, setCases] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const loadQueue = async () => {
    setBusy(true);
    try {
      const data = await apiGet("/v1/partner/cases?statuses=new,in_progress,waiting_partner,waiting_user");
      setCases(data.items || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const transition = async (caseId: string, to: string, reasonKo: string) => {
    setBusy(true);
    try {
      await apiPost(`/v1/cases/${caseId}/transition`, { to, reasonKo });
      await loadQueue();
    } catch (e: any) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>케이스 큐</h2>
        <button disabled={busy} onClick={loadQueue} style={{ padding: "4px 8px", fontSize: 12 }}>새로고침</button>
      </div>

      {cases.length === 0 ? (
        <div style={{ color: "#666", fontSize: 14 }}>케이스가 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cases.map((c) => (
            <div key={c.id} style={{ border: "1px solid #eee", padding: 8, borderRadius: 6, fontSize: 14 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.id}</div>
              <div style={{ color: "#555", marginBottom: 8 }}>상태: {c.status}</div>
              
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button 
                  onClick={() => onSelectCase(c.id)} 
                  style={{ background: "#1890ff", color: "#fff", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}
                >
                  작업 열기
                </button>
                {c.status === "new" && (
                  <button onClick={() => transition(c.id, "in_progress", "수락")} style={{ padding: "4px 8px" }}>수락</button>
                )}
                {c.status === "waiting_user" && (
                  <button onClick={() => transition(c.id, "in_progress", "보완완료")} style={{ padding: "4px 8px" }}>진행</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
