import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { auth } from '@rp/firebase';

export default function DashLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();

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
          <a href="#" className="uw-nav-link" onClick={(e) => { e.preventDefault(); }}>고객 지원</a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {auth.currentUser ? (
            <>
              <span style={{ fontSize: '14px', color: 'var(--uw-slate)', fontWeight: 500 }}>
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
      
      <footer style={{ padding: '40px', textAlign: 'center', color: 'var(--uw-fog)', fontSize: '13px', borderTop: '1px solid var(--uw-border)', background: 'var(--uw-surface)' }}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center', gap: '24px' }}>
          <a href="#" style={{ color: 'var(--uw-slate)', textDecoration: 'none' }}>이용약관</a>
          <a href="#" style={{ color: 'var(--uw-slate)', textDecoration: 'none' }}>개인정보처리방침</a>
          <a href="#" style={{ color: 'var(--uw-slate)', textDecoration: 'none' }}>자주 묻는 질문</a>
        </div>
        © 2026 AgentRegi. All rights reserved.
      </footer>
    </div>
  );
}
