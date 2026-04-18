import { useState } from "react";
import { CaseWorkboardPage } from "./components/CaseWorkboard/CaseWorkboardPage";
import { CaseQueue } from "./components/CaseQueue";
import { signInAnonymously } from "firebase/auth";
import { auth } from "@rp/firebase";
import { becomePartner, apiBase } from "./api";
import "./App.css";

function App() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");

  async function handleLogin() {
    setBusy(true);
    try {
      await signInAnonymously(auth);
      setLog("signed in (anonymous)");
    } catch (e: any) {
      setLog(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function handleBecomePartner() {
    setBusy(true);
    try {
      await becomePartner();
      setLog("dev: set claims role=partner partnerId=p_demo_01");
    } catch (e: any) {
      setLog(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Partner Console</h1>
      <p style={{ color: "#666" }}>임원변경(corp_officer_change_v1) MVP 작업보드</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <button disabled={busy} onClick={handleLogin}>익명 로그인</button>
        <button disabled={busy} onClick={handleBecomePartner}>dev: partner 전환(p_demo_01)</button>
        <div style={{ marginLeft: "auto" }}>
          <strong>API Base</strong>: {apiBase || "(not set)"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, alignItems: "start" }}>
        <CaseQueue 
          onSelectCase={(id) => {
            setSelectedCaseId(id);
            setLog(`selected caseId=${id}`);
          }} 
        />

        <div>
          {selectedCaseId ? (
            <CaseWorkboardPage caseId={selectedCaseId} onLog={setLog} />
          ) : (
            <div style={{ padding: 40, textAlign: "center", background: "#f9f9f9", borderRadius: 8, color: "#999" }}>
              왼쪽 큐에서 케이스를 선택해주세요.
            </div>
          )}
        </div>
      </div>

      <pre style={{ marginTop: 24, background: "#111", color: "#eee", padding: 12, borderRadius: 8, overflowX: "auto" }}>
        {log || "ready"}
      </pre>
    </div>
  );
}

export default App;
