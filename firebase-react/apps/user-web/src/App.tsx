import React, { useState, useEffect, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";

import { auth } from "@rp/firebase";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getApiBaseUrl } from "./apiBase";

import WelcomeScreen from "./components/WelcomeScreen";

const FloatingChatWidget = lazy(() => import("./components/FloatingChatWidget"));
const TossPaymentModal = lazy(() => import("./components/TossPaymentModal"));

function App() {
  const { t, i18n } = useTranslation();
  const [token, setToken] = useState("");
  const [showTossModal, setShowTossModal] = useState(false);
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);
  const [tossHandled, setTossHandled] = useState(false);

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

  const user = auth.currentUser || null;

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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken(true);
          setToken(idToken);
          setLog("자동 로그인되었습니다.");
        } catch (e) {
          console.error("Token fetch error", e);
        }
      } else {
        setToken("");
      }
    });

    return () => unsubscribe();
  }, []);

  async function handleGoogleLogin() {
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      setLog(`[Error] 로그인 실패: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailLogin(email: string, password: string) {
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e: any) {
      setLog(`[Error] 로그인 실패: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSignUp(email: string, password: string) {
    setBusy(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (e: any) {
      setLog(`[Error] 가입 실패: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    setLog("로그아웃 되었습니다.");
  }

  useEffect(() => {
    if (tossHandled) return;
    if (!token) return;
    const searchParams = new URLSearchParams(window.location.search);
    const tossSuccess = searchParams.get('tossSuccess');
    const tossFail = searchParams.get('tossFail');
    const paymentId = searchParams.get('paymentId');
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amountStr = searchParams.get('amount');

    if (tossSuccess && paymentId && paymentKey && orderId && amountStr) {
      setTossHandled(true);
      setLog(`토스페이먼츠 결제 승인 진행 중...`);
      setBusy(true);
      
      const doConfirm = async () => {
        try {
          const apiUrl = getApiBaseUrl();
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
      setTossHandled(true);
      const message = searchParams.get('message') || "결제가 취소되었거나 실패했습니다.";
      setLog(`[Error] 토스 결제 실패: ${message}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [token, tossHandled]);

  async function apiGet(path: string) {
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || "API Error");
    return data.data;
  }

  async function apiPost(path: string, body: any) {
    const apiUrl = getApiBaseUrl();
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
      const apiUrl = getApiBaseUrl();
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

  if (!token) {
    return (
      <WelcomeScreen
        busy={busy}
        log={log}
        onGoogleLogin={handleGoogleLogin}
        onEmailLogin={handleEmailLogin}
        onEmailSignUp={handleEmailSignUp}
      />
    );
  }

  return (
    <div className="dash-root">
      <div className="dash-container">
        
        {/* Header */}
        <header className="dash-header">
          <h1 className="dash-title">AgentRegi</h1>
          <div className="dash-nav">
            <span>{t('auth_load')}</span>
            <button onClick={() => i18n.changeLanguage('ko')} className="dash-nav-btn" style={{ fontWeight: i18n.language?.startsWith('ko') ? 600 : 400, color: i18n.language?.startsWith('ko') ? 'var(--text-primary)' : '' }}>KO</button>
            <span style={{color: 'var(--border-strong)'}}>·</span>
            <button onClick={() => i18n.changeLanguage('en')} className="dash-nav-btn" style={{ fontWeight: i18n.language?.startsWith('en') ? 600 : 400, color: i18n.language?.startsWith('en') ? 'var(--text-primary)' : '' }}>EN</button>
            <span style={{color: 'var(--border-strong)'}}>·</span>
            <button onClick={handleLogout} className="dash-nav-btn">로그아웃</button>
          </div>
        </header>

        {log && (
          <div className="wc-log wc-log--neutral" style={{ marginBottom: '2rem' }}>
            {log}
          </div>
        )}

        {token && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5rem' }}>
            
            {/* Action Section */}
            <section className="dash-section">
              <div className="dash-section-header">
                <h2 className="dash-section-title">신규 의뢰 시작</h2>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input 
                  value={funnelIntent} 
                  onChange={e => setFunnelIntent(e.target.value)} 
                  placeholder={t('funnel_placeholder')} 
                  className="dash-input"
                />
                <button onClick={startFunnel} disabled={busy || !funnelIntent} className="dash-button" style={{ whiteSpace: 'nowrap' }}>
                  {t('funnel_start')}
                </button>
              </div>

              {funnelSessionId && currentQuestion && (
                <div className="dash-card" style={{ marginTop: '1.5rem' }}>
                  <h3 className="dash-card-title" style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>{currentQuestion.text}</h3>
                  {currentQuestion.type === "single_choice" && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                      {currentQuestion.options.map((opt) => (
                        <button 
                          key={opt} 
                          onClick={() => { setFunnelAnswer(opt); submitFunnelAnswer(); }} 
                          disabled={busy} 
                          className="dash-button dash-button--outline"
                          style={funnelAnswer === opt ? { backgroundColor: 'var(--surface)', borderColor: 'var(--text-primary)' } : {}}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {currentQuestion.type === "number" && (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <input type="number" value={funnelAnswer} onChange={e => setFunnelAnswer(e.target.value)} className="dash-input" style={{ width: '150px' }} />
                      <button onClick={submitFunnelAnswer} disabled={busy || !funnelAnswer} className="dash-button">다음</button>
                    </div>
                  )}
                </div>
              )}

              {funnelPreview && !funnelResults && (
                <div className="dash-card" style={{ marginTop: '1.5rem', backgroundColor: 'var(--brand-faint)' }}>
                  <h4 className="dash-card-title" style={{ fontSize: '1rem' }}>가치 프리뷰</h4>
                  <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
                    <div>
                      <span className="dash-label">예상 비용</span>
                      <div className="dash-value" style={{ marginBottom: 0 }}>{funnelPreview.minPrice.toLocaleString()}원 ~ {funnelPreview.maxPrice.toLocaleString()}원</div>
                    </div>
                    <div>
                      <span className="dash-label">소요 시간</span>
                      <div className="dash-value" style={{ marginBottom: 0 }}>{funnelPreview.etaDays}일</div>
                    </div>
                  </div>
                </div>
              )}

              {funnelResults && (
                <div className="dash-card" style={{ marginTop: '1.5rem' }}>
                  <h3 className="dash-card-title">매칭 결과</h3>
                  
                  {funnelResults.recommended && (
                    <div style={{ marginTop: '2rem' }}>
                      <span className="dash-label" style={{ color: 'var(--brand)' }}>추천 파트너</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>{funnelResults.recommended.name}</div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            예상 가격: {funnelResults.recommended.price?.toLocaleString()}원 · ETA: {funnelResults.recommended.etaHours}시간
                          </div>
                        </div>
                        <button onClick={() => createSubmissionFromFunnel(funnelResults.recommended.partnerId)} disabled={busy} className="dash-button">
                          선택
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* List Section */}
            <section className="dash-section">
              <div className="dash-section-header">
                <h2 className="dash-section-title">{t('my_submissions')}</h2>
                <button onClick={loadSubmissions} disabled={busy} className="dash-nav-btn" style={{ fontSize: '0.875rem' }}>{t('refresh')}</button>
              </div>

              {submissions.length === 0 ? (
                <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                  {t('empty_submissions')}
                </div>
              ) : (
                <div>
                  {submissions.map(s => (
                    <div key={s.id} className="dash-item" onClick={() => loadSubDetail(s.id)} style={{ cursor: 'pointer' }}>
                      <div className="dash-item-header">
                        <div className="dash-item-title" style={{ color: selectedSub?.id === s.id ? 'var(--brand)' : 'var(--text-primary)' }}>{s.input?.type || '알 수 없는 유형'}</div>
                        <div className={`dash-item-status ${["failed", "cancelled"].includes(s.status) ? "dash-item-status--error" : ""}`}>
                          {statusText[s.status] || s.status.toUpperCase()}
                        </div>
                      </div>
                      <div className="dash-item-meta">
                        {new Date(s.updatedAt).toLocaleString()} · ID: {s.id.slice(0,8)}...
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Detail Section */}
            {selectedSub && (
              <section className="dash-section">
                <div className="dash-section-header">
                  <h2 className="dash-section-title">상세 정보</h2>
                  <button onClick={() => loadSubDetail(selectedSub.id)} disabled={busy} className="dash-nav-btn" style={{ fontSize: '0.875rem' }}>새로고침</button>
                </div>

                <div className="dash-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <div>
                      <h3 className="dash-title" style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{selectedSub.input?.type}</h3>
                      <div className="dash-item-meta">ID: {selectedSub.id}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className={`dash-item-status ${["failed", "cancelled"].includes(selectedSub.status) ? "dash-item-status--error" : ""}`} style={{ fontSize: '0.875rem' }}>
                        {statusText[selectedSub.status] || selectedSub.status.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {selectedSub.status === "draft" && (
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                      <button onClick={() => submitSubmission(selectedSub.id)} disabled={busy} className="dash-button">제출하기</button>
                      <button onClick={() => cancelSubmission(selectedSub.id)} disabled={busy} className="dash-button dash-button--outline">취소</button>
                    </div>
                  )}

                  {/* Quotes */}
                  {quotes.length > 0 && (
                    <div style={{ marginTop: '3rem' }}>
                      <span className="dash-label">견적 제안</span>
                      {quotes.map(q => (
                        <div key={q.id} style={{ padding: '1.5rem', border: '1px solid var(--border)', marginTop: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div style={{ fontWeight: 600 }}>{q.priceMin.toLocaleString()} ~ {q.priceMax.toLocaleString()} 원</div>
                            <div className="dash-item-status">{q.status}</div>
                          </div>
                          {q.assumptionsKo && (
                            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                              {q.assumptionsKo.map((asm, idx) => <li key={idx}>{asm}</li>)}
                            </ul>
                          )}
                          {q.status === "finalized" && (
                            <button onClick={() => acceptQuote(q.id)} disabled={busy} className="dash-button" style={{ marginTop: '1.5rem', width: '100%' }}>견적 동의 및 결제</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Timeline */}
                  {events.length > 0 && (
                    <div style={{ marginTop: '3rem' }}>
                      <span className="dash-label">진행 내역</span>
                      <div style={{ marginTop: '1rem' }}>
                        {events.map(ev => (
                          <div key={ev.id} style={{ padding: '1rem 0', borderTop: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>{new Date(ev.createdAt).toLocaleString()}</div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{ev.type.toUpperCase()}</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ev.message}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

          </div>
        )}
      </div>

      {/* Modals */}
      <Suspense fallback={null}>
        <FloatingChatWidget token={token} />
      </Suspense>
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
            onClose={() => { setShowTossModal(false); setBusy(false); }}
            onError={(err) => { setLog(`[Error] 결제 오류: ${err.message || err}`); setShowTossModal(false); setBusy(false); }}
          />
        )}
      </Suspense>
    </div>
  );
}

export default App;
