import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '@rp/firebase';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../apiBase';

const ARLogo = ({ size = 24 }: { size?: number }) => (
  <div style={{ width: size, height: size, background: 'var(--ar-accent)', borderRadius: '50%', display: 'inline-block' }} />
);

const Ic = {
  search: () => <span>🔍</span>,
  arrow: () => <span>→</span>,
  pin: () => <span>📍</span>,
  star: () => <span>⭐</span>,
};

function FeaturedOfficeCard({ style, office, area, rating, count, price, eta, featured, tagColor }: any) {
  return (
    <div className="ar-card-soft" style={{ ...style, padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 140, background: tagColor, position: 'relative' }}>
        {featured && (
          <div style={{ position: 'absolute', top: 14, left: 14, background: 'var(--ar-accent)', color: 'white', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>
            ★ 이번 주 인기
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(10,10,10,0.7)', color: 'white', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999 }}>
          평균 {eta}
        </div>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{office}</div>
        <div style={{ fontSize: 12, color: 'var(--ar-slate)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <Ic.pin /> {area} · ★ {rating} · 후기 {count}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14 }}>
          <div className="ar-tabular" style={{ fontSize: 20, fontWeight: 800 }}>{price}<span style={{ fontSize: 12, color: 'var(--ar-slate)' }}>원~</span></div>
          <span className="ar-badge ar-badge-success">예약 가능</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const intentInputRef = useRef<HTMLInputElement | null>(null);
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
    const res = await fetch(`${getApiBaseUrl()}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.messageKo || json.error?.code || 'API Error');
    return json.data;
  }

  function asArray<T = any>(value: any): T[] {
    if (Array.isArray(value)) return value as T[];
    if (Array.isArray(value?.items)) return value.items as T[];
    return [];
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

  async function loadSubmissions() {
    setBusy(true);
    try {
      const data = await apiGet("/v1/user/submissions");
      setSubmissions(asArray(data));
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
      setLog(`진단 세션 생성: ${res.sessionId}`);
    } catch (e: any) { setLog(`[Error] ${e.message}`); } finally { setBusy(false); }
  }

  async function submitFunnelAnswer(manualAnswer?: any) {
    const finalAnswer = manualAnswer !== undefined ? manualAnswer : funnelAnswer;
    if (!funnelSessionId || !currentQuestion || finalAnswer === undefined) return;
    setBusy(true); setLog("답변 제출 중...");
    try {
      const res = await apiPost(`/v1/funnel/sessions/${funnelSessionId}/answer`, { 
        questionId: currentQuestion.id, answer: finalAnswer
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
    } catch (e: any) { setLog(`[Error] ${e.message}`); } finally { setBusy(false); }
  }

  async function createSubmissionFromFunnel(partnerId: string) {
    setBusy(true); setLog("제출 생성 중...");
    try {
      const res = await apiPost("/v1/user/submissions", { 
        inputType: funnelIntent, partnerId, submitNow: false, sessionId: funnelSessionId
      });
      navigate(`/submissions/${res.submission.id}`);
    } catch (e: any) { setLog(`[Error] ${e.message}`); } finally { setBusy(false); }
  }

  async function handleTopLogin() {
    try {
      if (token) await signOut(auth);
    } finally {
      navigate("/login");
    }
  }

  async function handleStart() {
    if (!token) {
      navigate("/login");
      return;
    }
    intentInputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    intentInputRef.current?.focus();
  }

  return (
    <div className="ar-root ar-paper" style={{ width: '100%', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <div className="uw-topnav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--ar-hairline)' }}>
        <div className="uw-topnav-left" style={{ display: 'flex', alignItems: 'center' }}>
          <ARLogo size={26} />
          <nav className="uw-topnav-links" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ar-graphite)' }}>
            <span style={{ color: 'var(--ar-ink)' }}>법인 등기</span>
            <span>부동산 등기</span>
            <span>법무사 찾기</span>
            <span>가격 안내</span>
          </nav>
        </div>
        <div className="uw-topnav-actions" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="ar-btn ar-btn-quiet ar-btn-sm" type="button" onClick={handleTopLogin}>로그인</button>
          <button className="ar-btn ar-btn-sm ar-btn-ink" type="button" onClick={handleStart}>시작하기</button>
        </div>
      </div>

      {/* Hero */}
      <div className="uw-hero" style={{ display: 'grid', gap: 56, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'var(--ar-accent-soft)', color: 'var(--ar-accent-ink)', fontSize: 13, fontWeight: 700, marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ar-accent)' }} />
            전국 1,200곳의 법무사가 입점
          </div>
          <h1 className="uw-hero-title" style={{ fontWeight: 800, margin: 0, letterSpacing: '-0.04em' }}>
            법인 등기,<br/>
            <span style={{ color: 'var(--ar-accent)' }}>5분</span>이면 시작.
          </h1>
          <p className="uw-hero-subtitle" style={{ marginTop: 28, fontSize: 19, color: 'var(--ar-graphite)', lineHeight: 1.55, maxWidth: 520 }}>
            동네 법무사 사무소를 한눈에 비교하고, 카톡으로 서류받고, 등기까지 비대면으로. 평균 처리 6시간.
          </p>
          
          {/* Big search - Wired to funnelIntent */}
          <div className="ar-card-soft" style={{ marginTop: 36, padding: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px' }}>
              <Ic.search />
              <input 
                ref={intentInputRef}
                style={{ flex: 1, height: 56, border: 'none', outline: 'none', fontSize: 17, fontWeight: 500, background: 'transparent', color: 'var(--ar-ink)' }} 
                placeholder="어떤 등기가 필요하세요? 예) 본점 이전" 
                value={funnelIntent}
                onChange={e => setFunnelIntent(e.target.value)}
              />
            </div>
            <button 
              className="ar-btn ar-btn-lg ar-btn-accent" 
              style={{ height: 56, padding: '0 24px' }}
              disabled={busy || !funnelIntent}
              onClick={startFunnel}
            >
              찾아보기 <Ic.arrow />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {['법인 설립', '본점 이전', '임원 변경', '자본금 증자', '상호 변경', '청산']?.map(t => (
              <button key={t} className="ar-btn ar-btn-sm ar-btn-ghost" style={{ background: 'var(--ar-canvas)' }} onClick={() => setFunnelIntent(t)}>{t}</button>
            ))}
          </div>

          {/* Active Funnel Section */}
          {(funnelSessionId && (currentQuestion || funnelPreview || funnelResults)) && (
            <div style={{ marginTop: 48, paddingTop: 48, borderTop: '1px solid var(--ar-hairline)' }}>
              {log && <div style={{ fontSize: 13, color: 'var(--ar-slate)', marginBottom: 16 }}>{log}</div>}
              
              {currentQuestion && (
                <div className="ar-card" style={{ padding: 32 }}>
                  <div className="ar-eyebrow" style={{ color: 'var(--ar-accent)', marginBottom: 8 }}>질문</div>
                  <h3 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 24px' }}>{currentQuestion.text}</h3>
                  
                  {currentQuestion.type === "single_choice" && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {currentQuestion.options?.map((opt: string) => (
                        <button 
                          key={opt} 
                          onClick={() => { setFunnelAnswer(opt); submitFunnelAnswer(opt); }} 
                          disabled={busy} 
                          className="ar-btn ar-btn-soft"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {currentQuestion.type === "number" && (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <input 
                        type="number" 
                        value={funnelAnswer} 
                        onChange={e => setFunnelAnswer(e.target.value)} 
                        className="ar-input" 
                        style={{ width: 160 }} 
                      />
                      <button onClick={() => submitFunnelAnswer()} disabled={busy || !funnelAnswer} className="ar-btn ar-btn-ink">다음 <Ic.arrow /></button>
                    </div>
                  )}
                </div>
              )}

              {funnelPreview && !funnelResults && (
                <div className="ar-card-soft" style={{ marginTop: 24, padding: 24, background: 'var(--ar-accent-soft)' }}>
                  <div style={{ display: 'flex', gap: 48 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ar-accent-ink)', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>예상 비용</div>
                      <div className="ar-tabular" style={{ fontSize: 28, fontWeight: 800, color: 'var(--ar-accent-ink)', marginTop: 4 }}>{funnelPreview.minPrice.toLocaleString()}원~</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ar-accent-ink)', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>소요 시간</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ar-accent-ink)', marginTop: 4 }}>{funnelPreview.etaDays}일</div>
                    </div>
                  </div>
                </div>
              )}

              {funnelResults && (
                <div style={{ marginTop: 24 }}>
                   <div className="ar-eyebrow" style={{ marginBottom: 12 }}>매칭된 파트너</div>
                   {funnelResults.recommended && (
                     <div className="ar-card" style={{ padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div>
                         <div style={{ fontSize: 20, fontWeight: 800 }}>{funnelResults.recommended.name}</div>
                         <div style={{ fontSize: 14, color: 'var(--ar-slate)', marginTop: 4 }}>
                           예상 가격: {funnelResults.recommended.price?.toLocaleString()}원 · ETA: {funnelResults.recommended.etaHours}시간
                         </div>
                       </div>
                       <button onClick={() => createSubmissionFromFunnel(funnelResults.recommended.partnerId)} disabled={busy} className="ar-btn ar-btn-ink">
                         지금 신청하기 <Ic.arrow />
                       </button>
                     </div>
                   )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right — featured law office card stack */}
        <div className="uw-hero-stack" style={{ position: 'relative' }}>
          <FeaturedOfficeCard
            style={{ position: 'absolute', top: 40, left: 40, width: 340, transform: 'rotate(-3deg)' }}
            office="해담 법무사"
            area="서울 강남"
            rating={4.9}
            count={428}
            price="33,000"
            eta="4시간"
            tagColor="#E0B0FF"
          />
          <FeaturedOfficeCard
            style={{ position: 'absolute', top: 0, right: 0, width: 360, transform: 'rotate(2deg)' }}
            office="이로운 법무법인"
            area="서울 마포"
            rating={4.8}
            count={892}
            price="29,000"
            eta="3시간"
            featured
            tagColor="var(--ar-accent-soft)"
          />
          <FeaturedOfficeCard
            style={{ position: 'absolute', bottom: 0, left: 0, width: 320, transform: 'rotate(-1deg)' }}
            office="청람 법무사"
            area="경기 성남"
            rating={4.9}
            count={314}
            price="35,000"
            eta="5시간"
            tagColor="#90EE90"
          />
        </div>
      </div>

      {/* Trust bar */}
      <div style={{ background: 'var(--ar-ink)', color: 'white', padding: '36px 56px', display: 'flex', justifyContent: 'space-between', gap: 56 }}>
        {[
          { n: '12,400+', t: '누적 등기 처리' },
          { n: '평균 6시간', t: '신청 → 완료' },
          { n: '4.9 / 5.0', t: '실 사용자 평점' },
          { n: '1,200+', t: '입점 법무사 사무소' },
        ]?.map(x => (
          <div key={x.n}>
            <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em' }}>{x.n}</div>
            <div style={{ fontSize: 13, color: '#A0A0A0', marginTop: 4 }}>{x.t}</div>
          </div>
        ))}
      </div>

      {/* Submissions Section */}
      <div style={{ padding: '72px 56px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 36 }}>
          <div>
            <div className="ar-eyebrow" style={{ color: 'var(--ar-accent-ink)', marginBottom: 10 }}>My Submissions</div>
            <h2 style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.025em', margin: 0 }}>진행 중인 사건 {submissions.length}건</h2>
          </div>
          <button className="ar-btn ar-btn-ghost" onClick={loadSubmissions} disabled={busy}>새로고침 <Ic.arrow /></button>
        </div>

        {submissions.length === 0 ? (
          <div className="ar-card-soft" style={{ padding: '64px', textAlign: 'center', color: 'var(--ar-slate)' }}>
            아직 진행 중인 사건이 없습니다. 위 검색창에서 등기를 시작해 보세요.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {submissions?.map(s => (
              <div key={s.id} className="ar-card" style={{ padding: 24, cursor: 'pointer' }} onClick={() => navigate(`/submissions/${s.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ar-slate)', marginBottom: 6 }}>{new Date(s.updatedAt).toLocaleDateString()}</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{s.input?.type || '등기 신청'}</div>
                  </div>
                  <span className={`ar-badge ${["failed", "cancelled"].includes(s.status) ? "ar-badge-danger" : (s.status === "completed" ? "ar-badge-success" : "ar-badge-accent")}`}>
                    {statusText[s.status] || s.status}
                  </span>
                </div>
                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="ar-mono" style={{ fontSize: 12, color: 'var(--ar-slate)' }}>ID: {s.id.slice(0, 12)}...</div>
                  <button className="ar-btn ar-btn-sm ar-btn-ghost">상세 보기 <Ic.arrow /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
