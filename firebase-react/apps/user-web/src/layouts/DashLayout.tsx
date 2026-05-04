import React, { Suspense, lazy, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { auth } from '@rp/firebase';
import { useAuth } from '../context/AuthContext';

const FloatingChatWidget = lazy(() => import('../components/FloatingChatWidget'));

export default function DashLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
      <header className="uw-topnav" role="banner">
        <div className="uw-logo" onClick={() => navigate('/')}>
          <div className="uw-logo-mark">⚖</div>
          AgentRegi
        </div>

        <nav className="uw-nav-links" aria-label="주 메뉴">
          <a href="#" className="uw-nav-link" onClick={(e) => { e.preventDefault(); navigate('/'); }}>{t('nav.dashboard')}</a>
          <a href="#" className="uw-nav-link" onClick={(e) => { e.preventDefault(); navigate('/partner/apply'); }}>{t('nav.partner_apply')}</a>
          <a href="#" className="uw-nav-link" onClick={(e) => { e.preventDefault(); document.getElementById('chatbot-fab')?.click(); }}>{t('nav.customer_support')}</a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <form onSubmit={handleHeaderSearch} style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              placeholder={t('nav.search_placeholder')}
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
                {t('common.logout')}
              </button>
            </>
          ) : (
            <button onClick={() => navigate('/login')} className="uw-btn uw-btn-brand uw-btn-sm">
              {t('common.login')}
            </button>
          )}
        </div>
      </header>

      <main role="main" style={{ flex: 1 }}>
        <Outlet />
      </main>

      <footer style={{ padding: '40px', textAlign: 'center', color: 'var(--uw-fog)', fontSize: 13, borderTop: '1px solid var(--uw-border)', background: 'var(--uw-surface)' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', gap: 24 }}>
          <a href="#" style={{ color: 'var(--uw-slate)', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); navigate('/settings'); }}>{t('footer.terms')}</a>
          <a href="#" style={{ color: 'var(--uw-slate)', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); navigate('/settings'); }}>{t('footer.privacy')}</a>
          <a href="#" style={{ color: 'var(--uw-slate)', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); document.getElementById('chatbot-fab')?.click(); }}>{t('footer.faq')}</a>
        </div>
        {t('footer.copyright')}
      </footer>

      {token && (
        <Suspense fallback={null}>
          <FloatingChatWidget token={token} />
        </Suspense>
      )}
    </div>
  );
}
