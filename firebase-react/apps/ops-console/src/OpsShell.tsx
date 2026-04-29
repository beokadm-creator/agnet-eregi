import React from "react";
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
import BusinessDashboard from "./pages/BusinessDashboard";
import Incidents from "./pages/Incidents";
import Release from "./pages/Release";
import System from "./pages/System";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import PartnerApplications from "./pages/PartnerApplications";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isReady, accessDenied } = useAuth();
  
  if (!isReady) return <div className="im-shell"><div className="im-container"><div className="im-log">불러오는 중...</div></div></div>;
  if (!token) return <Navigate to="/login" replace />;
  if (accessDenied) return (
    <div className="im-shell">
      <div className="im-container">
        <header className="im-header">
            <h1 className="im-title">운영 콘솔</h1>
          <div className="im-lang">
            <span style={{ fontSize: '0.875rem', color: 'var(--ar-graphite)' }}>{auth.currentUser?.email}</span>
            <button type="button" className="im-link" onClick={() => signOut(auth)} style={{ marginLeft: '1rem' }}>로그아웃</button>
          </div>
        </header>
        <div className="im-log" style={{ background: "var(--ar-danger-soft)", color: "var(--ar-danger)" }}>
          권한이 없습니다. opsRole 커스텀 클레임이 필요하거나 슈퍼어드민이어야 합니다.
        </div>
      </div>
    </div>
  );
  
  return <>{children}</>;
}

function LoginRoute() {
  const { token, isReady } = useAuth();
  if (!isReady) return <div className="im-shell"><div className="im-container"><div className="im-log">불러오는 중...</div></div></div>;
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
            <Route path="business" element={<BusinessDashboard />} />
            <Route index element={<Dashboard />} />
            <Route path="case-packs" element={<CasePacks />} />
            <Route path="access" element={<AccessControl />} />
            <Route path="observability" element={<Observability />} />
            <Route path="review-queue" element={<ReviewQueue />} />
            <Route path="partner-applications" element={<PartnerApplications />} />
            <Route path="sla-dashboard" element={<SlaDashboard />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="release" element={<Release />} />
            <Route path="system" element={<System />} />
            <Route path="settings" element={<Settings />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
