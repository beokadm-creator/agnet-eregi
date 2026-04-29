import React from 'react';
import CaseList from "../components/LeftSidebar/CaseList";
import RightPanel from "../components/Layout/RightPanel";

export default function Cases() {
  return (
    <div className="pc-page" style={{ padding: 0, gap: 0, height: '100%', flexDirection: 'row' }}>
      <div style={{ width: '400px', borderRight: '1px solid var(--pc-border)', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <CaseList />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <RightPanel />
      </div>
    </div>
  );
}
