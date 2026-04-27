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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        <Header />
        <TokenInput />
        <LogViewer />
        
        {token && (
          <div className="flex flex-col lg:flex-row gap-6 items-start mt-4">
            <div className="w-full lg:w-1/4 shrink-0">
              <LeftSidebar />
            </div>
            <div className="w-full lg:w-3/4">
              <RightPanel />
            </div>
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
