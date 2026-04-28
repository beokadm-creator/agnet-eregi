import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
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
  const [busy, setBusy] = React.useState(false);
  const [log, setLog] = React.useState("");

  if (!isReady) return <div className="wc-root">Loading...</div>;
  if (token) return <Navigate to="/" replace />;

  async function handleGoogleLogin() {
    setBusy(true);
    setLog("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      setLog("로그인 완료");
    } catch (e: any) {
      setLog(`[Error] ${e?.message || "로그인 실패"}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailLogin(email: string, password: string) {
    setBusy(true);
    setLog("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setLog("로그인 완료");
    } catch (e: any) {
      setLog(`[Error] ${e?.message || "로그인 실패"}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSignUp(email: string, password: string) {
    setBusy(true);
    setLog("");
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      setLog("가입 완료");
    } catch (e: any) {
      setLog(`[Error] ${e?.message || "가입 실패"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <WelcomeScreen
      busy={busy}
      log={log}
      onGoogleLogin={handleGoogleLogin}
      onEmailLogin={handleEmailLogin}
      onEmailSignUp={handleEmailSignUp}
    />
  );
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
