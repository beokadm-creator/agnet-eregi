import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth } from '@rp/firebase';

export default function OpsLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="ops-root ops-layout">
      {/* Dark Sidebar */}
      <aside className="ops-sidebar">
        <div className="ops-sidebar-header" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div>🛡️</div> AgentRegi <span>Ops</span>
        </div>

        <nav className="ops-sidebar-nav">
          <div className="ops-nav-section">대시보드</div>
          <NavLink to="/business" className={({ isActive }) => `ops-nav-item${isActive ? ' active' : ''}`}>비즈니스 대시보드</NavLink>
          <NavLink to="/" end className={({ isActive }) => `ops-nav-item${isActive ? ' active' : ''}`}>운영 허브</NavLink>

          <div className="ops-nav-section">모니터링</div>
          <NavLink to="/observability" className={({ isActive }) => `ops-nav-item${isActive ? ' active' : ''}`}>관측</NavLink>
          <NavLink to="/sla-dashboard" className={({ isActive }) => `ops-nav-item${isActive ? ' active' : ''}`}>SLO 대시보드</NavLink>
          <NavLink to="/review-queue" className={({ isActive }) => `ops-nav-item${isActive ? ' active' : ''}`}>리뷰 큐</NavLink>
          <NavLink to="/incidents" className={({ isActive }) => `ops-nav-item${isActive ? ' active' : ''}`}>인시던트</NavLink>

          <div className="ops-nav-section">관리</div>
          <NavLink to="/case-packs" className={({ isActive }) => `ops-nav-item${isActive ? ' active' : ''}`}>Case Packs</NavLink>
          <NavLink to="/access" className={({ isActive }) => `ops-nav-item${isActive ? ' active' : ''}`}>접근 제어</NavLink>
          <NavLink to="/partner-applications" className={({ isActive }) => `ops-nav-item${isActive ? ' active' : ''}`}>파트너 신청</NavLink>
          <NavLink to="/release" className={({ isActive }) => `ops-nav-item${isActive ? ' active' : ''}`}>릴리즈 관리</NavLink>
          <NavLink to="/system" className={({ isActive }) => `ops-nav-item${isActive ? ' active' : ''}`}>시스템 관리</NavLink>

          <div className="ops-nav-section">기록</div>
          <NavLink to="/audit-logs" className={({ isActive }) => `ops-nav-item${isActive ? ' active' : ''}`}>감사 로그</NavLink>
          <NavLink to="/reports" className={({ isActive }) => `ops-nav-item${isActive ? ' active' : ''}`}>리포트 & 알림</NavLink>

          <div className="ops-nav-section">설정</div>
          <NavLink to="/settings" className={({ isActive }) => `ops-nav-item${isActive ? ' active' : ''}`}>통합 설정</NavLink>
        </nav>

        {/* Sidebar Footer */}
        <div style={{ padding: '12px', borderTop: '1px solid var(--ops-border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--ops-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '8px' }}>
            {auth.currentUser?.email}
          </div>
          <button onClick={onLogout} className="ops-btn" style={{ width: '100%', justifyContent: 'center' }}>
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="ops-main">
        <header className="ops-topbar">
          <div style={{ fontSize: '12px', color: 'var(--ops-text-muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="ops-badge ops-badge-brand">PROD</span>
            <span>ap-northeast-2</span>
            <span>·</span>
            <span style={{ color: 'var(--ops-success)' }}>● All Systems Operational</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="ops-btn">Search (⌘K)</button>
            <button className="ops-btn">Alerts <span className="ops-badge ops-badge-danger" style={{ marginLeft: 4 }}>3</span></button>
          </div>
        </header>

        <main className="ops-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
