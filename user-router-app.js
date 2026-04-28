const fs = require('fs');
const path = require('path');
const srcDir = './firebase-react/apps/user-web/src';

const appTsxCode = `import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { signOut } from "firebase/auth";
import { auth } from "@rp/firebase";

import { AuthProvider, useAuth } from "./context/AuthContext";
import DashLayout from "./layouts/DashLayout";
import WelcomeScreen from "./components/WelcomeScreen";
import Dashboard from "./pages/Dashboard";

// Keep existing complex logic in SubmissionDetail (will refactor later if needed)
const SubmissionDetail = lazy(() => import("./pages/SubmissionDetail"));

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isReady } = useAuth();
  if (!isReady) return <div className="wc-root">Loading...</div>;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LoginRoute() {
  const { token, isReady } = useAuth();
  if (!isReady) return <div className="wc-root">Loading...</div>;
  if (token) return <Navigate to="/" replace />;
  return <WelcomeScreen 
    busy={false} log="" 
    onGoogleLogin={() => {}} 
    onEmailLogin={() => {}} 
    onEmailSignUp={() => {}} 
  />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/" element={
            <AuthGuard>
              <DashLayout onLogout={() => signOut(auth)} />
            </AuthGuard>
          }>
            <Route index element={<Dashboard />} />
            {/* Detail logic will be moved to its own page next */}
            <Route path="submissions/:id" element={
              <Suspense fallback={<div>Loading...</div>}>
                <SubmissionDetail />
              </Suspense>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
`;

fs.writeFileSync(path.join(srcDir, 'App.tsx'), appTsxCode);
