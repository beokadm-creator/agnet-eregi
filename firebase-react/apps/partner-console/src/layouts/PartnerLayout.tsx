import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth } from '@rp/firebase';

const ARLogo = ({ size = 24 }) => (
  <div style={{ width: size, height: size, background: 'var(--ar-accent)', borderRadius: '50%', display: 'inline-block' }} />
);

const Avatar = ({ name, size = 32 }) => (
  <div style={{ width: size, height: size, background: 'var(--ar-accent-soft)', color: 'var(--ar-accent-ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
    {name}
  </div>
);

const Ic = {
  chev: () => <span>›</span>,
  layers: () => <span>📚</span>,
  inbox: () => <span>📥</span>,
  doc: () => <span>📄</span>,
  bolt: () => <span>⚡</span>,
  user: () => <span>👤</span>,
  shield: () => <span>🛡️</span>,
  card: () => <span>💳</span>,
  bell: () => <span>🔔</span>,
};

function NavItem({ to, icon, label, badge, badgeAccent }) {
  return (
    <NavLink to={to} end style={{ textDecoration: 'none' }} className={({isActive}) => `ar-nav-item ${isActive ? 'active' : ''}`}>
      {({ isActive }) => (
        <>
          <span style={{ color: isActive ? 'white' : 'var(--ar-slate)' }}>{icon}</span>
          <span style={{ flex: 1 }}>{label}</span>
          {badge && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
              background: badgeAccent ? 'var(--ar-accent)' : (isActive ? 'rgba(255,255,255,0.18)' : 'var(--ar-paper-alt)'),
              color: badgeAccent ? 'white' : (isActive ? 'white' : 'var(--ar-graphite)')
            }}>{badge}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function PartnerLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="ar-root ar-paper" style={{ width: '100%', minHeight: '100dvh', display: 'flex' }}>
      <aside style={{ width: 240, background: 'var(--ar-canvas)', borderRight: '1px solid var(--ar-hairline)', padding: '20px 14px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '6px 8px 16px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <ARLogo size={22} />
        </div>
        <div className="ar-card" style={{ padding: 12, margin: '4px 0 12px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--ar-paper-alt)', border: 'none' }}>
          <Avatar name="해" size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{auth.currentUser?.email || "해담 법무사"}</div>
            <div style={{ fontSize: 11, color: 'var(--ar-slate)' }}>강남 사무소</div>
          </div>
          <button onClick={onLogout} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ar-accent)' }}>나가기</button>
        </div>

        <div className="ar-nav-section">메인</div>
        <NavItem to="/" icon={<Ic.layers />} label="케이스 워크보드" badge="12" />
        <NavItem to="/cases" icon={<Ic.inbox />} label="신규 의뢰" badge="3" badgeAccent />
        <NavItem to="/templates" icon={<Ic.doc />} label="서류함" />
        <NavItem to="/billing" icon={<Ic.bolt />} label="견적 · 청구" />

        <div className="ar-nav-section">설정</div>
        <NavItem to="/organization" icon={<Ic.user />} label="팀원" />
        <NavItem to="/settings" icon={<Ic.shield />} label="템플릿" />
        <NavItem to="/card" icon={<Ic.card />} label="정산" />
        <NavItem to="/bell" icon={<Ic.bell />} label="알림 설정" />

        <div style={{ marginTop: 'auto', padding: 12, background: 'var(--ar-accent-soft)', borderRadius: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ar-accent-ink)' }}>이번 주 SLA 98%</div>
          <div style={{ fontSize: 11, color: 'var(--ar-accent-ink)', opacity: 0.8, marginTop: 4 }}>품질 등급 유지 중</div>
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  );
}
