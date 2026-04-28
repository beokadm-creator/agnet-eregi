import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { auth } from '@rp/firebase';

export default function DashLayout({ onLogout }: { onLogout: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="dash-root">
      <div className="dash-container">
        <header className="dash-header">
          <h1 className="dash-title" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>AgentRegi</h1>
          <div className="dash-nav">
            <span>{t('auth_load') || auth.currentUser?.email || 'User'}</span>
            <button onClick={() => i18n.changeLanguage('ko')} className="dash-nav-btn" style={{ fontWeight: i18n.language?.startsWith('ko') ? 600 : 400, color: i18n.language?.startsWith('ko') ? 'var(--text-primary)' : '' }}>KO</button>
            <span style={{color: 'var(--border-strong)'}}>·</span>
            <button onClick={() => i18n.changeLanguage('en')} className="dash-nav-btn" style={{ fontWeight: i18n.language?.startsWith('en') ? 600 : 400, color: i18n.language?.startsWith('en') ? 'var(--text-primary)' : '' }}>EN</button>
            <span style={{color: 'var(--border-strong)'}}>·</span>
            <button onClick={onLogout} className="dash-nav-btn">로그아웃</button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
