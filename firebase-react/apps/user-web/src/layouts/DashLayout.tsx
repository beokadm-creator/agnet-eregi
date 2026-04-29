import React, { Suspense, lazy, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { auth } from '@rp/firebase';
import { useAuth } from '../context/AuthContext';

const FloatingChatWidget = lazy(() => import('../components/FloatingChatWidget'));

export default function DashLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [headerSearch, setHeaderSearch] = useState('');

  const handleHeaderSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const text = headerSearch.trim();
    if (text) {
      navigate(`/funnel?intent=${encodeURIComponent(text)}`);
      setHeaderSearch('');
    } else {
      navigate('/funnel');
    }
  };

  return (
    <div className="uw-root" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <header className="uw-topnav">
        <div className="uw-logo" onClick={() => navigate('/')}>
          <div className="uw-logo-mark">⚖</div>
          AgentRegi
        </div>

        <nav className="uw-nav-links">
          <a href="#" className="uw-nav-link" onClick={(e) => { e.preventDefault(); navigate('/'); }}>대시보드</a>
          <a href="#" className="uw-nav-link" onClick={(e) => { e.preventDefault(); navigate('/partner/apply'); }}>법무사 파트너 지원</a>
          <a href="#" className="uw-nav-link" onClick={(e) => { e.preventDefault(); document.getElementById('chatbot-fab')?.click(); }}>고객 지원</a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <form onSubmit={handleHeaderSearch} style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="등기 검색..."
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              style={{
                width: 180,
                height: 36,
                padding: '0 12px',
                fontSize: 13,
                fontWeight: 500,
                border: '1px solid var(--uw-border)',
                borderRadius: 10,
                background: 'var(--uw-surface)',
                color: 'var(--uw-ink)',
                outline: 'none',
                fontFamily: 'var(--uw-font-sans)',
              }}
            />
          </form>

          {auth.currentUser ? (
            <>
              <span style={{ fontSize: 14, color: 'var(--uw-slate)', fontWeight: 500 }}>
                {auth.currentUser.email}
              </span>
              <button onClick={onLogout} className="uw-btn uw-btn-outline uw-btn-sm">
                로그아웃
              </button>
            </>
          ) : (
            <button onClick={() => navigate('/login')} className="uw-btn uw-btn-brand uw-btn-sm">
              로그인
            </button>
          )}
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <footer style={{ padding: '40px', textAlign: 'center', color: 'var(--uw-fog)', fontSize: 13, borderTop: '1px solid var(--uw-border)', background: 'var(--uw-surface)' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', gap: 24 }}>
          <a href="#" style={{ color: 'var(--uw-slate)', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); navigate('/settings'); }}>이용약관</a>
          <a href="#" style={{ color: 'var(--uw-slate)', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); navigate('/settings'); }}>개인정보처리방침</a>
          <a href="#" style={{ color: 'var(--uw-slate)', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); document.getElementById('chatbot-fab')?.click(); }}>자주 묻는 질문</a>
        </div>
        © 2026 AgentRegi. All rights reserved.
      </footer>

      {token && (
        <Suspense fallback={null}>
          <FloatingChatWidget token={token} />
        </Suspense>
      )}
    </div>
  );
}
