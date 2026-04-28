import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { auth } from '@rp/firebase';
import LogViewer from '../components/Layout/LogViewer';

export default function PartnerLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  return (
    <div className="im-shell">
      <div className="im-container">
        <header className="im-header">
          <h1 className="im-title" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>{t("title") || "Partner Console"}</h1>
          <div className="im-lang">
            <button
              onClick={() => i18n.changeLanguage("ko")}
              className={`im-link${i18n.language?.startsWith("ko") ? " im-link--active" : ""}`}
              type="button"
            >
              KO
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => i18n.changeLanguage("en")}
              className={`im-link${i18n.language?.startsWith("en") ? " im-link--active" : ""}`}
              type="button"
            >
              EN
            </button>
            <span style={{ margin: '0 8px', color: 'var(--ar-fog)' }}>|</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--ar-graphite)' }}>{auth.currentUser?.email}</span>
            <button type="button" className="im-link" onClick={onLogout} style={{ marginLeft: '1rem' }}>
              로그아웃
            </button>
          </div>
        </header>

        <LogViewer />

        <div className="im-split" style={{ alignItems: 'flex-start', marginTop: '16px' }}>
          <div className="im-panel" style={{ flex: '0 0 240px', position: 'sticky', top: '1rem' }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <NavLink to="/" className={({isActive}) => `dash-button ${isActive ? '' : 'dash-button--outline'}`} end>대시보드</NavLink>
              <NavLink to="/cases" className={({isActive}) => `dash-button ${isActive ? '' : 'dash-button--outline'}`}>케이스 관리</NavLink>
              <NavLink to="/templates" className={({isActive}) => `dash-button ${isActive ? '' : 'dash-button--outline'}`}>템플릿 관리</NavLink>
              <hr style={{ border: 'none', borderTop: '1px solid var(--ar-hairline)', margin: '0.5rem 0' }} />
              <NavLink to="/organization" className={({isActive}) => `dash-button ${isActive ? '' : 'dash-button--outline'}`}>조직 및 팀</NavLink>
              <NavLink to="/billing" className={({isActive}) => `dash-button ${isActive ? '' : 'dash-button--outline'}`}>정산 및 요금제</NavLink>
              <NavLink to="/settings" className={({isActive}) => `dash-button ${isActive ? '' : 'dash-button--outline'}`}>설정</NavLink>
            </nav>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem', minWidth: 0 }}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
