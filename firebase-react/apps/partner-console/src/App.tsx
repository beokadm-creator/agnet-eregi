import React from "react";
import { AppProvider, useAppContext } from "./context/AppContext";
import Header from "./components/Layout/Header";
import TokenInput from "./components/Layout/TokenInput";
import LogViewer from "./components/Layout/LogViewer";
import LeftSidebar from "./components/Layout/LeftSidebar";
import RightPanel from "./components/Layout/RightPanel";

function PartnerConsoleContent() {
  const { token } = useAppContext();

  return (
    <div style={{ fontFamily: "sans-serif", padding: 20, maxWidth: 1200, margin: "0 auto", background: "#fafafa", minHeight: "100vh" }}>
      <Header />
      <TokenInput />
      <LogViewer />
      
      {token && (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <LeftSidebar />
          <RightPanel />
        </div>
      )}
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
