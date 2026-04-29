import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth } from '@rp/firebase';

export default function OpsLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      {/* Dark Sidebar */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        backgroundColor: 'var(--ar-ink)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--ar-ink2)',
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid var(--ar-ink2)',
        }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--ar-font-ui)',
              fontWeight: 600,
              fontSize: '0.8125rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--ar-canvas)',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          >
            Ops Console
          </h1>
        </div>

        <nav style={{
          flex: 1,
          padding: '12px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}>
          <div className="ar-nav-section" style={{ color: 'var(--ar-fog)' }}>대시보드</div>
          <NavLink to="/business" style={({ isActive }) => navLinkStyle(isActive)}>비즈니스 대시보드</NavLink>
          <NavLink to="/" end style={({ isActive }) => navLinkStyle(isActive)}>운영 허브</NavLink>

          <div className="ar-nav-section" style={{ color: 'var(--ar-fog)' }}>모니터링</div>
          <NavLink to="/observability" style={({ isActive }) => navLinkStyle(isActive)}>관측</NavLink>
          <NavLink to="/sla-dashboard" style={({ isActive }) => navLinkStyle(isActive)}>SLO 대시보드</NavLink>
          <NavLink to="/review-queue" style={({ isActive }) => navLinkStyle(isActive)}>리뷰 큐</NavLink>

          <div className="ar-nav-section" style={{ color: 'var(--ar-fog)' }}>관리</div>
          <NavLink to="/case-packs" style={({ isActive }) => navLinkStyle(isActive)}>Case Packs</NavLink>
          <NavLink to="/access" style={({ isActive }) => navLinkStyle(isActive)}>접근 제어</NavLink>

          <div className="ar-nav-section" style={{ color: 'var(--ar-fog)' }}>기록</div>
          <NavLink to="/audit-logs" style={({ isActive }) => navLinkStyle(isActive)}>감사 로그</NavLink>
        </nav>

        {/* Sidebar Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--ar-ink2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--ar-fog)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {auth.currentUser?.email}
          </span>
          <button
            type="button"
            onClick={onLogout}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem',
              color: 'var(--ar-fog)',
              padding: 0,
              textAlign: 'left',
              fontFamily: 'var(--ar-font-ui)',
            }}
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{
        flex: 1,
        backgroundColor: 'var(--ar-paper)',
        padding: 28,
        overflowY: 'auto',
      }}>
        <Outlet />
      </main>
    </div>
  );
}

function navLinkStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'block',
    padding: '8px 12px',
    borderRadius: 'var(--ar-r1)',
    fontSize: '0.8125rem',
    fontFamily: 'var(--ar-font-ui)',
    textDecoration: 'none',
    fontWeight: isActive ? 500 : 400,
    color: isActive ? 'var(--ar-canvas)' : 'var(--ar-fog)',
    backgroundColor: isActive ? 'var(--ar-ink2)' : 'transparent',
    borderLeft: isActive ? '2px solid var(--ar-accent)' : '2px solid transparent',
    marginLeft: -2,
    paddingLeft: 10,
    transition: 'color 0.15s ease, background-color 0.15s ease',
  };
}
