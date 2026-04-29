import React, { useState, useEffect, Suspense, lazy } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";
import { auth } from "@rp/firebase";

const FloatingChatWidget = lazy(() => import("../components/FloatingChatWidget"));
const TossPaymentModal = lazy(() => import("../components/TossPaymentModal"));

export default function SubmissionDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [payment, setPayment] = useState<any | null>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [workflowState, setWorkflowState] = useState<any | null>(null);
  const [evidenceRequests, setEvidenceRequests] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [showTossModal, setShowTossModal] = useState(false);

  // Safely extract array regardless of API response shape
  function asArray<T = any>(value: any): T[] {
    if (Array.isArray(value)) return value as T[];
    if (Array.isArray(value?.items)) return value.items as T[];
    return [];
  }

  const statusText: Record<string, string> = {
    draft: "작성중", submitted: "제출됨", processing: "처리중",
    completed: "완료", failed: "실패", cancelled: "취소됨"
  };

  useEffect(() => {
    if (id && token) {
      loadSubDetail(id);
    }
  }, [id, token]);

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
    setBusy(true); setLog("로딩 중...");
    try {
      const data = await apiGet(`/v1/user/submissions/${subId}`);
      setSelectedSub(data?.submission || data);
      const evs = await apiGet(`/v1/user/submissions/${subId}/events`);
      setEvents(asArray(evs));
      const reqs = await apiGet(`/v1/user/submissions/${subId}/evidence-requests`);
      setEvidenceRequests(asArray(reqs));
      const qs = await apiGet(`/v1/cases/${subId}/quotes`);
      setQuotes(asArray(qs));
      const wf = await apiGet(`/v1/cases/${subId}/workflow`);
      setWorkflowState(wf);
      setLog("");
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function acceptQuote(quoteId: string) {
    if (!selectedSub) return;
    setBusy(true); setLog("견적 동의 중...");
    try {
      const apiUrl = getApiBaseUrl();
      await fetch(`${apiUrl}/v1/user/cases/${selectedSub.id}/quotes/${quoteId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": `quote_${quoteId}_${Date.now()}` },
        body: JSON.stringify({})
      });
      setLog("견적 동의 완료");
      await loadSubDetail(selectedSub.id);
    } catch (e: any) { setLog(`[Error] ${e.message}`); } finally { setBusy(false); }
  }

  if (!selectedSub) return <div>{log || "Loading detail..."}</div>;

  return (
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
          <div className="dash-item-meta">수정일: {new Date(selectedSub.updatedAt).toLocaleString()}</div>
        </div>
      </div>

      {log && <div className="wc-log wc-log--neutral" style={{ marginBottom: '1.5rem' }}>{log}</div>}

      <div style={{ marginBottom: '2rem' }}>
        <span className="dash-label">입력 데이터 요약</span>
        <pre style={{ background: 'var(--ar-paper-alt)', padding: '1rem', borderRadius: 'var(--ar-r1)', fontSize: '0.8125rem', overflowX: 'auto', border: '1px solid var(--ar-hairline)' }}>
          {JSON.stringify(selectedSub.input, null, 2)}
        </pre>
      </div>

      {/* Quotes */}
      {quotes && quotes.length > 0 && (
        <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid var(--ar-hairline)', backgroundColor: 'var(--ar-paper-alt)', borderRadius: 'var(--ar-r3)' }}>
          <span className="dash-label">견적 내역</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {quotes?.map((q: any) => (
              <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'var(--ar-canvas)', border: '1px solid var(--ar-hairline-strong)', borderRadius: 'var(--ar-r1)' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>총액: {q.totalAmount.toLocaleString()}원</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ar-graphite)' }}>수수료 {q.feeAmount.toLocaleString()}원 · 세금 {q.taxAmount.toLocaleString()}원</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: q.status === 'accepted' ? 'var(--ar-accent)' : 'var(--ar-fog)' }}>
                    {q.status.toUpperCase()}
                  </span>
                  {q.status === 'draft' && (
                    <button onClick={() => acceptQuote(q.id)} disabled={busy} className="dash-button" style={{ padding: '0.5rem 1rem' }}>
                      동의 및 결제 진행
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events */}
      {events.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h4 className="dash-section-title" style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>진행 이력</h4>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {events?.map((ev: any) => (
              <div key={ev.id} style={{ padding: '1rem 0', borderTop: '1px solid var(--ar-hairline)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--ar-fog)', marginBottom: '0.25rem' }}>{new Date(ev.createdAt).toLocaleString()}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--ar-ink)', marginBottom: '0.5rem' }}>{ev.type.toUpperCase()}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--ar-graphite)', lineHeight: 1.5 }}>{ev.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
