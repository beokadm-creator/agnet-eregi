const fs = require('fs');
const path = require('path');
const srcDir = './firebase-react/apps/ops-console/src';

const appTsxCode = `import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "@rp/firebase";

import { AuthProvider, useAuth } from "./context/AuthContext";
import OpsLayout from "./layouts/OpsLayout";
import AuthScreen from "./components/AuthScreen";

import Dashboard from "./pages/Dashboard";
import CasePacks from "./pages/CasePacks";
import AccessControl from "./pages/AccessControl";
import Observability from "./pages/Observability";
import ReviewQueue from "./pages/ReviewQueue";
import SlaDashboard from "./pages/SlaDashboard";
import AuditLogs from "./pages/AuditLogs";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isReady, accessDenied } = useAuth();
  
  if (!isReady) return <div className="im-shell"><div className="im-container"><div className="im-log">loading...</div></div></div>;
  if (!token) return <Navigate to="/login" replace />;
  if (accessDenied) return (
    <div className="im-shell">
      <div className="im-container">
        <header className="im-header">
          <h1 className="im-title">Ops Console</h1>
          <div className="im-lang">
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{auth.currentUser?.email}</span>
            <button type="button" className="im-link" onClick={() => signOut(auth)} style={{ marginLeft: '1rem' }}>로그아웃</button>
          </div>
        </header>
        <div className="im-log" style={{ background: "var(--error-light)", color: "var(--error)" }}>
          권한이 없습니다. opsRole 커스텀 클레임이 필요하거나 Super Admin이어야 합니다.
        </div>
      </div>
    </div>
  );
  
  return <>{children}</>;
}

function LoginRoute() {
  const { token, isReady } = useAuth();
  if (!isReady) return <div className="im-shell"><div className="im-container"><div className="im-log">loading...</div></div></div>;
  if (token) return <Navigate to="/" replace />;
  return <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/" element={<AuthGuard><OpsLayout onLogout={() => signOut(auth)} /></AuthGuard>}>
            <Route index element={<Dashboard />} />
            <Route path="case-packs" element={<CasePacks />} />
            <Route path="access" element={<AccessControl />} />
            <Route path="observability" element={<Observability />} />
            <Route path="review-queue" element={<ReviewQueue />} />
            <Route path="sla-dashboard" element={<SlaDashboard />} />
            <Route path="audit-logs" element={<AuditLogs />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
`;
fs.writeFileSync(path.join(srcDir, 'OpsShell.tsx'), appTsxCode);
