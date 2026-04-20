import React, { useState, useEffect } from "react";

function App() {
  const [token, setToken] = useState("");
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  
  const [newType, setNewType] = useState("");
  const [newPayload, setNewPayload] = useState("");
  const [submitNow, setSubmitNow] = useState(false);
  
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const t = localStorage.getItem("user_token");
    if (t) setToken(t);
  }, []);

  function handleSaveToken(t: string) {
    setToken(t);
    localStorage.setItem("user_token", t);
  }

  async function apiGet(path: string) {
    const res = await fetch(path, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || "API Error");
    return data.data;
  }

  async function apiPost(path: string, body: any) {
    const res = await fetch(path, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || "API Error");
    return data.data;
  }

  async function loadSubmissions() {
    setBusy(true);
    setLog("제출 목록 불러오는 중...");
    try {
      const res = await apiGet("/v1/user/submissions");
      setSubmissions(res.items || []);
      setLog("제출 목록 갱신됨.");
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function createSubmission() {
    if (!newType || !newPayload) return;
    setBusy(true);
    setLog("새 제출 생성 중...");
    try {
      let payloadObj = {};
      try {
        payloadObj = JSON.parse(newPayload);
      } catch(e) {
        payloadObj = { rawText: newPayload };
      }

      const res = await apiPost("/v1/user/submissions", { 
        inputType: newType,
        payload: payloadObj,
        submitNow
      });
      setLog(`생성 완료: ${res.submission.id}`);
      setNewType("");
      setNewPayload("");
      await loadSubmissions();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadSubDetail(id: string) {
    setBusy(true);
    setLog(`상세 정보 불러오는 중...`);
    try {
      const subRes = await apiGet(`/v1/user/submissions/${id}`);
      setSelectedSub(subRes.submission);
      
      const evRes = await apiGet(`/v1/user/submissions/${id}/events`);
      setEvents(evRes.items || []);
      
      setLog(`상세 정보 로드 완료`);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function submitSubmission(id: string) {
    setBusy(true);
    setLog("제출 처리 중...");
    try {
      await apiPost(`/v1/user/submissions/${id}/submit`, {});
      setLog("제출 완료");
      await loadSubDetail(id);
      await loadSubmissions();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function cancelSubmission(id: string) {
    setBusy(true);
    setLog("취소 처리 중...");
    try {
      const res = await apiPost(`/v1/user/submissions/${id}/cancel`, {});
      setLog(`취소 성공: ${res.message}`);
      await loadSubDetail(id);
      await loadSubmissions();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: 20, maxWidth: 1000, margin: "0 auto", background: "#fdfdfd" }}>
      <h1 style={{ color: "#3f51b5" }}>User Web Console</h1>
      
      <div style={{ marginBottom: 20, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #ddd", display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ fontWeight: "bold" }}>User Token:</label>
        <input 
          value={token} 
          onChange={e => handleSaveToken(e.target.value)} 
          style={{ flex: 1, padding: 8, borderRadius: 4, border: "1px solid #ccc" }} 
          placeholder="Firebase Auth Token" 
        />
        <button onClick={loadSubmissions} disabled={busy || !token} style={{ padding: "8px 16px", background: "#3f51b5", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
          인증 및 데이터 로드
        </button>
      </div>

      <div style={{ marginBottom: 20, padding: 12, background: "#e8eaf6", borderRadius: 8, color: "#1a237e", fontSize: "0.9em" }}>
        <strong>Log:</strong> {log}
      </div>

      {token && (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          
          {/* Submission List */}
          <div style={{ flex: 1, background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #ddd" }}>
            <h2 style={{ margin: "0 0 16px 0", color: "#3f51b5", fontSize: "1.2em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              내 제출 목록
              <button onClick={loadSubmissions} disabled={busy} style={{ background: "#eee", border: "1px solid #ccc", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.8em" }}>새로고침</button>
            </h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
              <input 
                value={newType} 
                onChange={e => setNewType(e.target.value)} 
                placeholder="유형 (예: visa_application)" 
                style={{ padding: 6 }} 
              />
              <textarea 
                value={newPayload} 
                onChange={e => setNewPayload(e.target.value)} 
                placeholder="Payload (JSON or text)" 
                style={{ padding: 6, height: 60 }} 
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>
                  <input type="checkbox" checked={submitNow} onChange={e => setSubmitNow(e.target.checked)} />
                  즉시 제출 (Draft 건너뛰기)
                </label>
                <button onClick={createSubmission} disabled={busy || !newType || !newPayload} style={{ padding: "6px 12px", background: "#3949ab", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>새로 만들기</button>
              </div>
            </div>

            {submissions.length === 0 ? (
              <div style={{ color: "#999", textAlign: "center", padding: 20 }}>제출 내역이 없습니다.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {submissions.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => loadSubDetail(s.id)}
                    style={{ 
                      padding: 12, 
                      border: "1px solid #eee", 
                      borderRadius: 6, 
                      cursor: "pointer",
                      background: selectedSub?.id === s.id ? "#e8eaf6" : "#fafafa",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold" }}>{s.input?.type}</div>
                      <div style={{ fontSize: "0.8em", color: "#666" }}>{new Date(s.updatedAt).toLocaleString()}</div>
                    </div>
                    <span style={{ 
                      padding: "4px 8px", 
                      borderRadius: 12, 
                      fontSize: "0.8em", 
                      fontWeight: "bold",
                      background: ["completed"].includes(s.status) ? "#e8f5e9" : ["failed", "cancelled", "cancel_requested"].includes(s.status) ? "#ffebee" : "#e3f2fd",
                      color: ["completed"].includes(s.status) ? "#2e7d32" : ["failed", "cancelled", "cancel_requested"].includes(s.status) ? "#c62828" : "#1565c0"
                    }}>
                      {s.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submission Detail */}
          {selectedSub && (
            <div style={{ flex: 2, background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #ddd" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h2 style={{ margin: "0 0 4px 0", color: "#3f51b5", fontSize: "1.4em" }}>유형: {selectedSub.input?.type}</h2>
                  <div style={{ fontSize: "0.85em", color: "#666" }}>ID: {selectedSub.id}</div>
                  {selectedSub.caseId && <div style={{ fontSize: "0.85em", color: "#1565c0", fontWeight: "bold" }}>Case 연동됨: {selectedSub.caseId}</div>}
                </div>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ fontWeight: "bold", padding: "4px 8px", borderRadius: 4, background: "#eee" }}>
                    상태: {selectedSub.status.toUpperCase()}
                  </div>
                  
                  {selectedSub.status === "draft" && (
                    <button onClick={() => submitSubmission(selectedSub.id)} disabled={busy} style={{ background: "#4caf50", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                      제출하기 (Submit)
                    </button>
                  )}

                  {["draft", "submitted", "processing"].includes(selectedSub.status) && (
                    <button onClick={() => cancelSubmission(selectedSub.id)} disabled={busy} style={{ background: "#d32f2f", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: "0.9em" }}>
                      제출 취소
                    </button>
                  )}
                  
                  <button 
                    onClick={() => loadSubDetail(selectedSub.id)} 
                    disabled={busy} 
                    style={{ background: "transparent", color: "#1976d2", border: "none", cursor: "pointer", fontSize: "0.85em", textDecoration: "underline" }}
                  >
                    새로고침
                  </button>
                </div>
              </div>

              {/* 입력 데이터 */}
              <div style={{ marginBottom: 24, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "1em", color: "#333" }}>📝 입력 정보 (Payload)</h3>
                <pre style={{ margin: 0, fontSize: "0.85em", whiteSpace: "pre-wrap", color: "#555" }}>
                  {JSON.stringify(selectedSub.input?.payload, null, 2)}
                </pre>
              </div>

              {/* 결과 (완료/실패) */}
              {selectedSub.result && (
                <div style={{ marginBottom: 24, padding: 12, background: selectedSub.status === "completed" ? "#e8f5e9" : "#ffebee", borderRadius: 6, border: `1px solid ${selectedSub.status === "completed" ? "#a5d6a7" : "#ef9a9a"}` }}>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "1em", color: selectedSub.status === "completed" ? "#2e7d32" : "#c62828" }}>
                    {selectedSub.status === "completed" ? "✅ 처리 결과" : "❌ 처리 실패"}
                  </h3>
                  
                  {selectedSub.result.summary && (
                    <div style={{ marginBottom: 8, fontSize: "0.95em" }}>{selectedSub.result.summary}</div>
                  )}

                  {selectedSub.result.artifactUrl && (
                    <div style={{ marginTop: 8 }}>
                      <a href={selectedSub.result.artifactUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", padding: "6px 12px", background: "#388e3c", color: "white", textDecoration: "none", borderRadius: 4, fontSize: "0.9em", fontWeight: "bold" }}>
                        ⬇️ 결과 문서 다운로드
                      </a>
                    </div>
                  )}

                  {selectedSub.result.error && (
                    <div style={{ fontSize: "0.9em", color: "#c62828" }}>
                      <strong>[{selectedSub.result.error.category}]</strong> {selectedSub.result.error.message}
                    </div>
                  )}
                </div>
              )}

              {/* 진행 이벤트 타임라인 */}
              <div>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1em", borderBottom: "1px solid #eee", paddingBottom: 8 }}>⏱️ 진행 타임라인</h3>
                
                {events.length === 0 ? (
                  <div style={{ color: "#999", fontSize: "0.9em" }}>기록된 이벤트가 없습니다.</div>
                ) : (
                  <div style={{ position: "relative", paddingLeft: 16, borderLeft: "2px solid #e0e0e0", marginLeft: 8 }}>
                    {events.map((ev, i) => (
                      <div key={ev.id} style={{ position: "relative", marginBottom: 16 }}>
                        {/* 타임라인 노드 마커 */}
                        <div style={{ position: "absolute", left: -21, top: 4, width: 10, height: 10, borderRadius: "50%", background: ["completed"].includes(ev.type) ? "#4caf50" : ["failed", "cancelled"].includes(ev.type) ? "#f44336" : "#3f51b5", border: "2px solid #fff" }} />
                        
                        <div style={{ fontSize: "0.85em", color: "#999", marginBottom: 2 }}>{new Date(ev.createdAt).toLocaleString()}</div>
                        <div style={{ fontWeight: "bold", color: "#333", marginBottom: 4 }}>{ev.type.toUpperCase()}</div>
                        <div style={{ fontSize: "0.95em", color: "#555", background: "#f9f9f9", padding: 8, borderRadius: 4 }}>{ev.message}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                {selectedSub.status === "processing" && (
                  <div style={{ marginTop: 12, paddingLeft: 24, fontSize: "0.9em", color: "#1976d2", fontWeight: "bold", fontStyle: "italic" }}>
                    ⚙️ 현재 처리 중입니다. 잠시 후 새로고침 해주세요...
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;