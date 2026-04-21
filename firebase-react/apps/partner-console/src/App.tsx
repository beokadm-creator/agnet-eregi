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
  const [evidenceRequests, setEvidenceRequests] = useState<any[]>([]);
  
  const [newReqMessage, setNewReqMessage] = useState("");
  const [newReqItemCode, setNewReqItemCode] = useState("");
  const [newReqItemTitle, setNewReqItemTitle] = useState("");
  
  const [notificationSettings, setNotificationSettings] = useState<any>(null);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookSecret, setNewWebhookSecret] = useState("");

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
    setLog("케이스 및 알림 설정 불러오는 중...");
    try {
      const res = await apiGet("/v1/partner/cases");
      setCases(res.items || []);
      
      const notifyRes = await apiGet("/v1/partner/notification-settings");
      setNotificationSettings(notifyRes.settings);

      setLog("데이터 갱신됨.");
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function updateNotificationSettings(newSettings: any) {
    setBusy(true);
    setLog("알림 설정 업데이트 중...");
    try {
      const res = await apiPost("/v1/partner/notification-settings", newSettings);
      setNotificationSettings(res.settings);
      setLog("알림 설정 저장 완료");
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function addWebhook() {
    if (!newWebhookUrl) return;
    const newSettings = {
      ...notificationSettings,
      webhooks: [
        ...(notificationSettings.webhooks || []),
        { url: newWebhookUrl, secret: newWebhookSecret, enabled: true }
      ]
    };
    await updateNotificationSettings(newSettings);
    setNewWebhookUrl("");
    setNewWebhookSecret("");
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
      
      const reqRes = await apiGet(`/v1/partner/cases/${caseId}/evidence-requests`);
      setEvidenceRequests(reqRes.items || []);

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

  async function downloadPackage(pkgId: string) {
    if (!selectedCase) return;
    setBusy(true);
    setLog("패키지 다운로드 URL 발급 중...");
    try {
      const res = await apiPost(`/v1/partner/cases/${selectedCase.id}/packages/${pkgId}/download-url`, {});
      window.open(res.downloadUrl, "_blank");
      setLog(`다운로드 창 열림 (SHA256: ${res.checksumSha256})`);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function validatePackage(pkgId: string) {
    if (!selectedCase) return;
    setBusy(true);
    setLog("패키지 검증 중...");
    try {
      const res = await apiPost(`/v1/partner/cases/${selectedCase.id}/packages/${pkgId}/validate`, {});
      setLog(`검증 결과: ${res.validation.status.toUpperCase()}`);
      await loadCaseDetail(selectedCase.id);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function generateClosingReport() {
    if (!selectedCase) return;
    setBusy(true);
    setLog("Closing Report 생성 중...");
    try {
      const res = await apiPost(`/v1/partner/cases/${selectedCase.id}/reports/closing/generate`, {});
      setLog(`리포트 생성 완료 (SHA256: ${res.closingReport.checksumSha256})`);
      await loadCaseDetail(selectedCase.id);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadClosingReport() {
    if (!selectedCase) return;
    setBusy(true);
    setLog("Closing Report 다운로드 중...");
    try {
      const res = await apiPost(`/v1/partner/cases/${selectedCase.id}/reports/closing/download-url`, {});
      window.open(res.downloadUrl, "_blank");
      setLog(`다운로드 창 열림 (SHA256: ${res.checksumSha256})`);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function markCaseCompleted() {
    if (!selectedCase) return;
    const ok = window.confirm("케이스를 마감하시겠습니까? 이후 상태 변경이 제한될 수 있습니다.");
    if (!ok) return;
    
    setBusy(true);
    setLog("케이스 마감 처리 중...");
    try {
      await apiPost(`/v1/partner/cases/${selectedCase.id}/complete`, {});
      setLog("케이스 마감 완료");
      await loadCaseDetail(selectedCase.id);
      await loadCases();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function createEvidenceRequest() {
    if (!selectedCase || !newReqMessage || !newReqItemCode || !newReqItemTitle) return;
    setBusy(true);
    setLog("추가 서류 요청 생성 중...");
    try {
      await apiPost(`/v1/partner/cases/${selectedCase.id}/evidence-requests`, {
        messageToUserKo: newReqMessage,
        items: [{ code: newReqItemCode, titleKo: newReqItemTitle, required: true }]
      });
      setLog("추가 서류 요청 생성 완료");
      setNewReqMessage("");
      setNewReqItemCode("");
      setNewReqItemTitle("");
      await loadCaseDetail(selectedCase.id);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  const hasValidatedEvidence = evidences.some((e: any) => e.status === "validated");

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
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
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

            {/* Notification Settings */}
            {notificationSettings && (
              <div style={{ borderTop: "2px solid #eee", paddingTop: 16 }}>
                <h3 style={{ margin: "0 0 12px 0", color: "#00695c", fontSize: "1.1em" }}>알림 설정 (Webhooks)</h3>
                <div style={{ marginBottom: 12, fontSize: "0.9em" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <input 
                      type="checkbox" 
                      checked={notificationSettings.events?.packageReady}
                      onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, packageReady: e.target.checked } })}
                    />
                    Package Ready
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <input 
                      type="checkbox" 
                      checked={notificationSettings.events?.closingReportReady}
                      onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, closingReportReady: e.target.checked } })}
                    />
                    Closing Report Ready
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <input 
                      type="checkbox" 
                      checked={notificationSettings.events?.caseCompleted}
                      onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, caseCompleted: e.target.checked } })}
                    />
                    Case Completed
                  </label>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em" }}>웹훅 목록</h4>
                  {notificationSettings.webhooks?.map((w: any, idx: number) => (
                    <div key={idx} style={{ background: "#f5f5f5", padding: 8, borderRadius: 4, marginBottom: 8, fontSize: "0.85em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div><strong>URL:</strong> {w.url}</div>
                        {w.secret && <div><strong>Secret:</strong> ***</div>}
                      </div>
                      <button onClick={() => {
                        const newWebhooks = [...notificationSettings.webhooks];
                        newWebhooks.splice(idx, 1);
                        updateNotificationSettings({ ...notificationSettings, webhooks: newWebhooks });
                      }} style={{ background: "#d32f2f", color: "white", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}>삭제</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input 
                    placeholder="https://my-server.com/webhook" 
                    value={newWebhookUrl} 
                    onChange={e => setNewWebhookUrl(e.target.value)} 
                    style={{ padding: 6, fontSize: "0.85em" }} 
                  />
                  <input 
                    placeholder="Secret (optional)" 
                    value={newWebhookSecret} 
                    onChange={e => setNewWebhookSecret(e.target.value)} 
                    style={{ padding: 6, fontSize: "0.85em" }} 
                  />
                  <button onClick={addWebhook} disabled={busy || !newWebhookUrl} style={{ padding: "6px 12px", background: "#0277bd", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.9em" }}>
                    웹훅 추가
                  </button>
                </div>
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
                            {e.source === "user" && <span style={{ marginLeft: 4, fontSize: "0.8em", color: "#1976d2" }}>[User Upload]</span>}
                          </td>
                          <td style={{ padding: 8, borderBottom: "1px solid #eee", color: "#666" }}>{new Date(e.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Evidence Request */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1em", borderBottom: "1px solid #eee", paddingBottom: 8 }}>📨 추가 서류 요청 (Evidence Requests)</h3>
                
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <input 
                    placeholder="요청 메시지 (예: 여권 사본이 흐릿합니다)" 
                    value={newReqMessage} 
                    onChange={e => setNewReqMessage(e.target.value)} 
                    style={{ flex: 2, padding: 6, minWidth: 200 }} 
                  />
                  <input 
                    placeholder="항목 코드 (예: passport)" 
                    value={newReqItemCode} 
                    onChange={e => setNewReqItemCode(e.target.value)} 
                    style={{ flex: 1, padding: 6, minWidth: 100 }} 
                  />
                  <input 
                    placeholder="항목 제목 (예: 여권 사본)" 
                    value={newReqItemTitle} 
                    onChange={e => setNewReqItemTitle(e.target.value)} 
                    style={{ flex: 1, padding: 6, minWidth: 100 }} 
                  />
                  <button onClick={createEvidenceRequest} disabled={busy || !newReqMessage || !newReqItemCode || !newReqItemTitle} style={{ padding: "6px 12px", background: "#f57c00", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                    요청 생성
                  </button>
                </div>

                {evidenceRequests.length === 0 ? (
                  <div style={{ color: "#999", fontSize: "0.9em" }}>추가 서류 요청 내역이 없습니다.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {evidenceRequests.map(r => (
                      <div key={r.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 6, background: "#fafafa" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <div>
                            <span style={{ fontWeight: "bold", marginRight: 8 }}>{r.messageToUserKo}</span>
                            <span style={{ 
                              padding: "2px 6px", 
                              borderRadius: 4, 
                              fontSize: "0.8em", 
                              fontWeight: "bold",
                              background: r.status === "fulfilled" ? "#e8f5e9" : r.status === "cancelled" ? "#eee" : "#fff3e0",
                              color: r.status === "fulfilled" ? "#2e7d32" : r.status === "cancelled" ? "#666" : "#ef6c00"
                            }}>
                              {r.status.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.8em", color: "#666" }}>
                            ID: {r.id}
                          </div>
                        </div>
                        <ul style={{ margin: "4px 0 0 0", paddingLeft: 20, fontSize: "0.85em", color: "#555" }}>
                          {r.items.map((item: any, idx: number) => (
                            <li key={idx}>{item.titleKo} ({item.code}) - {item.required ? "필수" : "선택"}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 패키지(Package) 관리 */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: 8, marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: "1.1em" }}>📦 패키지 (Packages)</h3>
                  <button 
                    onClick={createPackage} 
                    disabled={busy || !hasValidatedEvidence} 
                    style={{ padding: "6px 12px", background: !hasValidatedEvidence ? "#ccc" : "#e65100", color: "white", border: "none", borderRadius: 4, cursor: !hasValidatedEvidence ? "not-allowed" : "pointer", fontWeight: "bold" }}
                    title={!hasValidatedEvidence ? "검증된(validated) 증거물이 필요합니다" : "검증된 증거물로 새 패키지 생성"}
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

                        {p.status === "ready" && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                              <button onClick={() => downloadPackage(p.id)} disabled={busy} style={{ display: "inline-block", padding: "6px 12px", background: "#4caf50", color: "white", textDecoration: "none", borderRadius: 4, fontSize: "0.9em", fontWeight: "bold", border: "none", cursor: busy ? "not-allowed" : "pointer" }}>
                                Download ZIP
                              </button>
                              {p.checksumSha256 && (
                                <div style={{ fontSize: "0.85em", color: "#333", display: "flex", gap: 8, alignItems: "center" }}>
                                  <span style={{ fontFamily: "monospace" }}>{p.checksumSha256}</span>
                                  <button
                                    onClick={() => navigator.clipboard?.writeText?.(p.checksumSha256)}
                                    style={{ background: "#eee", border: "1px solid #ccc", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.85em" }}
                                  >
                                    복사
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            {/* Validation Card */}
                            <div style={{ padding: 12, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 6 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <h4 style={{ margin: 0, fontSize: "1em", color: "#37474f" }}>✔️ Validation</h4>
                                <button onClick={() => validatePackage(p.id)} disabled={busy} style={{ background: "#0288d1", color: "white", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.85em" }}>
                                  Validate
                                </button>
                              </div>
                              {p.validation ? (
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <span style={{ 
                                      padding: "2px 6px", 
                                      borderRadius: 4, 
                                      fontSize: "0.85em", 
                                      fontWeight: "bold",
                                      background: p.validation.status === "pass" ? "#e8f5e9" : p.validation.status === "fail" ? "#ffebee" : "#eee",
                                      color: p.validation.status === "pass" ? "#2e7d32" : p.validation.status === "fail" ? "#c62828" : "#666"
                                    }}>
                                      {p.validation.status.toUpperCase()}
                                    </span>
                                    {p.validation.validatedAt && (
                                      <span style={{ fontSize: "0.8em", color: "#999" }}>{new Date(p.validation.validatedAt).toLocaleString()}</span>
                                    )}
                                  </div>
                                  {p.validation.missing && p.validation.missing.length > 0 && (
                                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.85em", color: "#c62828" }}>
                                      {p.validation.missing.map((m: any, i: number) => (
                                        <li key={i}>{m.messageKo} ({m.code})</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ) : (
                                <div style={{ fontSize: "0.85em", color: "#999" }}>검증되지 않음</div>
                              )}
                            </div>
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

              {/* Closing Report & Case Complete */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "2px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: "1.1em", color: "#37474f" }}>📄 Closing Report</h3>
                  <button onClick={markCaseCompleted} disabled={busy || selectedCase.status === "completed" || selectedCase.closingReport?.status !== "ready"} style={{ background: selectedCase.status === "completed" ? "#9e9e9e" : "#00695c", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: selectedCase.status === "completed" || selectedCase.closingReport?.status !== "ready" ? "not-allowed" : "pointer", fontWeight: "bold" }}>
                    Mark Case Completed
                  </button>
                </div>

                <div style={{ padding: 16, background: "#e8f5e9", borderRadius: 8, border: "1px solid #c8e6c9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <span style={{ fontWeight: "bold", marginRight: 8 }}>상태:</span>
                      <span style={{ 
                        padding: "2px 6px", 
                        borderRadius: 4, 
                        fontSize: "0.85em", 
                        fontWeight: "bold",
                        background: selectedCase.closingReport?.status === "ready" ? "#c8e6c9" : "#eee",
                        color: selectedCase.closingReport?.status === "ready" ? "#2e7d32" : "#666"
                      }}>
                        {selectedCase.closingReport?.status ? selectedCase.closingReport.status.toUpperCase() : "NOT_GENERATED"}
                      </span>
                    </div>
                    <button onClick={generateClosingReport} disabled={busy || selectedCase.status === "completed"} style={{ background: "#2e7d32", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: busy || selectedCase.status === "completed" ? "not-allowed" : "pointer", fontSize: "0.9em" }}>
                      Generate Report
                    </button>
                  </div>
                  
                  {selectedCase.closingReport?.status === "ready" && (
                    <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", background: "#fff", padding: 12, borderRadius: 6 }}>
                      <button onClick={downloadClosingReport} disabled={busy} style={{ display: "inline-block", padding: "6px 12px", background: "#0288d1", color: "white", textDecoration: "none", borderRadius: 4, fontSize: "0.9em", fontWeight: "bold", border: "none", cursor: busy ? "not-allowed" : "pointer" }}>
                        Download DOCX
                      </button>
                      {selectedCase.closingReport.checksumSha256 && (
                        <div style={{ fontSize: "0.85em", color: "#333", display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{selectedCase.closingReport.checksumSha256}</span>
                          <button
                            onClick={() => navigator.clipboard?.writeText?.(selectedCase.closingReport.checksumSha256)}
                            style={{ background: "#eee", border: "1px solid #ccc", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.85em" }}
                          >
                            복사
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
