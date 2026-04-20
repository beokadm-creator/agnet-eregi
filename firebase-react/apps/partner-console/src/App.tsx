import React, { useState, useEffect } from "react";

function App() {
  const [token, setToken] = useState("");
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);

  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newEvidenceType, setNewEvidenceType] = useState("");
  const [newEvidenceFile, setNewEvidenceFile] = useState<File | null>(null);
  
  const [evidences, setEvidences] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);

  useEffect(() => {
    const t = localStorage.getItem("partner_token");
    if (t) setToken(t);
  }, []);

  function handleSaveToken(t: string) {
    setToken(t);
    localStorage.setItem("partner_token", t);
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

  async function loadCases() {
    setBusy(true);
    setLog("케이스 목록 불러오는 중...");
    try {
      const res = await apiGet("/v1/partner/cases");
      setCases(res.items || []);
      setLog("케이스 목록 갱신됨.");
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function createCase() {
    if (!newCaseTitle) return;
    setBusy(true);
    setLog("케이스 생성 중...");
    try {
      const res = await apiPost("/v1/partner/cases", { title: newCaseTitle });
      setLog(`케이스 생성 완료: ${res.case.id}`);
      setNewCaseTitle("");
      await loadCases();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadCaseDetail(caseId: string) {
    setBusy(true);
    setLog(`케이스 상세 정보 불러오는 중...`);
    try {
      const caseRes = await apiGet(`/v1/partner/cases/${caseId}`);
      setSelectedCase(caseRes.case);
      
      const evRes = await apiGet(`/v1/partner/cases/${caseId}/evidences`);
      setEvidences(evRes.items || []);
      
      const pkgRes = await apiGet(`/v1/partner/cases/${caseId}/packages`);
      setPackages(pkgRes.items || []);
      
      setLog(`케이스 상세 정보 로드 완료`);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function addEvidence() {
    if (!selectedCase || !newEvidenceType || !newEvidenceFile) return;
    setBusy(true);
    setLog("증거 파일 업로드 중...");
    try {
      // 1. 업로드 URL 발급
      const { uploadUrl, evidenceId } = await apiPost(`/v1/partner/cases/${selectedCase.id}/evidences/upload-url`, {
        type: newEvidenceType,
        filename: newEvidenceFile.name,
        contentType: newEvidenceFile.type,
        sizeBytes: newEvidenceFile.size
      });
      setLog("업로드 URL 발급됨. 파일 전송 시작...");

      // 2. 파일 업로드 (PUT)
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": newEvidenceFile.type
        },
        body: newEvidenceFile
      });
      if (!putRes.ok) throw new Error("Storage 업로드에 실패했습니다.");

      // 3. 업로드 완료 확정
      setLog("파일 전송 완료. 확정 처리 중...");
      await apiPost(`/v1/partner/cases/${selectedCase.id}/evidences/${evidenceId}/complete`, {});
      
      setLog("증거 파일 업로드 및 확정 완료");
      setNewEvidenceType("");
      setNewEvidenceFile(null);
      await loadCaseDetail(selectedCase.id);
      await loadCases();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadEvidence(evidenceId: string) {
    if (!selectedCase) return;
    setBusy(true);
    setLog("다운로드 URL 발급 중...");
    try {
      const res = await apiPost(`/v1/partner/cases/${selectedCase.id}/evidences/${evidenceId}/download-url`, {});
      window.open(res.downloadUrl, "_blank");
      setLog("다운로드 창 열림");
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function createPackage() {
    if (!selectedCase) return;
    setBusy(true);
    setLog("패키지 생성 요청 중...");
    try {
      await apiPost(`/v1/partner/cases/${selectedCase.id}/packages`, {});
      setLog("패키지 생성 요청 완료. 잠시 후 새로고침하세요.");
      await loadCaseDetail(selectedCase.id);
      await loadCases(); // 상태가 packaging으로 바뀜
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function regeneratePackage(pkgId: string) {
    if (!selectedCase) return;
    setBusy(true);
    setLog("패키지 재생성 요청 중...");
    try {
      await apiPost(`/v1/partner/cases/${selectedCase.id}/packages/${pkgId}/regenerate`, {});
      setLog("패키지 재생성 요청 완료. 잠시 후 새로고침하세요.");
      await loadCaseDetail(selectedCase.id);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: 20, maxWidth: 1000, margin: "0 auto", background: "#fafafa" }}>
      <h1 style={{ color: "#00695c" }}>AgentRegi Partner Console</h1>
      
      <div style={{ marginBottom: 20, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #ddd", display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ fontWeight: "bold" }}>Partner Token:</label>
        <input 
          value={token} 
          onChange={e => handleSaveToken(e.target.value)} 
          style={{ flex: 1, padding: 8, borderRadius: 4, border: "1px solid #ccc" }} 
          placeholder="Firebase Auth Token (custom claims: { partnerId: 'xxx' })" 
        />
        <button onClick={loadCases} disabled={busy || !token} style={{ padding: "8px 16px", background: "#00695c", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
          인증 및 데이터 로드
        </button>
      </div>

      <div style={{ marginBottom: 20, padding: 12, background: "#e0f2f1", borderRadius: 8, color: "#004d40", fontSize: "0.9em" }}>
        <strong>Log:</strong> {log}
      </div>

      {token && (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          
          {/* Case List */}
          <div style={{ flex: 1, background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #ddd" }}>
            <h2 style={{ margin: "0 0 16px 0", color: "#00695c", fontSize: "1.2em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              내 케이스 목록
              <button onClick={loadCases} disabled={busy} style={{ background: "#eee", border: "1px solid #ccc", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.8em" }}>새로고침</button>
            </h2>
            
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input 
                value={newCaseTitle} 
                onChange={e => setNewCaseTitle(e.target.value)} 
                placeholder="새 케이스 제목" 
                style={{ flex: 1, padding: 6 }} 
              />
              <button onClick={createCase} disabled={busy || !newCaseTitle} style={{ padding: "6px 12px", background: "#00897b", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>생성</button>
            </div>

            {cases.length === 0 ? (
              <div style={{ color: "#999", textAlign: "center", padding: 20 }}>케이스가 없습니다.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cases.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => loadCaseDetail(c.id)}
                    style={{ 
                      padding: 12, 
                      border: "1px solid #eee", 
                      borderRadius: 6, 
                      cursor: "pointer",
                      background: selectedCase?.id === c.id ? "#e0f2f1" : "#fafafa",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold" }}>{c.title}</div>
                      <div style={{ fontSize: "0.8em", color: "#666" }}>{new Date(c.createdAt).toLocaleString()}</div>
                    </div>
                    <span style={{ 
                      padding: "4px 8px", 
                      borderRadius: 12, 
                      fontSize: "0.8em", 
                      fontWeight: "bold",
                      background: c.status === "draft" ? "#eee" : c.status === "ready" ? "#e8f5e9" : c.status === "failed" ? "#ffebee" : "#fff3e0",
                      color: c.status === "draft" ? "#666" : c.status === "ready" ? "#2e7d32" : c.status === "failed" ? "#c62828" : "#ef6c00"
                    }}>
                      {c.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Case Detail */}
          {selectedCase && (
            <div style={{ flex: 2, background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #ddd" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h2 style={{ margin: "0 0 4px 0", color: "#00695c", fontSize: "1.4em" }}>{selectedCase.title}</h2>
                  <div style={{ fontSize: "0.85em", color: "#666" }}>ID: {selectedCase.id}</div>
                  {selectedCase.submissionId && (
                    <div style={{ fontSize: "0.85em", color: "#1565c0", fontWeight: "bold", marginTop: 4 }}>
                      🔗 원본 User Submission 연동됨: {selectedCase.submissionId}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: "bold", marginBottom: 4 }}>상태: {selectedCase.status.toUpperCase()}</div>
                  <button 
                    onClick={() => loadCaseDetail(selectedCase.id)} 
                    disabled={busy} 
                    style={{ background: "#eee", border: "1px solid #ccc", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.8em" }}
                  >
                    상세 새로고침
                  </button>
                </div>
              </div>

              {/* 증거(Evidence) 관리 */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1em", borderBottom: "1px solid #eee", paddingBottom: 8 }}>📁 증거물 (Evidences)</h3>
                
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <select value={newEvidenceType} onChange={e => setNewEvidenceType(e.target.value)} style={{ padding: 6 }}>
                    <option value="">-- 유형 선택 --</option>
                    <option value="passport">여권 사본</option>
                    <option value="bank_statement">은행 잔고 증명서</option>
                    <option value="business_license">사업자 등록증</option>
                  </select>
                  <input 
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/jpg"
                    onChange={e => setNewEvidenceFile(e.target.files?.[0] || null)} 
                    style={{ flex: 1, padding: 6 }} 
                  />
                  <button onClick={addEvidence} disabled={busy || !newEvidenceType || !newEvidenceFile} style={{ padding: "6px 12px", background: "#0277bd", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>업로드</button>
                </div>

                {evidences.length === 0 ? (
                  <div style={{ color: "#999", fontSize: "0.9em" }}>등록된 증거물이 없습니다.</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>유형</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>파일 링크</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>상태</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>등록일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidences.map(e => (
                        <tr key={e.id}>
                          <td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: "bold" }}>{e.type}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                            {e.status === "pending" ? (
                              <span style={{ color: "#999" }}>업로드 중...</span>
                            ) : (
                              <button onClick={() => downloadEvidence(e.id)} style={{ background: "transparent", border: "none", color: "#0288d1", textDecoration: "underline", cursor: "pointer", padding: 0 }}>
                                {e.filename || "다운로드"}
                              </button>
                            )}
                          </td>
                          <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                            <span style={{ 
                              background: e.status === "validated" ? "#e8f5e9" : e.status === "failed" ? "#ffebee" : "#fff3e0",
                              color: e.status === "validated" ? "#2e7d32" : e.status === "failed" ? "#c62828" : "#ef6c00",
                              padding: "2px 6px", borderRadius: 4, fontSize: "0.85em", fontWeight: "bold"
                            }}>
                              {e.status.toUpperCase()}
                            </span>
                            {e.scanStatus && <span style={{ marginLeft: 4, fontSize: "0.8em", color: "#666" }}>({e.scanStatus})</span>}
                          </td>
                          <td style={{ padding: 8, borderBottom: "1px solid #eee", color: "#666" }}>{new Date(e.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 패키지(Package) 관리 */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: 8, marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: "1.1em" }}>📦 패키지 (Packages)</h3>
                  <button 
                    onClick={createPackage} 
                    disabled={busy || evidences.length === 0} 
                    style={{ padding: "6px 12px", background: evidences.length === 0 ? "#ccc" : "#e65100", color: "white", border: "none", borderRadius: 4, cursor: evidences.length === 0 ? "not-allowed" : "pointer", fontWeight: "bold" }}
                    title={evidences.length === 0 ? "증거물을 먼저 추가하세요" : "현재 증거물들로 새 패키지 생성"}
                  >
                    패키지 생성 요청
                  </button>
                </div>

                {packages.length === 0 ? (
                  <div style={{ color: "#999", fontSize: "0.9em" }}>생성된 패키지가 없습니다.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {packages.map(p => (
                      <div key={p.id} style={{ background: "#fafafa", border: "1px solid #ddd", borderRadius: 6, padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <div>
                            <span style={{ fontWeight: "bold", marginRight: 8 }}>ID: {p.id}</span>
                            <span style={{ 
                              padding: "2px 6px", 
                              borderRadius: 4, 
                              fontSize: "0.8em", 
                              fontWeight: "bold",
                              background: p.status === "ready" ? "#e8f5e9" : p.status === "failed" ? "#ffebee" : "#fff8e1",
                              color: p.status === "ready" ? "#2e7d32" : p.status === "failed" ? "#c62828" : "#f57c00"
                            }}>
                              {p.status.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.8em", color: "#666" }}>
                            {new Date(p.createdAt).toLocaleString()}
                          </div>
                        </div>

                        {p.status === "ready" && p.artifactUrl && (
                          <div style={{ marginTop: 8 }}>
                            <a href={p.artifactUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", padding: "6px 12px", background: "#4caf50", color: "white", textDecoration: "none", borderRadius: 4, fontSize: "0.9em", fontWeight: "bold" }}>
                              ⬇️ 패키지 다운로드
                            </a>
                          </div>
                        )}

                        {p.status === "failed" && p.error && (
                          <div style={{ marginTop: 8, padding: 8, background: "#ffebee", borderRadius: 4, fontSize: "0.9em", color: "#c62828", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <strong>오류 ({p.error.category}):</strong> {p.error.message}
                            </div>
                            <button onClick={() => regeneratePackage(p.id)} disabled={busy} style={{ padding: "4px 8px", background: "#d32f2f", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
                              재시도
                            </button>
                          </div>
                        )}

                        {["queued", "building"].includes(p.status) && (
                          <div style={{ marginTop: 8, fontSize: "0.9em", color: "#f57c00" }}>
                            ⚙️ 패키지 빌드 작업이 진행 중입니다. 잠시 후 새로고침 해주세요.
                          </div>
                        )}
                      </div>
                    ))}
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