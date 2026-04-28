import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { auth } from "@rp/firebase";

import { AppProvider, useAppContext } from "./context/AppContext";
import PartnerLayout from "./layouts/PartnerLayout";
import AuthScreen from "./components/AuthScreen";

import Dashboard from "./pages/Dashboard";
import Cases from "./pages/Cases";
import Templates from "./pages/Templates";
import Organization from "./pages/Organization";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { authReady, accessDenied } = useAppContext();
  
  if (!authReady) {
    return (
      <div className="im-shell">
        <div className="im-container">
          <div className="im-log">loading...</div>
        </div>
      </div>
    );
  }

  if (!auth.currentUser) return <Navigate to="/login" replace />;
  
  if (accessDenied) {
    return (
      <div className="im-shell selection:bg-[var(--brand)]/10 selection:text-[var(--brand)]">
        <div className="im-container">
          <header className="im-header">
            <h1 className="im-title">Partner Console</h1>
            <div className="im-lang">
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{auth.currentUser?.email}</span>
              <button type="button" className="im-link" onClick={() => auth.signOut()} style={{ marginLeft: '1rem' }}>
                로그아웃
              </button>
            </div>
          </header>
          <div className="im-log" style={{ background: "var(--error-light)", color: "var(--error)", marginTop: '16px' }}>
            권한이 없습니다. partnerId 커스텀 클레임이 필요합니다.
          </div>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

function LoginRoute() {
  const { authReady } = useAppContext();
  
  if (!authReady) {
    return (
      <div className="im-shell">
        <div className="im-container">
          <div className="im-log">loading...</div>
        </div>
      </div>
    );
  }

  if (auth.currentUser) return <Navigate to="/" replace />;
  return <AuthScreen />;
}

function AppContent() {
  const { logout } = useAppContext();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/" element={<AuthGuard><PartnerLayout onLogout={logout} /></AuthGuard>}>
          <Route index element={<Dashboard />} />
          <Route path="cases" element={<Cases />} />
          <Route path="templates" element={<Templates />} />
          <Route path="organization" element={<Organization />} />
          <Route path="billing" element={<Billing />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
