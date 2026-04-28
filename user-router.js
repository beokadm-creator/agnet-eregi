const fs = require('fs');
const path = require('path');

const srcDir = './firebase-react/apps/user-web/src';
const appPath = path.join(srcDir, 'App.tsx');
const mainPath = path.join(srcDir, 'main.tsx');

// Create folders
const pagesDir = path.join(srcDir, 'pages');
if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir);
const layoutDir = path.join(srcDir, 'layouts');
if (!fs.existsSync(layoutDir)) fs.mkdirSync(layoutDir);

// 1. Layout Component
const layoutCode = `import React from 'react';
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
`;
fs.writeFileSync(path.join(layoutDir, 'DashLayout.tsx'), layoutCode);

// 2. Auth Context (Simple version for now to share token/auth state)
const authContextCode = `import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '@rp/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface AuthContextType {
  token: string;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextType>({ token: '', isReady: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken(true);
          setToken(idToken);
        } catch (e) {
          console.error(e);
        }
      } else {
        setToken('');
      }
      setIsReady(true);
    });
    return unsub;
  }, []);

  return <AuthContext.Provider value={{ token, isReady }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
`;
const contextDir = path.join(srcDir, 'context');
if (!fs.existsSync(contextDir)) fs.mkdirSync(contextDir);
fs.writeFileSync(path.join(contextDir, 'AuthContext.tsx'), authContextCode);

