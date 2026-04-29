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

/* ── Partner Selector ─────────────────────────────── */
function PartnerSelector() {
  const { idToken, setActingPartnerId } = useAppContext();
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!idToken) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${getApiBaseUrl()}/v1/partners`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        if (data.ok) {
          setPartners(data.data?.partners || []);
        } else {
          setError(data.error?.messageKo || "파트너 목록을 불러올 수 없습니다.");
        }
      } catch (e: any) {
        setError(e?.message || "네트워크 오류");
      } finally {
        setLoading(false);
      }
    })();
  }, [idToken]);

  const filtered = partners.filter(
    (p) =>
      p.bizName?.toLowerCase().includes(search.toLowerCase()) ||
      p.id?.toLowerCase().includes(search.toLowerCase())
  );

  const email = auth.currentUser?.email || "";
  const initial = email.charAt(0).toUpperCase();

  return (
    <div className="pc-selector-shell ar-root">
      {/* Topbar */}
      <header className="pc-selector-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28, height: 28, background: "var(--ar-accent)",
              borderRadius: 8, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 14,
            }}
          >
            ⚖
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--ar-ink)", letterSpacing: "-0.01em" }}>
            AgentRegi <span style={{ color: "var(--ar-accent)" }}>Partner</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--ar-slate)" }}>
            🔐 슈퍼어드민 · {email}
          </span>
          <button
            className="ar-btn ar-btn-ghost ar-btn-sm"
            onClick={() => auth.signOut()}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="pc-selector-body">
        <div style={{ marginBottom: 32 }}>
          <div className="ar-eyebrow" style={{ marginBottom: 8 }}>Ops Admin</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", margin: 0, color: "var(--ar-ink)" }}>
            파트너 선택
          </h1>
          <p style={{ color: "var(--ar-slate)", fontSize: 14, marginTop: 8 }}>
            관리할 파트너 계정을 선택하면 해당 파트너 콘솔로 진입합니다.
          </p>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <span style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: "var(--ar-fog)", pointerEvents: "none",
          }}>
            🔍
          </span>
          <input
            className="ar-input"
            type="text"
            placeholder="파트너명 또는 ID 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>

        {error && (
          <div className="pc-alert pc-alert-danger" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Table */}
        <div className="pc-section">
          <div className="pc-section-header">
            <h2 className="pc-section-title">파트너 목록</h2>
            <span className="ar-badge ar-badge-neutral">{filtered.length}개</span>
          </div>
          {loading ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ar-slate)" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12 }}>
                <div className="pc-loading-dot" style={{ background: "var(--ar-accent)" }} />
                <div className="pc-loading-dot" style={{ background: "var(--ar-accent)" }} />
                <div className="pc-loading-dot" style={{ background: "var(--ar-accent)" }} />
              </div>
              불러오는 중...
            </div>
          ) : (
            <div className="ar-table-wrap" style={{ borderRadius: 0, border: "none" }}>
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>상호명</th>
                    <th>사업자등록번호</th>
                    <th>상태</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td className="ar-mono" style={{ fontSize: 12, color: "var(--ar-slate)" }}>{p.id}</td>
                      <td className="ink">{p.bizName || "—"}</td>
                      <td className="ar-mono" style={{ fontSize: 12 }}>{p.bizRegNo || "—"}</td>
                      <td>
                        <span className={`ar-badge ${p.status === "ACTIVE" ? "ar-badge-success" : "ar-badge-neutral"}`}>
                          {p.status || "—"}
                        </span>
                      </td>
                      <td style={{ width: 100, textAlign: "right" }}>
                        <button
                          className="ar-btn ar-btn-accent ar-btn-sm"
                          onClick={() => setActingPartnerId(p.id)}
                        >
                          선택 →
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "40px 24px", color: "var(--ar-fog)" }}>
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

/* ── Auth Guard ──────────────────────────────────── */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { authReady, accessDenied, isOpsAdmin, claims, actingPartnerId } = useAppContext();

  if (!authReady) {
    return (
      <div className="pc-loading-shell">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{
            width: 40, height: 40, background: "var(--ar-accent)",
            borderRadius: 12, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 22,
          }}>
            ⚖
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div className="pc-loading-dot" />
            <div className="pc-loading-dot" />
            <div className="pc-loading-dot" />
          </div>
        </div>
      </div>
    );
  }

  if (!auth.currentUser) return <Navigate to="/login" replace />;

  if (accessDenied) {
    return (
      <div className="pc-auth-shell ar-root">
        <div className="pc-auth-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🚫</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px", color: "var(--ar-ink)" }}>
            접근 권한 없음
          </h2>
          <p style={{ color: "var(--ar-slate)", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
            partnerId 커스텀 클레임이 필요합니다.<br />
            <code style={{ fontSize: 12, color: "var(--ar-graphite)" }}>{auth.currentUser?.email}</code>
          </p>
          <button className="ar-btn ar-btn-ghost" onClick={() => auth.signOut()}>
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  if (isOpsAdmin && !claims?.partnerId && !actingPartnerId) {
    return <PartnerSelector />;
  }

  return <>{children}</>;
}

/* ── Login Route ─────────────────────────────────── */
function LoginRoute() {
  const { authReady } = useAppContext();
  if (!authReady) {
    return (
      <div className="pc-loading-shell">
        <div style={{ display: "flex", gap: 6 }}>
          <div className="pc-loading-dot" />
          <div className="pc-loading-dot" />
          <div className="pc-loading-dot" />
        </div>
      </div>
    );
  }
  if (auth.currentUser) return <Navigate to="/" replace />;
  return <AuthScreen />;
}

/* ── App ─────────────────────────────────────────── */
function AppContent() {
  const { logout } = useAppContext();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <PartnerLayout onLogout={logout} />
            </AuthGuard>
          }
        >
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
