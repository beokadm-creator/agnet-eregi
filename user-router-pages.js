const fs = require('fs');
const path = require('path');
const srcDir = './firebase-react/apps/user-web/src';

const dashPageCode = `import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../apiBase';

export default function Dashboard() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");

  // Funnel State
  const [funnelIntent, setFunnelIntent] = useState("");
  const [funnelSessionId, setFunnelSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [funnelAnswer, setFunnelAnswer] = useState("");
  const [funnelPreview, setFunnelPreview] = useState<any>(null);
  const [funnelResults, setFunnelResults] = useState<any>(null);

  const statusText: Record<string, string> = {
    draft: "작성중", submitted: "제출됨", processing: "처리중",
    completed: "완료", failed: "실패", cancelled: "취소됨", cancel_requested: "취소요청됨"
  };

  useEffect(() => {
    if (token) loadSubmissions();
  }, [token]);

  async function apiGet(path: string) {
    const res = await fetch(\`\${getApiBaseUrl()}\${path}\`, { headers: { Authorization: \`Bearer \${token}\` } });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.messageKo || json.error?.code || 'API Error');
    return json.data;
  }

  async function apiPost(path: string, body: any) {
    const res = await fetch(\`\${getApiBaseUrl()}\${path}\`, {
      method: "POST",
      headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.messageKo || json.error?.code || 'API Error');
    return json.data;
  }

  async function loadSubmissions() {
    setBusy(true);
    try {
      const data = await apiGet("/v1/user/submissions");
      setSubmissions(data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function startFunnel() {
    if (!funnelIntent) return;
    setBusy(true); setLog("진단 세션 생성 중...");
    try {
      const res = await apiPost("/v1/funnel/intent", { intentText: funnelIntent });
      setFunnelSessionId(res.sessionId);
      setCurrentQuestion(res.nextQuestion);
      setFunnelResults(null); setFunnelAnswer(""); setFunnelPreview(null);
      setLog(\`진단 세션 생성: \${res.sessionId}\`);
    } catch (e: any) { setLog(\`[Error] \${e.message}\`); } finally { setBusy(false); }
  }

  async function submitFunnelAnswer() {
    if (!funnelSessionId || !currentQuestion || funnelAnswer === undefined) return;
    setBusy(true); setLog("답변 제출 중...");
    try {
      const res = await apiPost(\`/v1/funnel/sessions/\${funnelSessionId}/answer\`, { 
        questionId: currentQuestion.id, answer: funnelAnswer
      });
      setFunnelPreview(res.preview);
      if (res.isCompleted) {
        setCurrentQuestion(null);
        setLog("진단 완료. 매칭 결과 조회 중...");
        const resultsRes = await apiGet(\`/v1/funnel/sessions/\${funnelSessionId}/results\`);
        setFunnelResults(resultsRes);
      } else {
        setCurrentQuestion(res.nextQuestion);
        setFunnelAnswer("");
      }
    } catch (e: any) { setLog(\`[Error] \${e.message}\`); } finally { setBusy(false); }
  }

  async function createSubmissionFromFunnel(partnerId: string) {
    setBusy(true); setLog("제출 생성 중...");
    try {
      const res = await apiPost("/v1/user/submissions", { 
        inputType: funnelIntent, partnerId, submitNow: false, sessionId: funnelSessionId
      });
      navigate(\`/submissions/\${res.submission.id}\`);
    } catch (e: any) { setLog(\`[Error] \${e.message}\`); } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5rem' }}>
      {log && <div className="wc-log wc-log--neutral" style={{ marginBottom: '2rem' }}>{log}</div>}

      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">신규 의뢰 시작</h2>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input 
            value={funnelIntent} onChange={e => setFunnelIntent(e.target.value)} 
            placeholder={t('funnel_placeholder')} className="dash-input"
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
                {currentQuestion.options.map((opt: string) => (
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
              <div key={s.id} className="dash-item" onClick={() => navigate(\`/submissions/\${s.id}\`)} style={{ cursor: 'pointer' }}>
                <div className="dash-item-header">
                  <div className="dash-item-title" style={{ color: 'var(--text-primary)' }}>{s.input?.type || '알 수 없는 유형'}</div>
                  <div className={\`dash-item-status \${["failed", "cancelled"].includes(s.status) ? "dash-item-status--error" : ""}\`}>
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
    </div>
  );
}
`;
fs.writeFileSync(path.join(srcDir, 'pages', 'Dashboard.tsx'), dashPageCode);

