import React, { useState, useEffect } from "react";

declare global {
  interface Window {
    TossPayments: (clientKey: string) => any;
  }
}

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
  const [payment, setPayment] = useState<any | null>(null);
  const [packageChecksum, setPackageChecksum] = useState<string | null>(null);
  const [evidenceRequests, setEvidenceRequests] = useState<any[]>([]);
  const [uploadingRequestId, setUploadingRequestId] = useState<string | null>(null);

  const [notificationSettings, setNotificationSettings] = useState<any>(null);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookSecret, setNewWebhookSecret] = useState("");

  const statusText: Record<string, string> = {
    draft: "작성중",
    submitted: "제출됨",
    processing: "처리중",
    completed: "완료",
    failed: "실패",
    cancelled: "취소됨",
    cancel_requested: "취소요청됨"
  };

  useEffect(() => {
    // TossPayments SDK 로드
    if (!document.getElementById("toss-payments-sdk")) {
      const script = document.createElement("script");
      script.id = "toss-payments-sdk";
      script.src = "https://js.tosspayments.com/v1/payment-widget";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const t = localStorage.getItem("user_token");
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    // 쿼리 파라미터 확인하여 토스 결제 완료/실패 처리
    const searchParams = new URLSearchParams(window.location.search);
    const tossSuccess = searchParams.get('tossSuccess');
    const tossFail = searchParams.get('tossFail');
    const paymentId = searchParams.get('paymentId');
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amountStr = searchParams.get('amount');

    if (tossSuccess && paymentId && paymentKey && orderId && amountStr) {
      setLog(`토스페이먼츠 결제 승인 진행 중...`);
      setBusy(true);
      
      apiPost(`/v1/user/payments/${paymentId}/confirm`, {
        paymentKey,
        orderId,
        amount: Number(amountStr)
      }).then(() => {
        setLog(`[Success] 토스 결제 승인 완료!`);
        // 쿼리 파라미터 정리
        window.history.replaceState({}, document.title, window.location.pathname);
        if (selectedSub) loadSubDetail(selectedSub.id);
      }).catch((err: any) => {
        setLog(`[Error] 토스 결제 승인 실패: ${err.message}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }).finally(() => {
        setBusy(false);
      });
    } else if (tossFail) {
      const message = searchParams.get('message') || "결제가 취소되었거나 실패했습니다.";
      setLog(`[Error] 토스 결제 실패: ${message}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
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
    setLog("제출 목록 및 알림 설정 불러오는 중...");
    try {
      const res = await apiGet("/v1/user/submissions");
      setSubmissions(res.items || []);

      const notifyRes = await apiGet("/v1/user/notification-settings");
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
      const res = await apiPost("/v1/user/notification-settings", newSettings);
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
      setPackageChecksum(null);
      const subRes = await apiGet(`/v1/user/submissions/${id}`);
      setSelectedSub(subRes.submission);
      
      const evRes = await apiGet(`/v1/user/submissions/${id}/events`);
      setEvents(evRes.items || []);

      const reqRes = await apiGet(`/v1/user/submissions/${id}/evidence-requests`);
      setEvidenceRequests(reqRes.items || []);

      // Fetch payment
      try {
        const payRes = await apiGet(`/v1/user/payments?submissionId=${id}`);
        if (payRes.items && payRes.items.length > 0) {
          setPayment(payRes.items[0]);
        } else {
          setPayment(null);
        }
      } catch (err) {
        setPayment(null);
      }
      
      setLog(`상세 정보 로드 완료`);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadResultZip(id: string) {
    setBusy(true);
    setLog("다운로드 URL 발급 중...");
    try {
      const res = await apiPost(`/v1/user/submissions/${id}/package/download-url`, {});
      setPackageChecksum(res.checksumSha256);
      window.open(res.downloadUrl, "_blank");
      setLog("다운로드 창 열림");
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

  async function handleUploadMissingEvidence(e: React.ChangeEvent<HTMLInputElement>, reqId: string, typeCode: string) {
    if (!selectedSub) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setUploadingRequestId(reqId);
    setLog(`[${typeCode}] 업로드 준비 중...`);

    try {
      // 1. Upload URL 발급
      const { uploadUrl, evidenceId } = await apiPost(`/v1/user/submissions/${selectedSub.id}/evidences/upload-url`, {
        type: typeCode,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        requestId: reqId
      });
      setLog("업로드 URL 발급됨. 파일 전송 시작...");

      // 2. 실제 파일 PUT
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });
      if (!putRes.ok) throw new Error("Storage 업로드에 실패했습니다.");

      // 3. Complete 확정
      setLog("파일 전송 완료. 확정 처리 중...");
      await apiPost(`/v1/user/submissions/${selectedSub.id}/evidences/${evidenceId}/complete`, {});
      
      setLog("추가 서류 업로드 및 확정 완료");
      await loadSubDetail(selectedSub.id);
    } catch (err: any) {
      setLog(`[Error] ${err.message}`);
    } finally {
      setBusy(false);
      setUploadingRequestId(null);
      e.target.value = "";
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
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
                      {statusText[s.status] || s.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Notification Settings */}
            {notificationSettings && (
              <div style={{ borderTop: "2px solid #eee", paddingTop: 16 }}>
                <h3 style={{ margin: "0 0 12px 0", color: "#3f51b5", fontSize: "1.1em" }}>알림 설정 (Webhooks)</h3>
                <div style={{ marginBottom: 12, fontSize: "0.9em" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <input 
                      type="checkbox" 
                      checked={notificationSettings.events?.submissionCompleted}
                      onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, submissionCompleted: e.target.checked } })}
                    />
                    Submission Completed
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <input 
                      type="checkbox" 
                      checked={notificationSettings.events?.submissionFailed}
                      onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, submissionFailed: e.target.checked } })}
                    />
                    Submission Failed
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
                  <button onClick={addWebhook} disabled={busy || !newWebhookUrl} style={{ padding: "6px 12px", background: "#3949ab", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.9em" }}>
                    웹훅 추가
                  </button>
                </div>
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
                  {selectedSub.caseId && (
                    <div style={{ fontSize: "0.85em", color: "#1565c0", fontWeight: "bold", marginTop: 4 }}>
                      🔗 파트너 Case 연동됨: {selectedSub.caseId}
                    </div>
                  )}
                  {selectedSub.packageId && (
                    <div style={{ fontSize: "0.85em", color: "#e65100", fontWeight: "bold", marginTop: 4 }}>
                      📦 패키지 연동됨: {selectedSub.packageId}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ 
                      padding: "4px 8px", 
                      borderRadius: 12, 
                      fontSize: "0.8em", 
                      fontWeight: "bold",
                      background: ["completed"].includes(selectedSub.status) ? "#e8f5e9" : ["failed", "cancelled", "cancel_requested"].includes(selectedSub.status) ? "#ffebee" : "#e3f2fd",
                      color: ["completed"].includes(selectedSub.status) ? "#2e7d32" : ["failed", "cancelled", "cancel_requested"].includes(selectedSub.status) ? "#c62828" : "#1565c0"
                    }}>
                      {statusText[selectedSub.status] || selectedSub.status.toUpperCase()}
                    </span>
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
                  
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                    <button 
                      onClick={() => loadSubDetail(selectedSub.id)} 
                      disabled={busy} 
                      style={{ background: "transparent", color: "#1976d2", border: "none", cursor: "pointer", fontSize: "0.85em", textDecoration: "underline", padding: 0 }}
                    >
                      새로고침
                    </button>
                  </div>
                </div>
              </div>

              {/* 결제 카드 */}
              {payment && (
                <div style={{ marginBottom: 24, padding: 16, background: "#fff8e1", borderRadius: 6, border: "1px solid #ffe0b2" }}>
                  <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1em", color: "#e65100" }}>💳 결제 정보</h3>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "1.2em", fontWeight: "bold", marginBottom: 4 }}>{payment.amount.toLocaleString()} {payment.currency}</div>
                      <div style={{ fontSize: "0.85em", color: "#666" }}>결제 ID: {payment.id}</div>
                      {payment.provider === "stripe" && (
                        <div style={{ fontSize: "0.8em", color: "#1565c0", marginTop: 4 }}>[Stripe 결제]</div>
                      )}
                      {payment.provider === "tosspayments" && (
                        <div style={{ fontSize: "0.8em", color: "#1565c0", marginTop: 4 }}>[Toss 결제]</div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{
                        padding: "6px 12px",
                        borderRadius: 16,
                        fontSize: "0.85em",
                        fontWeight: "bold",
                        background: payment.status === "captured" ? "#e8f5e9" : payment.status === "confirm" ? "#e3f2fd" : payment.status === "initiated" ? "#fff3e0" : "#ffebee",
                        color: payment.status === "captured" ? "#2e7d32" : payment.status === "confirm" ? "#1565c0" : payment.status === "initiated" ? "#ef6c00" : "#c62828"
                      }}>
                        {payment.status.toUpperCase()}
                      </span>
                      {payment.status === "initiated" && payment.provider === "stripe" && payment.checkoutUrl && (
                        <button
                          onClick={() => {
                            window.location.href = payment.checkoutUrl;
                          }}
                          disabled={busy}
                          style={{ display: "block", marginTop: 8, background: "#6772e5", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: "0.85em", fontWeight: "bold" }}
                        >
                          결제 진행하기 (Stripe)
                        </button>
                      )}
                      {payment.status === "initiated" && payment.provider === "tosspayments" && payment.clientKey && (
                        <button
                          onClick={() => {
                            const successUrl = `${window.location.origin}?tossSuccess=true&paymentId=${payment.id}`;
                            const failUrl = `${window.location.origin}?tossFail=true&paymentId=${payment.id}`;
                            
                            // 동적으로 토스 결제창 띄우기
                            const loadTossPayments = async () => {
                              try {
                                setBusy(true);
                                setLog("토스페이먼츠 SDK 로드 중...");
                                const tossPayments = await window.TossPayments(payment.clientKey);
                                const widgets = tossPayments.widgets({ customerKey: user?.uid || "anonymous" });
                                
                                // 모달 형태로 렌더링하기 위한 컨테이너 생성
                                const modalId = "toss-payment-modal";
                                let modal = document.getElementById(modalId);
                                if (!modal) {
                                  modal = document.createElement("div");
                                  modal.id = modalId;
                                  modal.style.position = "fixed";
                                  modal.style.top = "0";
                                  modal.style.left = "0";
                                  modal.style.width = "100%";
                                  modal.style.height = "100%";
                                  modal.style.backgroundColor = "rgba(0,0,0,0.5)";
                                  modal.style.display = "flex";
                                  modal.style.justifyContent = "center";
                                  modal.style.alignItems = "center";
                                  modal.style.zIndex = "9999";
                                  
                                  const content = document.createElement("div");
                                  content.style.backgroundColor = "white";
                                  content.style.padding = "20px";
                                  content.style.borderRadius = "8px";
                                  content.style.width = "100%";
                                  content.style.maxWidth = "600px";
                                  content.style.maxHeight = "90vh";
                                  content.style.overflowY = "auto";
                                  content.style.position = "relative";
                                  
                                  const closeBtn = document.createElement("button");
                                  closeBtn.innerText = "닫기";
                                  closeBtn.style.position = "absolute";
                                  closeBtn.style.top = "10px";
                                  closeBtn.style.right = "10px";
                                  closeBtn.style.padding = "5px 10px";
                                  closeBtn.onclick = () => {
                                    document.body.removeChild(modal!);
                                    setBusy(false);
                                  };
                                  
                                  const widgetContainer = document.createElement("div");
                                  widgetContainer.id = "payment-method";
                                  
                                  const agreementContainer = document.createElement("div");
                                  agreementContainer.id = "agreement";
                                  
                                  const requestBtn = document.createElement("button");
                                  requestBtn.innerText = "결제하기";
                                  requestBtn.style.width = "100%";
                                  requestBtn.style.padding = "15px";
                                  requestBtn.style.marginTop = "20px";
                                  requestBtn.style.backgroundColor = "#3182f6";
                                  requestBtn.style.color = "white";
                                  requestBtn.style.border = "none";
                                  requestBtn.style.borderRadius = "4px";
                                  requestBtn.style.fontSize = "16px";
                                  requestBtn.style.cursor = "pointer";
                                  
                                  content.appendChild(closeBtn);
                                  content.appendChild(widgetContainer);
                                  content.appendChild(agreementContainer);
                                  content.appendChild(requestBtn);
                                  modal.appendChild(content);
                                  document.body.appendChild(modal);
                                  
                                  await widgets.setAmount({ currency: payment.currency, value: payment.amount });
                                  await widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' });
                                  await widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' });
                                  
                                  requestBtn.onclick = async () => {
                                    try {
                                      await widgets.requestPayment({
                                        orderId: payment.id,
                                        orderName: `결제 ${payment.id}`,
                                        successUrl: successUrl,
                                        failUrl: failUrl,
                                        customerEmail: user?.email || undefined,
                                        customerName: user?.displayName || undefined
                                      });
                                    } catch (err: any) {
                                      setLog(`[Error] 토스페이먼츠 결제 요청 실패: ${err.message}`);
                                      document.body.removeChild(modal!);
                                      setBusy(false);
                                    }
                                  };
                                }
                              } catch (err: any) {
                                setLog(`[Error] 토스페이먼츠 로드 실패: ${err.message}`);
                                setBusy(false);
                              }
                            };
                            
                            loadTossPayments();
                          }}
                          disabled={busy}
                          style={{ display: "block", marginTop: 8, background: "#3182f6", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: "0.85em", fontWeight: "bold" }}
                        >
                          결제 진행하기 (Toss)
                        </button>
                      )}
                      {payment.status === "initiated" && payment.provider !== "stripe" && payment.provider !== "tosspayments" && (
                        <button
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await apiPost(`/v1/user/payments/${payment.id}/confirm`, {});
                              await loadSubDetail(selectedSub.id);
                            } catch (e: any) {
                              setLog(`[Error] 결제 확인 실패: ${e.message}`);
                            } finally {
                              setBusy(false);
                            }
                          }}
                          disabled={busy}
                          style={{ display: "block", marginTop: 8, background: "#4caf50", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: "0.85em", fontWeight: "bold" }}
                        >
                          결제 승인 (Confirm Mock)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

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

                  {selectedSub.status === "completed" && selectedSub.packageId && (
                    <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <button onClick={() => downloadResultZip(selectedSub.id)} disabled={busy} style={{ display: "inline-block", padding: "6px 12px", background: "#388e3c", color: "white", textDecoration: "none", borderRadius: 4, fontSize: "0.9em", fontWeight: "bold", border: "none", cursor: busy ? "not-allowed" : "pointer" }}>
                        Download result ZIP
                      </button>
                      {packageChecksum && (
                        <div style={{ fontSize: "0.85em", color: "#333", display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontFamily: "monospace" }}>{packageChecksum}</span>
                          <button
                            onClick={() => navigator.clipboard?.writeText?.(packageChecksum)}
                            style={{ background: "#eee", border: "1px solid #ccc", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.85em" }}
                          >
                            복사
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {selectedSub.result.artifactUrl && (
                    <div style={{ marginTop: 8 }}>
                      <a href={selectedSub.result.artifactUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", padding: "6px 12px", background: "#90a4ae", color: "white", textDecoration: "none", borderRadius: 4, fontSize: "0.9em", fontWeight: "bold" }}>
                        Legacy artifactUrl 다운로드
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

              {/* 증거 파일 목록 (연동된 Case 기준) */}
              {selectedSub.caseId && (
                <div style={{ marginBottom: 24, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: "1em", color: "#333" }}>📁 증거 파일 (Evidences)</h3>
                  </div>
                  {/* 향후 증거 목록 조회/다운로드 API 연동 필요 시 여기에 구현 */}
                  <div style={{ fontSize: "0.85em", color: "#666" }}>
                    파트너 시스템에 연동된 증거 파일 목록은 별도 API를 통해 제공될 수 있습니다.
                  </div>
                </div>
              )}

              {/* 추가 서류 요청 (Evidence Requests) */}
              {evidenceRequests.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1em", borderBottom: "1px solid #eee", paddingBottom: 8, color: "#e65100" }}>📨 요청된 추가 서류</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {evidenceRequests.map(r => (
                      <div key={r.id} style={{ padding: 16, border: `1px solid ${r.status === "fulfilled" ? "#a5d6a7" : "#ffcc80"}`, borderRadius: 8, background: r.status === "fulfilled" ? "#e8f5e9" : "#fff3e0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <div style={{ fontWeight: "bold", color: r.status === "fulfilled" ? "#2e7d32" : "#e65100" }}>
                            {r.messageToUserKo}
                          </div>
                          <span style={{ 
                            padding: "4px 8px", 
                            borderRadius: 12, 
                            fontSize: "0.8em", 
                            fontWeight: "bold",
                            background: r.status === "fulfilled" ? "#c8e6c9" : r.status === "cancelled" ? "#eee" : "#ffe0b2",
                            color: r.status === "fulfilled" ? "#2e7d32" : r.status === "cancelled" ? "#666" : "#ef6c00"
                          }}>
                            {r.status.toUpperCase()}
                          </span>
                        </div>
                        {r.status === "open" && (
                          <div style={{ marginTop: 12 }}>
                            {r.items.map((item: any, idx: number) => (
                              <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: idx > 0 ? "1px solid #ffe0b2" : "none" }}>
                                <div>
                                  <span style={{ fontWeight: "bold", marginRight: 8, color: item.status === "fulfilled" ? "#9e9e9e" : "inherit", textDecoration: item.status === "fulfilled" ? "line-through" : "none" }}>{item.titleKo}</span>
                                  <span style={{ fontSize: "0.8em", color: "#666" }}>({item.code})</span>
                                  {item.required && <span style={{ marginLeft: 8, color: item.status === "fulfilled" ? "#9e9e9e" : "#d32f2f", fontSize: "0.8em", fontWeight: "bold" }}>*필수</span>}
                                  {item.status === "fulfilled" && <span style={{ marginLeft: 8, color: "#2e7d32", fontSize: "0.8em", fontWeight: "bold" }}>✅ 완료됨</span>}
                                </div>
                                <div>
                                  <input 
                                    type="file" 
                                    id={`file-${r.id}-${item.code}`}
                                    style={{ display: "none" }}
                                    accept=".pdf,image/png,image/jpeg,image/jpg"
                                    onChange={(e) => handleUploadMissingEvidence(e, r.id, item.code)}
                                  />
                                  <button 
                                    onClick={() => document.getElementById(`file-${r.id}-${item.code}`)?.click()}
                                    disabled={busy || r.status !== "open" || item.status === "fulfilled"}
                                    style={{ padding: "6px 12px", background: item.status === "fulfilled" ? "#ccc" : "#f57c00", color: "white", border: "none", borderRadius: 4, cursor: item.status === "fulfilled" ? "not-allowed" : "pointer", fontSize: "0.9em", fontWeight: "bold" }}
                                  >
                                    {uploadingRequestId === r.id ? "업로드 중..." : item.status === "fulfilled" ? "제출 완료" : "파일 업로드"}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {r.status === "fulfilled" && (
                          <div style={{ marginTop: 8, fontSize: "0.9em", color: "#2e7d32" }}>
                            ✅ 추가 서류 제출이 완료되었습니다. 파트너 확인을 대기 중입니다.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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
