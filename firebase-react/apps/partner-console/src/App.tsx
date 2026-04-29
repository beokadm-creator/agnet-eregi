import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { auth } from "@rp/firebase";

import { AppProvider, useAppContext } from "./context/AppContext";
import { getApiBaseUrl } from "./apiBase";
import PartnerLayout from "./layouts/PartnerLayout";
import AuthScreen from "./components/AuthScreen";

import Dashboard from "./pages/Dashboard";
import Cases from "./pages/Cases";
import Templates from "./pages/Templates";
import Organization from "./pages/Organization";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";

interface PartnerOption {
  id: string;
  bizName: string;
  bizRegNo: string;
  status: string;
}

function PartnerSelector() {
  const { idToken, setActingPartnerId } = useAppContext();
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchPartners() {
      try {
        setLoading(true);
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/v1/partners`, {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        const data = await res.json();
        if (data.ok) {
          setPartners(data.data?.partners || []);
        } else {
          setError(data.error?.messageKo || "파트너 목록을 불러올 수 없습니다.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "네트워크 오류");
      } finally {
        setLoading(false);
      }
    }
    if (idToken) fetchPartners();
  }, [idToken]);

  const filtered = partners.filter(p =>
    p.bizName.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="im-shell">
      <div className="im-container">
        <header className="im-header">
          <h1 className="im-title">Partner Console</h1>
          <div className="im-lang">
            <span style={{ fontSize: '0.875rem', color: 'var(--ar-graphite)' }}>
              🔐 슈퍼어드민 모드 — {auth.currentUser?.email}
            </span>
            <button type="button" className="im-link" onClick={() => auth.signOut()} style={{ marginLeft: '1rem' }}>
              로그아웃
            </button>
          </div>
        </header>

        <div className="im-panel" style={{ marginTop: '1rem' }}>
          <h3 className="im-panel-title">파트너를 선택하세요</h3>
          <p style={{ color: 'var(--ar-graphite)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            관리할 파트너 계정을 선택하면 해당 파트너의 데이터에 접근할 수 있습니다.
          </p>

          {error && <div style={{ color: 'var(--ar-danger)', fontSize: '0.8125rem', marginBottom: '1rem' }}>{error}</div>}

          <input
            className="ar-input ar-input-sm"
            type="text"
            placeholder="파트너명 또는 ID로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: '1rem' }}
          />

          {loading ? (
            <div className="im-log">불러오는 중...</div>
          ) : (
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>상호명</th>
                    <th>사업자등록번호</th>
                    <th>상태</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td className="ar-mono" style={{ fontSize: 12 }}>{p.id}</td>
                      <td style={{ fontWeight: 600 }}>{p.bizName || "-"}</td>
                      <td className="ar-mono" style={{ fontSize: 12 }}>{p.bizRegNo || "-"}</td>
                      <td>
                        <span className={`ar-badge ${p.status === 'ACTIVE' ? 'ar-badge-success' : 'ar-badge-neutral'}`}>
                          {p.status || "-"}
                        </span>
                      </td>
                      <td>
                        <button className="ar-btn ar-btn-sm ar-btn-accent" onClick={() => setActingPartnerId(p.id)}>
                          선택
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--ar-slate)' }}>
                        검색 결과가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { authReady, accessDenied, isOpsAdmin, claims, actingPartnerId } = useAppContext();

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
      <div className="im-shell">
        <div className="im-container">
          <header className="im-header">
            <h1 className="im-title">Partner Console</h1>
            <div className="im-lang">
              <span style={{ fontSize: '0.875rem', color: 'var(--ar-graphite)' }}>{auth.currentUser?.email}</span>
              <button type="button" className="im-link" onClick={() => auth.signOut()} style={{ marginLeft: '1rem' }}>
                로그아웃
              </button>
            </div>
          </header>
          <div className="im-log" style={{ background: 'var(--ar-danger-soft)', color: 'var(--ar-danger)', marginTop: '16px' }}>
            권한이 없습니다. partnerId 커스텀 클레임이 필요합니다.
          </div>
        </div>
      </div>
    );
  }

  if (isOpsAdmin && !claims?.partnerId && !actingPartnerId) {
    return <PartnerSelector />;
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
