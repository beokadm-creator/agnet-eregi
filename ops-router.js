const fs = require('fs');
const path = require('path');

const srcDir = './firebase-react/apps/ops-console/src';
const pagesDir = path.join(srcDir, 'pages');
if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir);
const layoutDir = path.join(srcDir, 'layouts');
if (!fs.existsSync(layoutDir)) fs.mkdirSync(layoutDir);
const contextDir = path.join(srcDir, 'context');
if (!fs.existsSync(contextDir)) fs.mkdirSync(contextDir);

// 1. Auth Context
const authContextCode = `import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth } from '@rp/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface AuthContextType {
  token: string;
  isReady: boolean;
  accessDenied: boolean;
}

const AuthContext = createContext<AuthContextType>({ token: '', isReady: false, accessDenied: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const idToken = await u.getIdToken(true);
          setToken(idToken);
          const tokenResult = await u.getIdTokenResult();
          const opsRole = tokenResult.claims?.opsRole ? String(tokenResult.claims.opsRole) : "";
          const isSuperAdmin = u.uid === "sOhR3HDAitbyX2izUyge61W3gQr2";
          setAccessDenied(!isSuperAdmin && !["ops_admin", "ops_operator", "ops_viewer"].includes(opsRole));
        } catch (e) {
          console.error(e);
        }
      } else {
        setToken('');
        setAccessDenied(false);
      }
      setIsReady(true);
    });
    return unsub;
  }, []);

  return <AuthContext.Provider value={{ token, isReady, accessDenied }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
`;
fs.writeFileSync(path.join(contextDir, 'AuthContext.tsx'), authContextCode);

// 2. Layout Component
const layoutCode = `import React from 'react';
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
              <NavLink to="/" className={({isActive}) => \`dash-button \${isActive ? '' : 'dash-button--outline'}\`} end>Gate / Operations</NavLink>
              <NavLink to="/case-packs" className={({isActive}) => \`dash-button \${isActive ? '' : 'dash-button--outline'}\`}>Case Packs</NavLink>
              <NavLink to="/access" className={({isActive}) => \`dash-button \${isActive ? '' : 'dash-button--outline'}\`}>Access Control</NavLink>
              <NavLink to="/observability" className={({isActive}) => \`dash-button \${isActive ? '' : 'dash-button--outline'}\`}>Observability</NavLink>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />
              <NavLink to="/review-queue" className={({isActive}) => \`dash-button \${isActive ? '' : 'dash-button--outline'}\`}>Review Queue (New)</NavLink>
              <NavLink to="/sla-dashboard" className={({isActive}) => \`dash-button \${isActive ? '' : 'dash-button--outline'}\`}>SLA Dashboard (New)</NavLink>
              <NavLink to="/audit-logs" className={({isActive}) => \`dash-button \${isActive ? '' : 'dash-button--outline'}\`}>Audit Logs (New)</NavLink>
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
`;
fs.writeFileSync(path.join(layoutDir, 'OpsLayout.tsx'), layoutCode);

