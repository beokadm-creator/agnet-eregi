import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth } from '@rp/firebase';

export default function OpsLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="im-shell selection:bg-[var(--brand)]/10 selection:text-[var(--brand)]">
      <div className="im-container">
        <header className="im-header">
          <h1 className="im-title" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>Ops Console</h1>
          <div className="im-lang">
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{auth.currentUser?.email}</span>
            <button type="button" className="im-link" onClick={onLogout} style={{ marginLeft: '1rem' }}>
              로그아웃
            </button>
          </div>
        </header>

        <div className="im-split" style={{ alignItems: 'flex-start' }}>
          <div className="im-panel" style={{ flex: '0 0 240px', position: 'sticky', top: '1rem' }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <NavLink to="/" className={({isActive}) => `dash-button ${isActive ? '' : 'dash-button--outline'}`} end>Gate / Operations</NavLink>
              <NavLink to="/case-packs" className={({isActive}) => `dash-button ${isActive ? '' : 'dash-button--outline'}`}>Case Packs</NavLink>
              <NavLink to="/access" className={({isActive}) => `dash-button ${isActive ? '' : 'dash-button--outline'}`}>Access Control</NavLink>
              <NavLink to="/observability" className={({isActive}) => `dash-button ${isActive ? '' : 'dash-button--outline'}`}>Observability</NavLink>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />
              <NavLink to="/review-queue" className={({isActive}) => `dash-button ${isActive ? '' : 'dash-button--outline'}`}>Review Queue (New)</NavLink>
              <NavLink to="/sla-dashboard" className={({isActive}) => `dash-button ${isActive ? '' : 'dash-button--outline'}`}>SLA Dashboard (New)</NavLink>
              <NavLink to="/audit-logs" className={({isActive}) => `dash-button ${isActive ? '' : 'dash-button--outline'}`}>Audit Logs (New)</NavLink>
            </nav>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
