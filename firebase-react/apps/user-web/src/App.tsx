import React, { useState, useEffect, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";

const FloatingChatWidget = lazy(() => import("./components/FloatingChatWidget"));
const TossPaymentModal = lazy(() => import("./components/TossPaymentModal"));

function App() {
  const { t, i18n } = useTranslation();
  const [token, setToken] = useState("");
  const [showTossModal, setShowTossModal] = useState(false);
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
  const [lastPolledAt, setLastPolledAt] = useState<Date | null>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [workflowState, setWorkflowState] = useState<any | null>(null);
  
  // Case Pack (Phase 4)
  const [casePacks, setCasePacks] = useState<any[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string>("");
  const [dynamicFormData, setDynamicFormData] = useState<string>("{\n  \n}");

  const [pollError, setPollError] = useState<string | null>(null);

  const [notificationSettings, setNotificationSettings] = useState<any>(null);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookSecret, setNewWebhookSecret] = useState("");
  const [newSmsNumber, setNewSmsNumber] = useState("");
  const [newKakaoNumber, setNewKakaoNumber] = useState("");
  
  // Funnel State
  const [funnelSessionId, setFunnelSessionId] = useState<string | null>(null);
  const [funnelIntent, setFunnelIntent] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [funnelAnswer, setFunnelAnswer] = useState("");
  const [funnelPreview, setFunnelPreview] = useState<any>(null);
  const [funnelResults, setFunnelResults] = useState<any>(null);

  // B2G E-Filing State (EP-13)
  const [b2gItems, setB2gItems] = useState<any[]>([]);
  const [b2gFees, setB2gFees] = useState<any[]>([]);

  const user = token ? { uid: token.slice(0, 16), email: undefined, displayName: undefined } : null;

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
      
      const doConfirm = async () => {
        try {
          const res = await fetch(`/v1/user/payments/${paymentId}/confirm`, {
            method: "POST",
            headers: { 
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              paymentKey,
              orderId,
              amount: Number(amountStr)
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || "API Error");
          
          setLog(`[Success] 토스 결제 승인 완료!`);
          window.history.replaceState({}, document.title, window.location.pathname);
          // 상태가 동기화된 후 데이터를 다시 불러옵니다.
          const submissionsRes = await fetch("/v1/user/submissions", {
            headers: { Authorization: `Bearer ${token}` }
          });
          const submissionsData = await submissionsRes.json();
          if (submissionsRes.ok) {
             setSubmissions(submissionsData.data?.items || []);
          }
        } catch (err: any) {
          setLog(`[Error] 토스 결제 승인 실패: ${err.message}`);
          window.history.replaceState({}, document.title, window.location.pathname);
        } finally {
          setBusy(false);
        }
      };

      doConfirm();
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

      try {
        const packRes = await apiGet("/v1/case-packs");
        setCasePacks(packRes.packs || []);
      } catch (e) {}

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

  async function addSms() {
    if (!newSmsNumber) return;
    const channels = notificationSettings.channels || {};
    const newSettings = {
      ...notificationSettings,
      channels: {
        ...channels,
        sms: [...(channels.sms || []), { phoneNumber: newSmsNumber, enabled: true }]
      }
    };
    await updateNotificationSettings(newSettings);
    setNewSmsNumber("");
  }

  async function addKakao() {
    if (!newKakaoNumber) return;
    const channels = notificationSettings.channels || {};
    const newSettings = {
      ...notificationSettings,
      channels: {
        ...channels,
        kakao: [...(channels.kakao || []), { phoneNumber: newKakaoNumber, enabled: true }]
      }
    };
    await updateNotificationSettings(newSettings);
    setNewKakaoNumber("");
  }

  async function createSubmission() {
    if ((!newType && !selectedPackId) || !newPayload) return;
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
        inputType: selectedPackId || newType, // Phase 4 casePackId 지원
        payload: payloadObj,
        submitNow
      });
      setLog(`생성 완료: ${res.submission.id}`);
      setNewType("");
      setSelectedPackId("");
      setNewPayload("");
      await loadSubmissions();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveDynamicFormData(caseId: string) {
    if (!dynamicFormData) return;
    setBusy(true);
    setLog("동적 폼 데이터 저장 중...");
    try {
      const parsedData = JSON.parse(dynamicFormData);
      await apiPost(`/v1/cases/${caseId}/forms/dynamic`, { dynamicData: parsedData });
      setLog("동적 폼 데이터 저장 성공");
      await loadSubDetail(selectedSub.id);
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
      setPollError(null);
      
      const evRes = await apiGet(`/v1/user/submissions/${id}/events`);
      setEvents(evRes.items || []);

      const reqRes = await apiGet(`/v1/user/submissions/${id}/evidence-requests`);
      setEvidenceRequests(reqRes.items || []);

      // B2G 현황 및 공과금 내역 가져오기 (EP-13)
      try {
        const b2gRes = await apiGet(`/v1/user/submissions/${id}/b2g`);
        setB2gItems(b2gRes.items || []);
        setB2gFees(b2gRes.fees || []);
      } catch (err) {
        setB2gItems([]);
        setB2gFees([]);
      }

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
      try {
        const qRes = await apiGet(`/v1/cases/${id}/quotes`);
        setQuotes(qRes.quotes || []);
      } catch(e) {
        setQuotes([]);
      }

      if (subRes.submission.caseId) {
        try {
          const wfRes = await apiGet(`/v1/cases/${subRes.submission.caseId}/workflow`);
          setWorkflowState(wfRes);
        } catch(e) {
          setWorkflowState(null);
        }
      } else {
        setWorkflowState(null);
      }

      setLastPolledAt(new Date());
    } catch (e: any) {
      setPollError(e.message);
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
        requestId: reqId,
        itemCode: typeCode
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

  async function startFunnel() {
    if (!funnelIntent) return;
    setBusy(true);
    setLog("진단 세션 생성 중...");
    try {
      const res = await apiPost("/v1/funnel/intent", { intentText: funnelIntent });
      setFunnelSessionId(res.sessionId);
      setCurrentQuestion(res.nextQuestion);
      setFunnelResults(null);
      setFunnelAnswer("");
      setFunnelPreview(null);
      setLog(`진단 세션 생성: ${res.sessionId}`);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function submitFunnelAnswer() {
    if (!funnelSessionId || !currentQuestion || funnelAnswer === undefined) return;
    setBusy(true);
    setLog("답변 제출 중...");
    try {
      const res = await apiPost(`/v1/funnel/sessions/${funnelSessionId}/answer`, { 
        questionId: currentQuestion.id,
        answer: funnelAnswer
      });
      setFunnelPreview(res.preview);
      if (res.isCompleted) {
        setCurrentQuestion(null);
        setLog("진단 완료. 매칭 결과 조회 중...");
        const resultsRes = await apiGet(`/v1/funnel/sessions/${funnelSessionId}/results`);
        setFunnelResults(resultsRes);
      } else {
        setCurrentQuestion(res.nextQuestion);
        setFunnelAnswer("");
      }
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function acceptQuote(quoteId: string) {
    if (!selectedSub) return;
    setBusy(true);
    setLog("견적 동의 중...");
    try {
      const idempotencyKey = `quote_${quoteId}_${Date.now()}`;
      await fetch(`/v1/user/cases/${selectedSub.id}/quotes/${quoteId}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({})
      });
      setLog("견적 동의 완료");
      await loadSubDetail(selectedSub.id);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function createSubmissionFromFunnel(partnerId: string) {
    setBusy(true);
    setLog("제출 생성 중...");
    try {
      const res = await apiPost("/v1/user/submissions", { 
        inputType: funnelIntent,
        partnerId,
        submitNow: false,
        sessionId: funnelSessionId
      });
      setLog(`제출 생성 완료: ${res.submission.id}`);
      await loadSubmissions();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: 20, maxWidth: 1000, margin: "0 auto", background: "#fdfdfd" }}>
      {/* 우측 상단 언어 스위처 추가 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ color: "#3f51b5" }}>{t('title')}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => i18n.changeLanguage('ko')} style={{ padding: "6px 12px", cursor: "pointer", fontWeight: i18n.language?.startsWith('ko') ? 'bold' : 'normal' }}>KO</button>
          <button onClick={() => i18n.changeLanguage('en')} style={{ padding: "6px 12px", cursor: "pointer", fontWeight: i18n.language?.startsWith('en') ? 'bold' : 'normal' }}>EN</button>
        </div>
      </div>
      
      <div style={{ marginBottom: 20, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #ddd", display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ fontWeight: "bold" }}>User Token:</label>
        <input 
          value={token} 
          onChange={e => handleSaveToken(e.target.value)} 
          style={{ flex: 1, padding: 8, borderRadius: 4, border: "1px solid #ccc" }} 
          placeholder="Firebase Auth Token" 
        />
        <button onClick={loadSubmissions} disabled={busy || !token} style={{ padding: "8px 16px", background: "#3f51b5", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
          {t('auth_load')}
        </button>
      </div>

      <div style={{ marginBottom: 20, padding: 12, background: "#e8eaf6", borderRadius: 8, color: "#1a237e", fontSize: "0.9em" }}>
        <strong>Log:</strong> {log}
      </div>

      {token && (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexDirection: "column" }}>
          
          {/* Funnel Section */}
          <div style={{ width: "100%", background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #ddd" }}>
            <h2 style={{ margin: "0 0 16px 0", color: "#3f51b5", fontSize: "1.2em" }}>{t('funnel_title')}</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input 
                value={funnelIntent} 
                onChange={e => setFunnelIntent(e.target.value)} 
                placeholder={t('funnel_placeholder')} 
                style={{ flex: 1, padding: 8, borderRadius: 4, border: "1px solid #ccc" }} 
              />
              <button onClick={startFunnel} disabled={busy || !funnelIntent} style={{ padding: "8px 16px", background: "#3949ab", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>{t('funnel_start')}</button>
            </div>

            {funnelSessionId && currentQuestion && (
              <div style={{ padding: 16, background: "#f5f5f5", borderRadius: 6, marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1em" }}>{currentQuestion.text}</h3>
                {currentQuestion.type === "single_choice" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {currentQuestion.options.map((opt: string) => (
                      <button key={opt} onClick={() => { setFunnelAnswer(opt); submitFunnelAnswer(); }} disabled={busy} style={{ padding: "8px 16px", background: funnelAnswer === opt ? "#3f51b5" : "#fff", color: funnelAnswer === opt ? "white" : "#333", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {currentQuestion.type === "number" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="number" value={funnelAnswer} onChange={e => setFunnelAnswer(e.target.value)} style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }} />
                    <button onClick={submitFunnelAnswer} disabled={busy || !funnelAnswer} style={{ padding: "8px 16px", background: "#4caf50", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>다음</button>
                  </div>
                )}
              </div>
            )}

            {funnelPreview && !funnelResults && (
              <div style={{ padding: 12, background: "#e8eaf6", borderRadius: 6, border: "1px solid #c5cae9" }}>
                <h4 style={{ margin: "0 0 8px 0", color: "#1a237e" }}>💡 가치 프리뷰 (실시간 계산)</h4>
                <div style={{ fontSize: "0.9em", color: "#333" }}>
                  예상 비용: {funnelPreview.minPrice.toLocaleString()}원 ~ {funnelPreview.maxPrice.toLocaleString()}원<br/>
                  소요 시간: {funnelPreview.etaDays}일<br/>
                  준비물: {funnelPreview.requiredDocs.join(", ")}
                </div>
              </div>
            )}

            {funnelResults && (
              <div style={{ padding: 16, background: "#fff3e0", borderRadius: 6, border: "1px solid #ffe0b2" }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#e65100" }}>🎉 매칭 결과</h3>
                
                {funnelResults.sponsored?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em", color: "#d84315" }}>[광고] 스폰서 파트너</h4>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {funnelResults.sponsored.map((p: any) => (
                        <div key={p.partnerId} style={{ padding: 12, background: "#fff", border: "1px solid #ffcc80", borderRadius: 6, width: 200 }}>
                          <div style={{ fontWeight: "bold", marginBottom: 4 }}>{p.name}</div>
                          <div style={{ fontSize: "0.8em", color: "#666" }}>평점: {p.rating} / 가격: {p.price?.toLocaleString()}원</div>
                          <button onClick={() => createSubmissionFromFunnel(p.partnerId)} disabled={busy} style={{ marginTop: 8, width: "100%", padding: 6, background: "#ff9800", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.85em" }}>선택</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {funnelResults.recommended && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em", color: "#2e7d32" }}>👍 추천 1안</h4>
                    <div style={{ padding: 12, background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: "bold", fontSize: "1.1em", marginBottom: 4 }}>{funnelResults.recommended.name}</div>
                        <div style={{ fontSize: "0.85em", color: "#555" }}>평점: {funnelResults.recommended.rating} / 예상 가격: {funnelResults.recommended.price?.toLocaleString()}원 / ETA: {funnelResults.recommended.etaHours}시간</div>
                      </div>
                      <button onClick={() => createSubmissionFromFunnel(funnelResults.recommended.partnerId)} disabled={busy} style={{ padding: "8px 16px", background: "#4caf50", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>선택</button>
                    </div>
                  </div>
                )}

                {funnelResults.compareTop3?.length > 0 && (
                  <div>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em", color: "#1565c0" }}>비교 Top 3</h4>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {funnelResults.compareTop3.map((p: any) => (
                        <div key={p.partnerId} style={{ padding: 12, background: "#fff", border: "1px solid #bbdefb", borderRadius: 6, width: 200 }}>
                          <div style={{ fontWeight: "bold", marginBottom: 4 }}>{p.name}</div>
                          <div style={{ fontSize: "0.8em", color: "#666" }}>평점: {p.rating} / 가격: {p.price?.toLocaleString()}원</div>
                          <button onClick={() => createSubmissionFromFunnel(p.partnerId)} disabled={busy} style={{ marginTop: 8, width: "100%", padding: 6, background: "#2196f3", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.85em" }}>선택</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", width: "100%" }}>
          
          {/* Submission List */}
          <div style={{ flex: 1, background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #ddd" }}>
            <h2 style={{ margin: "0 0 16px 0", color: "#3f51b5", fontSize: "1.2em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {t('my_submissions')}
              <button onClick={loadSubmissions} disabled={busy} style={{ background: "#eee", border: "1px solid #ccc", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.8em" }}>{t('refresh')}</button>
            </h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <select 
                  value={selectedPackId} 
                  onChange={e => setSelectedPackId(e.target.value)} 
                  style={{ flex: 1, padding: 6 }}
                >
                  <option value="">{t('pack_placeholder')}</option>
                  {casePacks.map(p => <option key={p.id} value={p.id}>{p.nameKo}</option>)}
                </select>
                <input 
                  value={newType} 
                  onChange={e => setNewType(e.target.value)} 
                  placeholder={t('legacy_placeholder')} 
                  style={{ flex: 1, padding: 6 }} 
                />
              </div>
              <textarea 
                value={newPayload} 
                onChange={e => setNewPayload(e.target.value)} 
                placeholder={t('payload_placeholder')} 
                style={{ padding: 6, height: 60 }} 
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>
                  <input type="checkbox" checked={submitNow} onChange={e => setSubmitNow(e.target.checked)} />
                  {t('submit_now')}
                </label>
                <button onClick={createSubmission} disabled={busy || (!newType && !selectedPackId) || !newPayload} style={{ padding: "6px 12px", background: "#3949ab", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>{t('create_new')}</button>
              </div>
            </div>

            {submissions.length === 0 ? (
              <div style={{ color: "#999", textAlign: "center", padding: 20 }}>{t('empty_submissions')}</div>
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
                  <h3 style={{ margin: "0 0 12px 0", color: "#3f51b5", fontSize: "1.1em" }}>알림 설정 (Omni-channel)</h3>
                  <div style={{ marginBottom: 12, fontSize: "0.9em" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <input 
                        type="checkbox" 
                        checked={notificationSettings.events?.submissionCompleted}
                        onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, submissionCompleted: e.target.checked } })}
                      />
                      Submission Completed (제출 완료)
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <input 
                        type="checkbox" 
                        checked={notificationSettings.events?.submissionFailed}
                        onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, submissionFailed: e.target.checked } })}
                      />
                      Submission Failed (제출 실패)
                    </label>
                  </div>
                  
                  {/* SMS 설정 */}
                  <div style={{ marginBottom: 12 }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em", color: "#e65100" }}>📱 SMS (문자)</h4>
                    {notificationSettings.channels?.sms?.map((s: any, idx: number) => (
                      <div key={idx} style={{ background: "#fff3e0", padding: 8, borderRadius: 4, marginBottom: 8, fontSize: "0.85em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div><strong>번호:</strong> {s.phoneNumber}</div>
                        <button onClick={() => {
                          const newSms = [...notificationSettings.channels.sms];
                          newSms.splice(idx, 1);
                          updateNotificationSettings({ ...notificationSettings, channels: { ...notificationSettings.channels, sms: newSms } });
                        }} style={{ background: "#d32f2f", color: "white", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}>삭제</button>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 8 }}>
                      <input placeholder="010-1234-5678" value={newSmsNumber} onChange={e => setNewSmsNumber(e.target.value)} style={{ flex: 1, padding: 6, fontSize: "0.85em" }} />
                      <button onClick={addSms} disabled={busy || !newSmsNumber} style={{ padding: "6px 12px", background: "#ef6c00", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.9em" }}>추가</button>
                    </div>
                  </div>

                  {/* 카카오톡 설정 */}
                  <div style={{ marginBottom: 12 }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em", color: "#fbc02d" }}>💬 카카오 알림톡</h4>
                    {notificationSettings.channels?.kakao?.map((k: any, idx: number) => (
                      <div key={idx} style={{ background: "#fffde7", padding: 8, borderRadius: 4, marginBottom: 8, fontSize: "0.85em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div><strong>번호:</strong> {k.phoneNumber}</div>
                        <button onClick={() => {
                          const newKakao = [...notificationSettings.channels.kakao];
                          newKakao.splice(idx, 1);
                          updateNotificationSettings({ ...notificationSettings, channels: { ...notificationSettings.channels, kakao: newKakao } });
                        }} style={{ background: "#d32f2f", color: "white", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}>삭제</button>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 8 }}>
                      <input placeholder="010-1234-5678" value={newKakaoNumber} onChange={e => setNewKakaoNumber(e.target.value)} style={{ flex: 1, padding: 6, fontSize: "0.85em" }} />
                      <button onClick={addKakao} disabled={busy || !newKakaoNumber} style={{ padding: "6px 12px", background: "#fbc02d", color: "#333", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.9em", fontWeight: "bold" }}>추가</button>
                    </div>
                  </div>

                  {/* 웹훅 설정 */}
                  <div style={{ marginBottom: 12 }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em" }}>🌐 웹훅 (Webhooks)</h4>
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

              {/* 견적 확인 및 동의 */}
              <div style={{ marginBottom: 24, padding: 16, background: "#fff", border: "1px solid #ddd", borderRadius: 8 }}>
                <h3 style={{ margin: "0 0 12px 0", color: "#0277bd", fontSize: "1.1em" }}>💰 견적 확인 및 동의</h3>
                {quotes.length === 0 ? (
                  <div style={{ color: "#999", fontSize: "0.9em" }}>제안된 견적이 없습니다.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {quotes.map(q => (
                      <div key={q.id} style={{ border: "1px solid #eee", padding: 12, borderRadius: 6, background: q.status === "finalized" ? "#e3f2fd" : "#fafafa" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontWeight: "bold" }}>
                            상태: {q.status === "draft" ? "예상 견적 (제안됨)" : q.status === "finalized" ? "최종 확정 (동의 대기)" : q.status === "accepted" ? "동의 완료" : q.status}
                          </span>
                          <span style={{ fontSize: "0.8em", color: "#666" }}>{new Date(q.createdAt).toLocaleString()}</span>
                        </div>

                        <div style={{ fontSize: "0.9em", color: "#555" }}>
                          예상 범위: {q.priceMin.toLocaleString()} ~ {q.priceMax.toLocaleString()} 원 ({q.etaMinHours}~{q.etaMaxHours}시간)
                        </div>

                        {q.finalPrice && (
                          <div style={{ marginTop: 8, fontSize: "1.1em", fontWeight: "bold", color: "#d84315" }}>
                            최종 확정액: {q.finalPrice.toLocaleString()} 원
                          </div>
                        )}

                        {q.assumptionsKo && q.assumptionsKo.length > 0 && (
                          <div style={{ marginTop: 8, fontSize: "0.85em", color: "#333" }}>
                            <strong>전제 조건:</strong>
                            <ul style={{ margin: "4px 0 0 0", paddingLeft: 20 }}>
                              {q.assumptionsKo.map((asm: string, idx: number) => <li key={idx}>{asm}</li>)}
                            </ul>
                          </div>
                        )}

                        {q.status === "finalized" && (
                          <button 
                            onClick={() => acceptQuote(q.id)} 
                            disabled={busy} 
                            style={{ marginTop: 12, padding: "8px 16px", background: "#0288d1", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", width: "100%" }}
                          >
                            견적에 동의하고 결제 진행하기
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
                            setBusy(true);
                            setShowTossModal(true);
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

              {/* B2G 공공기관 처리 현황 (EP-13) */}
              {(b2gItems.length > 0 || b2gFees.length > 0) && (
                <div style={{ marginBottom: 24, padding: 16, background: "#f0f4c3", borderRadius: 8, border: "1px solid #cddc39" }}>
                  <h3 style={{ margin: "0 0 12px 0", color: "#33691e", fontSize: "1.1em" }}>🏛️ 공공기관 처리 현황 (B2G E-Filing)</h3>
                  
                  {b2gItems.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em", color: "#558b2f" }}>제출 내역</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {b2gItems.map(item => (
                          <div key={item.id} style={{ background: "#fff", padding: 12, borderRadius: 6, border: "1px solid #dcedc8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: "bold", color: "#33691e" }}>{item.agency}</div>
                              <div style={{ fontSize: "0.85em", color: "#666", marginTop: 4 }}>
                                상태: {item.agencyStatus || "제출 대기중"} {item.receiptNumber && ` | 접수번호: ${item.receiptNumber}`}
                              </div>
                              {item.actionDetails && (
                                <div style={{ marginTop: 4, fontSize: "0.8em", color: "#d84315", background: "#ffe0b2", padding: "4px 8px", borderRadius: 4 }}>
                                  ⚠️ 보정사유: {item.actionDetails}
                                </div>
                              )}
                            </div>
                            <span style={{ 
                              fontSize: "0.8em", 
                              background: item.status === "completed" ? "#c8e6c9" : item.status === "action_required" ? "#ffebee" : "#e0e0e0", 
                              color: item.status === "completed" ? "#2e7d32" : item.status === "action_required" ? "#c62828" : "#616161",
                              padding: "4px 8px", 
                              borderRadius: 12,
                              fontWeight: "bold"
                            }}>
                              {item.status.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {b2gFees.length > 0 && (
                    <div>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em", color: "#f57f17" }}>공과금 및 수수료</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {b2gFees.map(fee => (
                          <div key={fee.id} style={{ background: "#fff", padding: 12, borderRadius: 6, border: "1px solid #ffe082", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: "bold", color: "#f57f17" }}>{fee.agency} - {fee.feeType === "tax" ? "세금" : "수수료"}</div>
                              <div style={{ fontSize: "0.85em", color: "#666", marginTop: 4 }}>
                                금액: {fee.amount?.toLocaleString()} 원 {fee.paymentNumber && ` | 납부번호: ${fee.paymentNumber}`}
                              </div>
                              {fee.errorMessage && <div style={{ fontSize: "0.8em", color: "#c62828", marginTop: 4 }}>오류: {fee.errorMessage}</div>}
                            </div>
                            <span style={{ 
                              fontSize: "0.8em", 
                              background: fee.status === "paid" ? "#c8e6c9" : fee.status === "failed" ? "#ffcdd2" : "#fff9c4", 
                              color: fee.status === "paid" ? "#2e7d32" : fee.status === "failed" ? "#c62828" : "#f57f17",
                              padding: "4px 8px", 
                              borderRadius: 12,
                              fontWeight: "bold"
                            }}>
                              {fee.status.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 동적 워크플로우 상태 (Phase 4) */}
              {workflowState && (
                <div style={{ marginBottom: 24, padding: 12, background: "#fdfdfd", borderRadius: 6, border: "1px solid #00acc1" }}>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "1em", color: "#00acc1" }}>🧭 사건 워크플로우 (Dynamic Workflow)</h3>
                  <div style={{ fontSize: "0.85em", color: "#333", display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <div><strong>진행 단계 (Stages):</strong> {workflowState.stages?.join(" ➔ ") || "없음"}</div>
                    <div><strong>필요 증거 슬롯 (Required):</strong> {workflowState.requiredSlots?.join(", ") || "없음"}</div>
                  </div>
                </div>
              )}

              {/* 동적 폼 데이터 입력 (Phase 4) */}
              {selectedSub.caseId && selectedSub.status === "draft" && (
                <div style={{ marginBottom: 24, padding: 12, background: "#fdfdfd", borderRadius: 6, border: "1px solid #9c27b0" }}>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "1em", color: "#6a1b9a" }}>⚙️ 동적 폼 입력 (Dynamic Form)</h3>
                  <div style={{ fontSize: "0.85em", color: "#666", marginBottom: 8 }}>
                    사건팩(Case Pack)에 정의된 JSON 스키마에 맞춰 데이터를 입력합니다.
                  </div>
                  <textarea 
                    value={dynamicFormData} 
                    onChange={e => setDynamicFormData(e.target.value)} 
                    style={{ width: "100%", height: 80, padding: 8, fontFamily: "monospace", fontSize: "0.85em" }}
                  />
                  <div style={{ marginTop: 8, textAlign: "right" }}>
                    <button 
                      onClick={() => saveDynamicFormData(selectedSub.caseId)} 
                      disabled={busy || !dynamicFormData}
                      style={{ padding: "6px 12px", background: "#8e24aa", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.85em" }}
                    >
                      동적 데이터 저장
                    </button>
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
        </div>
      )}
      
      {/* 플로팅 챗봇 위젯 마운트 */}
      <Suspense fallback={null}>
        <FloatingChatWidget token={token} />
      </Suspense>

      {/* 토스페이먼츠 결제 모달 마운트 */}
      <Suspense fallback={null}>
        {showTossModal && payment && (
          <TossPaymentModal
            clientKey={payment.clientKey || ""}
            customerKey={user?.uid || "anonymous"}
            amount={payment.amount}
            orderId={payment.id}
            orderName={`결제건 ${payment.id}`}
            successUrl={`${window.location.origin}${window.location.pathname}?tossSuccess=true&paymentId=${payment.id}&paymentKey={PAYMENT_KEY}&orderId={ORDER_ID}&amount={AMOUNT}`}
            failUrl={`${window.location.origin}${window.location.pathname}?tossFail=true&paymentId=${payment.id}`}
            onClose={() => {
              setShowTossModal(false);
              setBusy(false);
            }}
            onError={(err) => {
              setLog(`[Error] 토스 결제 모달 오류: ${err.message || err}`);
              setShowTossModal(false);
              setBusy(false);
            }}
          />
        )}
      </Suspense>
    </div>
  );
}

export default App;
