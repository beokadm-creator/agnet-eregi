import { AppProvider, useAppContext } from "./context/AppContext";
import { auth } from "@rp/firebase";
import Header from "./components/Layout/Header";
import LogViewer from "./components/Layout/LogViewer";
import LeftSidebar from "./components/Layout/LeftSidebar";
import RightPanel from "./components/Layout/RightPanel";
import AuthScreen from "./components/AuthScreen";

function PartnerConsoleContent() {
  const { authReady, accessDenied, logout } = useAppContext();

  if (!authReady) {
    return (
      <div className="im-shell">
        <div className="im-container">
          <div className="im-log">loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="im-shell selection:bg-[var(--brand)]/10 selection:text-[var(--brand)]">
      <div className="im-container">
        {!auth.currentUser && <AuthScreen />}

        {auth.currentUser && (
          <>
            <Header />
            <div className="im-lang" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="im-link" onClick={logout}>
                로그아웃
              </button>
            </div>
            {accessDenied && (
              <div className="im-log" style={{ background: "var(--error-light)", color: "var(--error)" }}>
                권한이 없습니다. partnerId 커스텀 클레임이 필요합니다.
              </div>
            )}
            {!accessDenied && <LogViewer />}
          </>
        )}

        {!accessDenied && auth.currentUser && (
          <div className="im-split">
            <LeftSidebar />
            <RightPanel />
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <PartnerConsoleContent />
    </AppProvider>
  );
}
