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
          const apiUrl = import.meta.env.VITE_API_URL || "";
          const res = await fetch(`${apiUrl}/v1/user/payments/${paymentId}/confirm`, {
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
          const submissionsRes = await fetch(`${apiUrl}/v1/user/submissions`, {
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
    const apiUrl = import.meta.env.VITE_API_URL || "";
    const res = await fetch(`${apiUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || "API Error");
    return data.data;
  }

  async function apiPost(path: string, body: any) {
    const apiUrl = import.meta.env.VITE_API_URL || "";
    const res = await fetch(`${apiUrl}${path}`, {
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
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const idempotencyKey = `quote_${quoteId}_${Date.now()}`;
      await fetch(`${apiUrl}/v1/user/cases/${selectedSub.id}/quotes/${quoteId}/accept`, {
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
      {/* 우측 상단 언어 스위처 추가 */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-extrabold text-indigo-700 tracking-tight">{t('title')}</h1>
        <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
          <button onClick={() => i18n.changeLanguage('ko')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${i18n.language?.startsWith('ko') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>KO</button>
          <button onClick={() => i18n.changeLanguage('en')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${i18n.language?.startsWith('en') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>EN</button>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <label className="font-semibold text-slate-700 whitespace-nowrap">User Token:</label>
        <input 
          value={token} 
          onChange={e => handleSaveToken(e.target.value)} 
          className="flex-1 w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow" 
          placeholder="Firebase Auth Token" 
        />
        <button onClick={loadSubmissions} disabled={busy || !token} className="w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-lg transition-colors shadow-sm whitespace-nowrap">
          {t('auth_load')}
        </button>
      </div>

      {log && (
        <div className="bg-indigo-50 text-indigo-900 px-4 py-3 rounded-xl border border-indigo-100 text-sm font-medium shadow-sm">
          <strong className="text-indigo-700">Log:</strong> {log}
        </div>
      )}

      {token && (
        <div className="flex flex-col gap-8 items-start w-full">
          
          {/* Funnel Section */}
          <div className="w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-indigo-700 mb-6">{t('funnel_title')}</h2>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <input 
                value={funnelIntent} 
                onChange={e => setFunnelIntent(e.target.value)} 
                placeholder={t('funnel_placeholder')} 
                className="flex-1 w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow" 
              />
              <button onClick={startFunnel} disabled={busy || !funnelIntent} className="w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-lg transition-colors shadow-sm whitespace-nowrap">{t('funnel_start')}</button>
            </div>

            {funnelSessionId && currentQuestion && (
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 mb-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">{currentQuestion.text}</h3>
                {currentQuestion.type === "single_choice" && (
                  <div className="flex flex-wrap gap-3">
                    {currentQuestion.options.map((opt: string) => (
                      <button key={opt} onClick={() => { setFunnelAnswer(opt); submitFunnelAnswer(); }} disabled={busy} className={`px-5 py-2.5 rounded-lg border font-medium transition-colors ${funnelAnswer === opt ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {currentQuestion.type === "number" && (
                  <div className="flex gap-3">
                    <input type="number" value={funnelAnswer} onChange={e => setFunnelAnswer(e.target.value)} className="px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-32" />
                    <button onClick={submitFunnelAnswer} disabled={busy || !funnelAnswer} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors">다음</button>
                  </div>
                )}
              </div>
            )}

            {funnelPreview && !funnelResults && (
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <h4 className="text-indigo-800 font-bold mb-2 flex items-center gap-2">💡 가치 프리뷰 (실시간 계산)</h4>
                <div className="text-sm text-slate-700 space-y-1">
                  <p>예상 비용: <span className="font-semibold">{funnelPreview.minPrice.toLocaleString()}원 ~ {funnelPreview.maxPrice.toLocaleString()}원</span></p>
                  <p>소요 시간: <span className="font-semibold">{funnelPreview.etaDays}일</span></p>
                  <p>준비물: <span className="font-semibold">{funnelPreview.requiredDocs.join(", ")}</span></p>
                </div>
              </div>
            )}

            {funnelResults && (
              <div className="p-6 bg-orange-50 rounded-xl border border-orange-100 mt-6">
                <h3 className="text-xl font-bold text-orange-600 mb-6 flex items-center gap-2">🎉 매칭 결과</h3>
                
                {funnelResults.sponsored?.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-orange-800 mb-3 uppercase tracking-wider">[광고] 스폰서 파트너</h4>
                    <div className="flex flex-wrap gap-4">
                      {funnelResults.sponsored.map((p: any) => (
                        <div key={p.partnerId} className="p-4 bg-white border border-orange-200 rounded-xl w-56 shadow-sm hover:shadow-md transition-shadow">
                          <div className="font-bold text-slate-800 mb-1 truncate">{p.name}</div>
                          <div className="text-sm text-slate-500 mb-4">평점: {p.rating} / <span className="font-semibold text-slate-700">가격: {p.price?.toLocaleString()}원</span></div>
                          <button onClick={() => createSubmissionFromFunnel(p.partnerId)} disabled={busy} className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors text-sm">선택</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {funnelResults.recommended && (
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-emerald-800 mb-3 uppercase tracking-wider">👍 추천 1안</h4>
                    <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                      <div>
                        <div className="font-bold text-lg text-emerald-900 mb-1">{funnelResults.recommended.name}</div>
                        <div className="text-sm text-emerald-700">평점: {funnelResults.recommended.rating} / 예상 가격: <span className="font-semibold">{funnelResults.recommended.price?.toLocaleString()}원</span> / ETA: {funnelResults.recommended.etaHours}시간</div>
                      </div>
                      <button onClick={() => createSubmissionFromFunnel(funnelResults.recommended.partnerId)} disabled={busy} className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors shadow-sm">선택</button>
                    </div>
                  </div>
                )}

                {funnelResults.compareTop3?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-blue-800 mb-3 uppercase tracking-wider">비교 Top 3</h4>
                    <div className="flex flex-wrap gap-4">
                      {funnelResults.compareTop3.map((p: any) => (
                        <div key={p.partnerId} className="p-4 bg-white border border-blue-200 rounded-xl w-56 shadow-sm hover:shadow-md transition-shadow">
                          <div className="font-bold text-slate-800 mb-1 truncate">{p.name}</div>
                          <div className="text-sm text-slate-500 mb-4">평점: {p.rating} / <span className="font-semibold text-slate-700">가격: {p.price?.toLocaleString()}원</span></div>
                          <button onClick={() => createSubmissionFromFunnel(p.partnerId)} disabled={busy} className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-sm">선택</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
          
          {/* Submission List */}
          <div className="w-full lg:w-1/3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm shrink-0">
            <h2 className="text-xl font-bold text-indigo-700 mb-6 flex justify-between items-center">
              {t('my_submissions')}
              <button onClick={loadSubmissions} disabled={busy} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-md transition-colors border border-slate-200">{t('refresh')}</button>
            </h2>
            
            <div className="flex flex-col gap-4 mb-6 p-5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex flex-col xl:flex-row gap-3">
                <select 
                  value={selectedPackId} 
                  onChange={e => setSelectedPackId(e.target.value)} 
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">{t('pack_placeholder')}</option>
                  {casePacks.map(p => <option key={p.id} value={p.id}>{p.nameKo}</option>)}
                </select>
                <input 
                  value={newType} 
                  onChange={e => setNewType(e.target.value)} 
                  placeholder={t('legacy_placeholder')} 
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              <textarea 
                value={newPayload} 
                onChange={e => setNewPayload(e.target.value)} 
                placeholder={t('payload_placeholder')} 
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none" 
              />
              <div className="flex justify-between items-center mt-1">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={submitNow} onChange={e => setSubmitNow(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                  {t('submit_now')}
                </label>
                <button onClick={createSubmission} disabled={busy || (!newType && !selectedPackId) || !newPayload} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors">{t('create_new')}</button>
              </div>
            </div>

            {submissions.length === 0 ? (
              <div className="text-slate-400 text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">{t('empty_submissions')}</div>
            ) : (
              <div className="flex flex-col gap-3 mb-8 max-h-[600px] overflow-y-auto pr-2">
                {submissions.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => loadSubDetail(s.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${selectedSub?.id === s.id ? "bg-indigo-50 border-indigo-200 shadow-sm" : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm"}`}
                  >
                    <div>
                      <div className={`font-bold ${selectedSub?.id === s.id ? "text-indigo-900" : "text-slate-800"}`}>{s.input?.type}</div>
                      <div className="text-xs text-slate-500 mt-1">{new Date(s.updatedAt).toLocaleString()}</div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      ["completed"].includes(s.status) ? "bg-emerald-100 text-emerald-800" : 
                      ["failed", "cancelled", "cancel_requested"].includes(s.status) ? "bg-red-100 text-red-800" : 
                      "bg-blue-100 text-blue-800"
                    }`}>
                      {statusText[s.status] || s.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Notification Settings */}
              {notificationSettings && (
                <div className="border-t border-slate-200 pt-6 mt-2">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">알림 설정 (Omni-channel)</h3>
                  <div className="mb-6 text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <label className="flex items-center gap-3 mb-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notificationSettings.events?.submissionCompleted}
                        onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, submissionCompleted: e.target.checked } })}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="font-medium">Submission Completed (제출 완료)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notificationSettings.events?.submissionFailed}
                        onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, submissionFailed: e.target.checked } })}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="font-medium">Submission Failed (제출 실패)</span>
                    </label>
                  </div>
                  
                  {/* SMS 설정 */}
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-orange-700 mb-3 flex items-center gap-2">📱 SMS (문자)</h4>
                    {notificationSettings.channels?.sms?.map((s: any, idx: number) => (
                      <div key={idx} className="bg-orange-50 border border-orange-100 p-3 rounded-lg mb-2 text-sm flex justify-between items-center">
                        <div className="text-orange-900"><strong className="font-semibold">번호:</strong> {s.phoneNumber}</div>
                        <button onClick={() => {
                          const newSms = [...notificationSettings.channels.sms];
                          newSms.splice(idx, 1);
                          updateNotificationSettings({ ...notificationSettings, channels: { ...notificationSettings.channels, sms: newSms } });
                        }} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-xs font-medium transition-colors">삭제</button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-3">
                      <input placeholder="010-1234-5678" value={newSmsNumber} onChange={e => setNewSmsNumber(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                      <button onClick={addSms} disabled={busy || !newSmsNumber} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium rounded-lg transition-colors text-sm">추가</button>
                    </div>
                  </div>

                  {/* 카카오톡 설정 */}
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-yellow-600 mb-3 flex items-center gap-2">💬 카카오 알림톡</h4>
                    {notificationSettings.channels?.kakao?.map((k: any, idx: number) => (
                      <div key={idx} className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg mb-2 text-sm flex justify-between items-center">
                        <div className="text-yellow-900"><strong className="font-semibold">번호:</strong> {k.phoneNumber}</div>
                        <button onClick={() => {
                          const newKakao = [...notificationSettings.channels.kakao];
                          newKakao.splice(idx, 1);
                          updateNotificationSettings({ ...notificationSettings, channels: { ...notificationSettings.channels, kakao: newKakao } });
                        }} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-xs font-medium transition-colors">삭제</button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-3">
                      <input placeholder="010-1234-5678" value={newKakaoNumber} onChange={e => setNewKakaoNumber(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
                      <button onClick={addKakao} disabled={busy || !newKakaoNumber} className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-200 text-yellow-900 font-bold rounded-lg transition-colors text-sm">추가</button>
                    </div>
                  </div>

                  {/* 웹훅 설정 */}
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">🌐 웹훅 (Webhooks)</h4>
                  {notificationSettings.webhooks?.map((w: any, idx: number) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-lg mb-2 text-sm flex justify-between items-center">
                      <div className="text-slate-700 truncate mr-2">
                        <div className="truncate"><strong className="font-semibold">URL:</strong> {w.url}</div>
                        {w.secret && <div className="text-xs text-slate-500 mt-1"><strong className="font-semibold">Secret:</strong> ***</div>}
                      </div>
                      <button onClick={() => {
                        const newWebhooks = [...notificationSettings.webhooks];
                        newWebhooks.splice(idx, 1);
                        updateNotificationSettings({ ...notificationSettings, webhooks: newWebhooks });
                      }} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-xs font-medium transition-colors shrink-0">삭제</button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <input 
                    placeholder="https://my-server.com/webhook" 
                    value={newWebhookUrl} 
                    onChange={e => setNewWebhookUrl(e.target.value)} 
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                  />
                  <input 
                    placeholder="Secret (optional)" 
                    value={newWebhookSecret} 
                    onChange={e => setNewWebhookSecret(e.target.value)} 
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                  />
                  <button onClick={addWebhook} disabled={busy || !newWebhookUrl} className="w-full py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-medium rounded-lg transition-colors text-sm mt-1">
                    웹훅 추가
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Submission Detail */}
          {selectedSub && (
            <div className="w-full lg:w-2/3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm shrink-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-indigo-700 mb-1">유형: {selectedSub.input?.type}</h2>
                  <div className="text-sm text-slate-500 font-mono">ID: {selectedSub.id}</div>
                  {selectedSub.caseId && (
                    <div className="text-sm text-blue-700 font-semibold mt-2 flex items-center gap-1">
                      🔗 파트너 Case 연동됨: {selectedSub.caseId}
                    </div>
                  )}
                  {selectedSub.packageId && (
                    <div className="text-sm text-orange-600 font-semibold mt-1 flex items-center gap-1">
                      📦 패키지 연동됨: {selectedSub.packageId}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-3 w-full sm:w-auto">
                  <div className="flex items-center gap-3">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                      ["completed"].includes(selectedSub.status) ? "bg-emerald-100 text-emerald-800" : 
                      ["failed", "cancelled", "cancel_requested"].includes(selectedSub.status) ? "bg-red-100 text-red-800" : 
                      "bg-blue-100 text-blue-800"
                    }`}>
                      {statusText[selectedSub.status] || selectedSub.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap justify-end gap-2">
                    {selectedSub.status === "draft" && (
                      <button onClick={() => submitSubmission(selectedSub.id)} disabled={busy} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm">
                        제출하기 (Submit)
                      </button>
                    )}

                    {["draft", "submitted", "processing"].includes(selectedSub.status) && (
                      <button onClick={() => cancelSubmission(selectedSub.id)} disabled={busy} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm">
                        제출 취소
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    {lastPolledAt && (
                      <span className="text-xs text-slate-500 font-medium">
                        마지막 갱신: {lastPolledAt.toLocaleTimeString()}
                      </span>
                    )}
                    {pollError && (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-md font-bold">
                        ⚠️ 연결 오류
                      </span>
                    )}
                    <button 
                      onClick={() => loadSubDetail(selectedSub.id)} 
                      disabled={busy} 
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium underline decoration-blue-300 underline-offset-2 transition-colors"
                    >
                      새로고침
                    </button>
                  </div>
                </div>
              </div>

              {/* 견적 확인 및 동의 */}
              <div className="mb-8 p-6 bg-slate-50 border border-slate-200 rounded-xl">
                <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">💰 견적 확인 및 동의</h3>
                {quotes.length === 0 ? (
                  <div className="text-slate-400 text-sm bg-white p-4 rounded-lg border border-dashed border-slate-200 text-center">제안된 견적이 없습니다.</div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {quotes.map(q => (
                      <div key={q.id} className={`border rounded-xl p-5 shadow-sm transition-colors ${q.status === "finalized" ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200"}`}>
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-bold text-slate-800">
                            상태: <span className={q.status === "finalized" ? "text-blue-700" : "text-slate-600"}>{q.status === "draft" ? "예상 견적 (제안됨)" : q.status === "finalized" ? "최종 확정 (동의 대기)" : q.status === "accepted" ? "동의 완료" : q.status}</span>
                          </span>
                          <span className="text-xs text-slate-500 font-medium">{new Date(q.createdAt).toLocaleString()}</span>
                        </div>

                        <div className="text-sm text-slate-600 bg-slate-100 p-3 rounded-lg border border-slate-200 mb-3">
                          예상 범위: <span className="font-bold text-slate-800">{q.priceMin.toLocaleString()} ~ {q.priceMax.toLocaleString()} 원</span> ({q.etaMinHours}~{q.etaMaxHours}시간)
                        </div>

                        {q.finalPrice && (
                          <div className="mt-2 text-lg font-black text-orange-600">
                            최종 확정액: {q.finalPrice.toLocaleString()} 원
                          </div>
                        )}

                        {q.assumptionsKo && q.assumptionsKo.length > 0 && (
                          <div className="mt-4 text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-100">
                            <strong className="text-slate-800 block mb-2">전제 조건:</strong>
                            <ul className="list-disc pl-5 space-y-1 text-slate-600">
                              {q.assumptionsKo.map((asm: string, idx: number) => <li key={idx}>{asm}</li>)}
                            </ul>
                          </div>
                        )}

                        {q.status === "finalized" && (
                          <button 
                            onClick={() => acceptQuote(q.id)} 
                            disabled={busy} 
                            className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-sm"
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
                <div className="mb-8 p-6 bg-orange-50 border border-orange-200 rounded-xl">
                  <h3 className="text-lg font-bold text-orange-800 mb-4 flex items-center gap-2">💳 결제 정보</h3>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="text-2xl font-black text-slate-800 mb-1">{payment.amount.toLocaleString()} <span className="text-lg font-bold text-slate-500">{payment.currency}</span></div>
                      <div className="text-xs text-slate-500 font-mono">결제 ID: {payment.id}</div>
                      {payment.provider === "stripe" && (
                        <div className="text-xs font-bold text-indigo-600 mt-2 bg-indigo-100 px-2 py-1 rounded inline-block">Stripe 결제</div>
                      )}
                      {payment.provider === "tosspayments" && (
                        <div className="text-xs font-bold text-blue-600 mt-2 bg-blue-100 px-2 py-1 rounded inline-block">Toss 결제</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end w-full sm:w-auto">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                        payment.status === "captured" ? "bg-emerald-100 text-emerald-800" : 
                        payment.status === "confirm" ? "bg-blue-100 text-blue-800" : 
                        payment.status === "initiated" ? "bg-orange-100 text-orange-800" : 
                        "bg-red-100 text-red-800"
                      }`}>
                        {payment.status.toUpperCase()}
                      </span>
                      
                      <div className="mt-4 w-full sm:w-auto flex flex-col gap-2">
                        {payment.status === "initiated" && payment.provider === "stripe" && payment.checkoutUrl && (
                          <button
                            onClick={() => {
                              window.location.href = payment.checkoutUrl;
                            }}
                            disabled={busy}
                            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-sm"
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
                            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-sm"
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
                            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors shadow-sm"
                          >
                            결제 승인 (Confirm Mock)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* B2G 공공기관 처리 현황 (EP-13) */}
              {(b2gItems.length > 0 || b2gFees.length > 0) && (
                <div className="mb-8 p-6 bg-lime-50 border border-lime-200 rounded-xl">
                  <h3 className="text-lg font-bold text-lime-800 mb-4 flex items-center gap-2">🏛️ 공공기관 처리 현황 (B2G E-Filing)</h3>
                  
                  {b2gItems.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-bold text-lime-900 mb-3">제출 내역</h4>
                      <div className="flex flex-col gap-3">
                        {b2gItems.map(item => (
                          <div key={item.id} className="bg-white p-4 rounded-xl border border-lime-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
                            <div>
                              <div className="font-bold text-lime-800 text-lg">{item.agency}</div>
                              <div className="text-sm text-slate-600 mt-1">
                                상태: <span className="font-semibold text-slate-800">{item.agencyStatus || "제출 대기중"}</span> {item.receiptNumber && <span className="ml-2 text-slate-500">| 접수번호: <span className="font-mono text-slate-700">{item.receiptNumber}</span></span>}
                              </div>
                              {item.actionDetails && (
                                <div className="mt-2 text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1.5 rounded-lg inline-block">
                                  ⚠️ 보정사유: {item.actionDetails}
                                </div>
                              )}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                              item.status === "completed" ? "bg-emerald-100 text-emerald-800" : 
                              item.status === "action_required" ? "bg-red-100 text-red-800" : 
                              "bg-slate-200 text-slate-700"
                            }`}>
                              {item.status.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {b2gFees.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-yellow-700 mb-3">공과금 및 수수료</h4>
                      <div className="flex flex-col gap-3">
                        {b2gFees.map(fee => (
                          <div key={fee.id} className="bg-white p-4 rounded-xl border border-yellow-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
                            <div>
                              <div className="font-bold text-yellow-700 text-lg">{fee.agency} - {fee.feeType === "tax" ? "세금" : "수수료"}</div>
                              <div className="text-sm text-slate-600 mt-1">
                                금액: <span className="font-bold text-slate-800">{fee.amount?.toLocaleString()} 원</span> {fee.paymentNumber && <span className="ml-2 text-slate-500">| 납부번호: <span className="font-mono text-slate-700">{fee.paymentNumber}</span></span>}
                              </div>
                              {fee.errorMessage && <div className="mt-2 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded inline-block">오류: {fee.errorMessage}</div>}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                              fee.status === "paid" ? "bg-emerald-100 text-emerald-800" : 
                              fee.status === "failed" ? "bg-red-100 text-red-800" : 
                              "bg-yellow-100 text-yellow-800"
                            }`}>
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
                <div className="mb-8 p-5 bg-cyan-50 border border-cyan-200 rounded-xl">
                  <h3 className="text-md font-bold text-cyan-800 mb-3 flex items-center gap-2">🧭 사건 워크플로우 (Dynamic Workflow)</h3>
                  <div className="flex flex-col sm:flex-row gap-4 text-sm text-slate-700">
                    <div className="bg-white px-4 py-2 rounded-lg border border-cyan-100 shadow-sm flex-1"><strong className="block text-cyan-900 mb-1">진행 단계 (Stages):</strong> {workflowState.stages?.join(" ➔ ") || "없음"}</div>
                    <div className="bg-white px-4 py-2 rounded-lg border border-cyan-100 shadow-sm flex-1"><strong className="block text-cyan-900 mb-1">필요 증거 슬롯 (Required):</strong> {workflowState.requiredSlots?.join(", ") || "없음"}</div>
                  </div>
                </div>
              )}

              {/* 동적 폼 데이터 입력 (Phase 4) */}
              {selectedSub.caseId && selectedSub.status === "draft" && (
                <div className="mb-8 p-5 bg-purple-50 border border-purple-200 rounded-xl">
                  <h3 className="text-md font-bold text-purple-800 mb-2 flex items-center gap-2">⚙️ 동적 폼 입력 (Dynamic Form)</h3>
                  <div className="text-sm text-purple-600 mb-4">
                    사건팩(Case Pack)에 정의된 JSON 스키마에 맞춰 데이터를 입력합니다.
                  </div>
                  <textarea 
                    value={dynamicFormData} 
                    onChange={e => setDynamicFormData(e.target.value)} 
                    className="w-full h-32 p-4 font-mono text-sm rounded-lg border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-inner resize-y"
                  />
                  <div className="mt-3 flex justify-end">
                    <button 
                      onClick={() => saveDynamicFormData(selectedSub.caseId)} 
                      disabled={busy || !dynamicFormData}
                      className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-medium rounded-lg transition-colors shadow-sm"
                    >
                      동적 데이터 저장
                    </button>
                  </div>
                </div>
              )}

              {/* 입력 데이터 */}
              <div className="mb-8 p-5 bg-slate-50 border border-slate-200 rounded-xl">
                <h3 className="text-md font-bold text-slate-700 mb-3 flex items-center gap-2">📝 입력 정보 (Payload)</h3>
                <pre className="m-0 text-sm whitespace-pre-wrap text-slate-600 bg-white p-4 rounded-lg border border-slate-200 overflow-x-auto shadow-inner">
                  {JSON.stringify(selectedSub.input?.payload, null, 2)}
                </pre>
              </div>

              {/* 결과 (완료/실패) */}
              {selectedSub.result && (
                <div className={`mb-8 p-6 rounded-xl border ${selectedSub.status === "completed" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                  <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${selectedSub.status === "completed" ? "text-emerald-800" : "text-red-800"}`}>
                    {selectedSub.status === "completed" ? "✅ 처리 결과" : "❌ 처리 실패"}
                  </h3>
                  
                  {selectedSub.result.summary && (
                    <div className="mb-4 text-slate-700 bg-white p-4 rounded-lg border border-slate-100 shadow-sm">{selectedSub.result.summary}</div>
                  )}

                  {selectedSub.status === "completed" && selectedSub.packageId && (
                    <div className="mt-4 flex flex-wrap gap-3 items-center">
                      <button onClick={() => downloadResultZip(selectedSub.id)} disabled={busy} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold rounded-lg transition-colors shadow-sm">
                        Download result ZIP
                      </button>
                      {packageChecksum && (
                        <div className="text-sm text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg flex gap-3 items-center shadow-sm">
                          <span className="font-mono text-slate-800 truncate max-w-[200px] sm:max-w-xs">{packageChecksum}</span>
                          <button
                            onClick={() => navigator.clipboard?.writeText?.(packageChecksum)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-md transition-colors shrink-0"
                          >
                            복사
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {selectedSub.result.artifactUrl && (
                    <div className="mt-4">
                      <a href={selectedSub.result.artifactUrl} target="_blank" rel="noreferrer" className="inline-block px-5 py-2.5 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-lg transition-colors shadow-sm">
                        Legacy artifactUrl 다운로드
                      </a>
                    </div>
                  )}

                  {selectedSub.result.error && (
                    <div className="mt-2 text-sm text-red-700 bg-white p-4 rounded-lg border border-red-100 shadow-sm">
                      <strong className="text-red-800">[{selectedSub.result.error.category}]</strong> {selectedSub.result.error.message}
                    </div>
                  )}
                </div>
              )}

              {/* 증거 파일 목록 (연동된 Case 기준) */}
              {selectedSub.caseId && (
                <div className="mb-8 p-6 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold text-slate-800 m-0 flex items-center gap-2">📁 증거 파일 (Evidences)</h3>
                  </div>
                  {/* 향후 증거 목록 조회/다운로드 API 연동 필요 시 여기에 구현 */}
                  <div className="text-sm text-slate-500 bg-white p-4 rounded-lg border border-dashed border-slate-200 text-center">
                    파트너 시스템에 연동된 증거 파일 목록은 별도 API를 통해 제공될 수 있습니다.
                  </div>
                </div>
              )}

              {/* 추가 서류 요청 (Evidence Requests) */}
              {evidenceRequests.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-orange-700 border-b border-slate-200 pb-3 mb-4 flex items-center gap-2">📨 요청된 추가 서류</h3>
                  <div className="flex flex-col gap-4">
                    {evidenceRequests.map(r => (
                      <div key={r.id} className={`p-5 border rounded-xl shadow-sm ${r.status === "fulfilled" ? "bg-emerald-50 border-emerald-200" : "bg-orange-50 border-orange-200"}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                          <div className={`font-bold text-lg ${r.status === "fulfilled" ? "text-emerald-800" : "text-orange-800"}`}>
                            {r.messageToUserKo}
                          </div>
                          <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide self-start sm:self-auto ${
                            r.status === "fulfilled" ? "bg-emerald-100 text-emerald-800" : 
                            r.status === "cancelled" ? "bg-slate-200 text-slate-700" : 
                            "bg-orange-100 text-orange-800"
                          }`}>
                            {r.status.toUpperCase()}
                          </span>
                        </div>
                        {r.status === "open" && (
                          <div className="mt-4 bg-white rounded-lg border border-orange-100 overflow-hidden">
                            {r.items.map((item: any, idx: number) => (
                              <div key={idx} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 ${idx > 0 ? "border-t border-orange-100" : ""}`}>
                                <div>
                                  <span className={`font-bold mr-2 text-base ${item.status === "fulfilled" ? "text-slate-400 line-through" : "text-slate-800"}`}>{item.titleKo}</span>
                                  <span className="text-xs text-slate-500 font-mono">({item.code})</span>
                                  {item.required && <span className={`ml-2 text-xs font-bold ${item.status === "fulfilled" ? "text-slate-400" : "text-red-600 bg-red-50 px-2 py-0.5 rounded"}`}>*필수</span>}
                                  {item.status === "fulfilled" && <span className="ml-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">✅ 완료됨</span>}
                                </div>
                                <div className="shrink-0">
                                  <input 
                                    type="file" 
                                    id={`file-${r.id}-${item.code}`}
                                    className="hidden"
                                    accept=".pdf,image/png,image/jpeg,image/jpg"
                                    onChange={(e) => handleUploadMissingEvidence(e, r.id, item.code)}
                                  />
                                  <button 
                                    onClick={() => document.getElementById(`file-${r.id}-${item.code}`)?.click()}
                                    disabled={busy || r.status !== "open" || item.status === "fulfilled"}
                                    className={`w-full sm:w-auto px-5 py-2 font-bold rounded-lg transition-colors shadow-sm ${
                                      item.status === "fulfilled" ? "bg-slate-200 text-slate-500 cursor-not-allowed" : 
                                      "bg-orange-500 hover:bg-orange-600 text-white"
                                    }`}
                                  >
                                    {uploadingRequestId === r.id ? "업로드 중..." : item.status === "fulfilled" ? "제출 완료" : "파일 업로드"}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {r.status === "fulfilled" && (
                          <div className="mt-4 text-sm text-emerald-700 bg-white p-3 rounded-lg border border-emerald-100 font-medium flex items-center gap-2">
                            ✅ 추가 서류 제출이 완료되었습니다. 파트너 확인을 대기 중입니다.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 진행 이벤트 타임라인 */}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-3 mb-6 flex items-center gap-2">⏱️ 진행 타임라인</h3>
                
                {events.length === 0 ? (
                  <div className="text-slate-400 text-sm bg-slate-50 p-6 rounded-xl border border-dashed border-slate-200 text-center">기록된 이벤트가 없습니다.</div>
                ) : (
                  <div className="relative pl-6 border-l-2 border-slate-200 ml-3 py-2 space-y-6">
                    {events.map((ev, i) => (
                      <div key={ev.id} className="relative">
                        {/* 타임라인 노드 마커 */}
                        <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                          ["completed"].includes(ev.type) ? "bg-emerald-500" : 
                          ["failed", "cancelled"].includes(ev.type) ? "bg-red-500" : 
                          "bg-indigo-500"
                        }`} />
                        
                        <div className="text-xs font-semibold text-slate-500 mb-1">{new Date(ev.createdAt).toLocaleString()}</div>
                        <div className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-sm">{ev.type}</div>
                        <div className="text-sm text-slate-700 bg-white p-4 rounded-xl border border-slate-200 shadow-sm leading-relaxed">{ev.message}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                {selectedSub.status === "processing" && (
                  <div className="mt-6 pl-8 text-sm text-blue-600 font-bold italic bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-3 shadow-sm">
                    <span className="animate-spin">⚙️</span> 현재 처리 중입니다. 잠시 후 새로고침 해주세요...
                  </div>
                )}
              </div>

            </div>
          )}
          </div>
        </div>
      )}
      </div>
      
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
