import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth } from '@rp/firebase';
import { useAppContext } from '../context/AppContext';

// SVG Icons
const Icons = {
  grid: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1"/><rect x="9.5" y="1.5" width="5" height="5" rx="1"/>
      <rect x="1.5" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/>
    </svg>
  ),
  inbox: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 9.5h3l1.5 2h4l1.5-2h3"/><rect x="1.5" y="2.5" width="13" height="11" rx="2"/>
    </svg>
  ),
  doc: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 1.5H4a1 1 0 00-1 1v11a1 1 0 001 1h8a1 1 0 001-1V5.5L9.5 1.5z"/><path d="M9.5 1.5V5.5H13.5"/><path d="M5 8.5h6M5 11h4"/>
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5"/><path d="M1 14c0-2.8 2.2-5 5-5"/><path d="M10.5 9.5a3.5 3.5 0 013.5 3.5"/><circle cx="11" cy="5" r="2.5"/>
    </svg>
  ),
  creditCard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3.5" width="14" height="9" rx="1.5"/><path d="M1 7h14"/>
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2"/><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1"/>
    </svg>
  ),
  bolt: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1.5L3 9h5l-1 5.5L14 7H9L9 1.5z"/>
    </svg>
  ),
  chevDown: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M2.5 4.5L6 8l3.5-3.5"/>
    </svg>
  ),
  logout: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2H2.5a1 1 0 00-1 1v8a1 1 0 001 1H5"/><path d="M9.5 10L12 7l-2.5-3"/><path d="M12 7H5"/>
    </svg>
  ),
};

function NavItem({ to, icon, label, badge, badgeHot, end }: {
  to: string; icon: React.ReactNode; label: string;
  badge?: string; badgeHot?: boolean; end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `pc-nav-item${isActive ? ' active' : ''}`}
    >
      <span className="pc-nav-icon">{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span className={`pc-nav-badge${badgeHot ? ' pc-nav-badge-hot' : ''}`}>{badge}</span>
      )}
    </NavLink>
  );
}

export default function PartnerLayout({ onLogout }: { onLogout: () => void }) {
  const { actingPartnerId, claims, setActingPartnerId, isOpsAdmin } = useAppContext();
  const partnerId = actingPartnerId || claims?.partnerId || '';
  const partnerInitial = partnerId ? partnerId.substring(0, 2).toUpperCase() : 'PR';
  const userEmail = auth.currentUser?.email || '';
  const userInitial = userEmail.charAt(0).toUpperCase();

  return (
    <div className="pc-shell ar-root">
      {/* ── Sidebar ── */}
      <aside className="pc-sidebar">
        <div className="pc-sidebar-top">
          {/* Logo */}
          <div className="pc-logo">
            <div className="pc-logo-mark">⚖</div>
            <div>
              <div className="pc-logo-text">AgentRegi</div>
              <div className="pc-logo-sub">Partner</div>
            </div>
          </div>

          {/* Partner badge */}
          <div className="pc-org-badge" title={partnerId}>
            <div className="pc-org-avatar">{partnerInitial}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pc-org-name">{partnerId || '파트너'}</div>
              <div className="pc-org-role">파트너 콘솔</div>
            </div>
            <span style={{ color: '#50526A', flexShrink: 0 }}>{Icons.chevDown}</span>
          </div>

          {/* Main nav */}
          <div className="pc-nav-section">메인</div>
          <NavItem to="/" icon={Icons.grid} label="대시보드" end />
          <NavItem to="/cases" icon={Icons.inbox} label="케이스 관리" />
          <NavItem to="/templates" icon={Icons.doc} label="서류 템플릿" />

          <div className="pc-sidebar-sep" />
          <div className="pc-nav-section">관리</div>
          <NavItem to="/organization" icon={Icons.users} label="조직 및 팀" />
          <NavItem to="/billing" icon={Icons.creditCard} label="정산 및 요금제" />
          <NavItem to="/settings" icon={Icons.settings} label="설정" />
        </div>

        {/* Footer */}
        <div className="pc-sidebar-footer">
          <div className="pc-sla-card">
            <div className="pc-sla-label">이번 주 SLA</div>
            <div className="pc-sla-value">98.4%</div>
            <div className="pc-sla-hint">품질 등급 A 유지 중</div>
          </div>
          <button
            onClick={onLogout}
            style={{
              width: '100%', marginTop: 10,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 8,
              background: 'transparent', border: 'none',
              color: '#50526A', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'var(--ar-font-ui)',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
            onMouseLeave={e => (e.currentTarget.style.color = '#50526A')}
          >
            <span style={{ opacity: 0.7 }}>{Icons.logout}</span>
            로그아웃
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="pc-content">
        {/* Topbar */}
        <header className="pc-topbar">
          <span className="pc-topbar-crumb">
            AgentRegi
            <span className="pc-topbar-crumb-sep">›</span>
          </span>
          <span className="pc-topbar-title">Partner Console</span>

          <div className="pc-topbar-actions">
            {isOpsAdmin && (
              <button
                className="ar-btn ar-btn-ghost ar-btn-sm"
                onClick={() => setActingPartnerId && setActingPartnerId('')}
                title="파트너 전환"
              >
                ⇄ 전환
              </button>
            )}
            <div className="pc-user-chip">
              <div className="pc-user-avatar">{userInitial}</div>
              <span>{userEmail}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
