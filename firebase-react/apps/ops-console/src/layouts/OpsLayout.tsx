import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth } from '@rp/firebase';

const Ic = {
  shield: () => <span>🛡️</span>,
  layers: () => <span>📚</span>,
  user: () => <span>👤</span>,
  card: () => <span>💳</span>,
  alert: () => <span>⚠️</span>,
  doc: () => <span>📄</span>,
  bolt: () => <span>⚡</span>,
};

function OpsNav({ active, label, icon, count, badgeColor, to }) {
  return (
    <NavLink to={to} end style={{ textDecoration: 'none' }} className={({isActive}) => isActive ? 'active' : ''}>
      {({ isActive }) => (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
          background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
          color: isActive ? 'white' : '#C0C0C0',
          fontSize: 13, fontWeight: 500, cursor: 'pointer'
        }}>
          <span style={{ color: isActive ? 'var(--ar-accent)' : '#A0A0A0' }}>{icon}</span>
          <span style={{ flex: 1 }}>{label}</span>
          {count && <span style={{ fontSize: 11, color: badgeColor || '#A0A0A0', fontWeight: 600 }}>{count}</span>}
        </div>
      )}
    </NavLink>
  );
}

export default function OpsLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="ar-root ar-paper" style={{ width: '100%', minHeight: '100dvh', display: 'flex' }}>
      <aside style={{ width: 220, background: 'var(--ar-ink)', color: '#C0C0C0', padding: '20px 12px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '6px 8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 22, height: 22 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '52% 52% 50% 50% / 60% 60% 40% 40%', background: 'var(--ar-accent)' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'white', letterSpacing: '-0.02em', cursor: 'pointer' }} onClick={() => navigate('/')}>AgentRegi <span style={{ color: 'var(--ar-accent)' }}>Ops</span></span>
        </div>

        <div style={{ padding: '4px 8px 16px' }}>
          <input className="ar-input ar-input-sm" placeholder="search…" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
        </div>

        <OpsNav to="/" label="Health" icon={<Ic.shield />} />
        <OpsNav to="/case-packs" label="Cases" icon={<Ic.layers />} count="2,184" />
        <OpsNav to="/access" label="Partners" icon={<Ic.user />} count="1,243" />
        <OpsNav to="/billing" label="Settlements" icon={<Ic.card />} />
        <OpsNav to="/observability" label="Incidents" icon={<Ic.alert />} count="2" badgeColor="var(--ar-danger)" />
        <OpsNav to="/audit-logs" label="Audit Log" icon={<Ic.doc />} />

        <div style={{ marginTop: 'auto', padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
           <span style={{
            fontSize: '0.75rem',
            color: 'var(--ar-fog)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {auth.currentUser?.email}
          </span>
          <button type="button" onClick={onLogout} style={{ display: 'block', background: 'none', border: 'none', color: 'var(--ar-accent)', cursor: 'pointer', padding: 0, marginTop: 4 }}>로그아웃</button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Outlet />
      </main>
    </div>
  );
}
