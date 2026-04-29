import React, { useState, useEffect, useRef, Suspense, lazy } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";
import { auth } from "@rp/firebase";

const FloatingChatWidget = lazy(() => import("../components/FloatingChatWidget"));
const TossPaymentModal = lazy(() => import("../components/TossPaymentModal"));

export default function SubmissionDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [workflowState, setWorkflowState] = useState<any | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [showTossModal, setShowTossModal] = useState(false);
  const [paymentData, setPaymentData] = useState<any | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function asArray<T = any>(value: any): T[] {
    if (Array.isArray(value)) return value as T[];
    if (Array.isArray(value?.items)) return value.items as T[];
    return [];
  }

  const statusText: Record<string, string> = {
    draft: "작성 중", submitted: "접수됨", processing: "처리 중",
    completed: "등기 완료", failed: "실패", cancelled: "취소됨"
  };

  useEffect(() => { if (id && token) loadSubDetail(id); }, [id, token]);

  useEffect(() => {
    if (!id || !token) return;
    const paymentResult = searchParams.get("payment");
    if (paymentResult === "success") {
      const paymentKey = searchParams.get("paymentKey");
      const orderId = searchParams.get("orderId");
      const amountParam = searchParams.get("amount");
      if (paymentKey && orderId && amountParam) {
        setLog("결제 승인 중...");
        setPaymentStatus("confirming");
        confirmPayment(paymentKey, orderId, Number(amountParam), id);
      }
    } else if (paymentResult === "fail") {
      const message = searchParams.get("message") || "결제가 취소되었거나 실패했습니다.";
      setLog(`[Error] 결제 실패: ${message}`);
      setPaymentStatus("failed");
    }
  }, [searchParams]);

  async function apiGet(path: string) {
    const res = await fetch(`${getApiBaseUrl()}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.messageKo || json.error?.code || 'API Error');
    return json.data;
  }

  async function apiPost(path: string, body: any) {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.messageKo || json.error?.code || 'API Error');
    return json.data;
  }

  async function loadSubDetail(subId: string) {
    setBusy(true); setLog("");
    try {
      const data = await apiGet(`/v1/user/submissions/${subId}`);
      setSelectedSub(data?.submission || data);
      const evs = await apiGet(`/v1/user/submissions/${subId}/events`);
      setEvents(asArray(evs));
      const qs = await apiGet(`/v1/cases/${subId}/quotes`);
      setQuotes(asArray(qs));
      const wf = await apiGet(`/v1/cases/${subId}/workflow`);
      setWorkflowState(wf);
      const docs = await apiGet(`/v1/cases/${subId}/documents`);
      setDocuments(asArray(docs));
    } catch (e: any) { setLog(`[Error] ${e.message}`); } finally { setBusy(false); }
  }

  async function acceptQuote(quoteId: string) {
    if (!selectedSub) return;
    setBusy(true); setLog("결제 준비 중...");
    try {
      await fetch(`${getApiBaseUrl()}/v1/user/cases/${selectedSub.id}/quotes/${quoteId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": `quote_${quoteId}_${Date.now()}` },
        body: JSON.stringify({})
      });
      const acceptedQuote = quotes.find((q: any) => q.id === quoteId);
      const amount = acceptedQuote?.totalAmount || 0;
      const payResp = await apiPost("/v1/user/payments", { amount, currency: "KRW", caseId: selectedSub.id, provider: "tosspayments" });
      setPaymentData(payResp?.payment || payResp);
      setPaymentStatus("initiated");
      setShowTossModal(true);
      setLog("");
    } catch (e: any) { setLog(`[Error] ${e.message}`); setPaymentStatus("failed"); } finally { setBusy(false); }
  }

  async function confirmPayment(paymentKey: string, orderId: string, amount: number, subId: string) {
    setBusy(true);
    try {
      const paymentId = paymentData?.id;
      if (!paymentId) {
        const payResult = await apiGet(`/v1/user/payments?caseId=${subId}`);
        const payments = asArray(payResult);
        const matching = payments.find((p: any) => p.orderId === orderId);
        if (!matching?.id) throw new Error("결제 정보를 찾을 수 없습니다.");
        await apiPost(`/v1/user/payments/${matching.id}/confirm`, { paymentKey, orderId, amount });
      } else {
        await apiPost(`/v1/user/payments/${paymentId}/confirm`, { paymentKey, orderId, amount });
      }
      setPaymentStatus("captured");
      await loadSubDetail(subId);
      setLog("");
    } catch (e: any) { setLog(`[Error] 결제 승인 실패: ${e.message}`); setPaymentStatus("failed"); } finally { setBusy(false); }
  }

  async function uploadDocument(file: File) {
    if (!selectedSub) return;
    setBusy(true); setLog("서류 업로드 중...");
    try {
      const res = await apiPost(`/v1/cases/${selectedSub.id}/documents/upload-url`, { docType: 'user_upload', fileName: file.name, contentType: file.type });
      if (!res?.uploadUrl) throw new Error("업로드 URL 오류");
      await fetch(res.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      const docs = await apiGet(`/v1/cases/${selectedSub.id}/documents`);
      setDocuments(asArray(docs));
      setLog("");
    } catch (e: any) { setLog(`[Error] ${e.message}`); } finally { setBusy(false); }
  }

  if (!selectedSub) return <div className="uw-container"><div style={{ textAlign: 'center', padding: '100px', color: 'var(--uw-fog)' }}>{log || "불러오는 중..."}</div></div>;

  return (
    <div className="uw-container" style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div className="uw-detail-header">
        <button onClick={() => navigate("/")} className="uw-btn uw-btn-ghost uw-btn-sm" style={{ marginBottom: 16, padding: 0 }}>← 대시보드</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <span className={`uw-badge ${selectedSub.status === 'completed' ? 'uw-badge-success' : 'uw-badge-brand'}`}>
                {statusText[selectedSub.status] || selectedSub.status}
              </span>
              <span style={{ fontFamily: "var(--uw-font-mono)", fontSize: 13, color: "var(--uw-fog)" }}>{selectedSub.id}</span>
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{selectedSub.input?.type || "등기 사건"}</h1>
          </div>
          <div style={{ textAlign: "right", color: "var(--uw-slate)", fontSize: 14 }}>
            최종 업데이트: {new Date(selectedSub.updatedAt).toLocaleString()}
          </div>
        </div>
      </div>

      {log && (
        <div style={{ padding: "16px", borderRadius: "12px", background: log.startsWith("[Error]") ? "var(--uw-danger-soft)" : "var(--uw-surface)", color: log.startsWith("[Error]") ? "var(--uw-danger)" : "var(--uw-ink)", marginBottom: "32px", fontSize: 14 }}>
          {log}
        </div>
      )}

      <div className="uw-detail-grid">
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          
          {/* Quotes Section */}
          {quotes.length > 0 && (
            <div className="uw-card" style={{ padding: 32 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 24px" }}>비용 결제</h2>
              <div style={{ display: "grid", gap: 16 }}>
                {quotes.map((q: any) => (
                  <div key={q.id} style={{ padding: 24, borderRadius: 16, background: q.status === 'accepted' ? "var(--uw-success-soft)" : "var(--uw-surface)", border: "1px solid", borderColor: q.status === 'accepted' ? "var(--uw-success)" : "var(--uw-border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 14, color: "var(--uw-slate)", marginBottom: 4 }}>총 결제 금액</div>
                        <div className="uw-tabular" style={{ fontSize: 28, fontWeight: 800, color: "var(--uw-ink)" }}>{q.totalAmount.toLocaleString()}원</div>
                        <div style={{ fontSize: 13, color: "var(--uw-fog)", marginTop: 8 }}>수수료 {q.feeAmount.toLocaleString()}원 · 세금 {q.taxAmount.toLocaleString()}원</div>
                      </div>
                      <div>
                        {q.status === 'draft' ? (
                          <button onClick={() => acceptQuote(q.id)} disabled={busy} className="uw-btn uw-btn-brand">결제하기</button>
                        ) : (
                          <div style={{ fontWeight: 700, color: "var(--uw-success)" }}>✓ 결제 완료</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents Section */}
          <div className="uw-card" style={{ padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>제출 서류</h2>
              <button onClick={() => fileInputRef.current?.click()} disabled={busy} className="uw-btn uw-btn-soft uw-btn-sm">+ 서류 업로드</button>
              <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { uploadDocument(f); e.target.value = ''; } }} />
            </div>

            {documents.length > 0 ? (
              <div style={{ display: "grid", gap: 12 }}>
                {documents.map((doc: any) => (
                  <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, background: "var(--uw-surface)", borderRadius: 12 }}>
                    <div style={{ width: 40, height: 40, background: "var(--uw-bg)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📄</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.fileName || doc.name || '-'}</div>
                      <div style={{ fontSize: 12, color: "var(--uw-fog)", marginTop: 4 }}>{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}</div>
                    </div>
                    {doc.status === 'approved' ? (
                      <span className="uw-badge uw-badge-success">승인됨</span>
                    ) : doc.status === 'rejected' ? (
                      <span className="uw-badge uw-badge-warning">반려됨</span>
                    ) : (
                      <span className="uw-badge">업로드됨</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: "center", background: "var(--uw-surface)", borderRadius: 16, color: "var(--uw-slate)", fontSize: 15 }}>
                아직 제출된 서류가 없습니다.
              </div>
            )}
          </div>

          {/* User Input Data */}
          <div className="uw-card" style={{ padding: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 24px" }}>신청 정보</h2>
            <div style={{ background: "var(--uw-surface)", padding: 24, borderRadius: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, fontSize: 14 }}>
                {Object.entries(selectedSub.input || {}).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <div style={{ color: "var(--uw-slate)", fontWeight: 600 }}>{k}</div>
                    <div style={{ color: "var(--uw-ink)" }}>{String(v)}</div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Timeline) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div className="uw-card" style={{ padding: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 24px" }}>진행 상태</h2>
            <div className="uw-timeline">
              {(workflowState?.stages || []).map((stage: any, idx: number) => {
                const isCurrent = stage.status === 'current';
                const isCompleted = stage.status === 'completed';
                return (
                  <div key={idx} className={`uw-timeline-item ${isCurrent || isCompleted ? 'active' : ''}`}>
                    <div className="uw-timeline-dot">{isCompleted ? '✓' : idx + 1}</div>
                    <div className="uw-timeline-content">
                      <div className="uw-timeline-title" style={{ opacity: isCurrent || isCompleted ? 1 : 0.4 }}>{stage.label || stage.name}</div>
                      {stage.description && <div className="uw-timeline-desc" style={{ opacity: isCurrent || isCompleted ? 1 : 0.4 }}>{stage.description}</div>}
                    </div>
                  </div>
                );
              })}
              {!workflowState?.stages && (
                <div style={{ color: "var(--uw-slate)", fontSize: 14 }}>상태 정보를 불러올 수 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showTossModal && paymentData && (
        <Suspense fallback={null}>
          <TossPaymentModal
            clientKey={paymentData.clientKey}
            customerKey={auth.currentUser?.uid || ""}
            amount={paymentData.amount}
            orderId={paymentData.orderId}
            orderName={selectedSub.input?.type || "등기 수수료 결제"}
            successUrl={`/submissions/${id}?payment=success`}
            failUrl={`/submissions/${id}?payment=fail`}
            onClose={() => { setShowTossModal(false); setPaymentStatus(null); }}
            onError={(e: any) => { setLog(`[Error] ${e.message}`); setPaymentStatus("failed"); setShowTossModal(false); }}
          />
        </Suspense>
      )}

      <Suspense fallback={null}><FloatingChatWidget token={token} /></Suspense>
    </div>
  );
}
