import React from 'react';
import { EnterpriseAnalytics } from "../components/LeftSidebar/EnterpriseAnalytics";
import QualityTier from "../components/LeftSidebar/QualityTier";

const Ic = {
  search: () => <span>🔍</span>,
  filter: () => <span>⚙️</span>,
  plus: () => <span>+</span>,
};

export default function Dashboard() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--ar-hairline)' }}>
        <div>
          <div className="ar-eyebrow" style={{ marginBottom: 4 }}>Partner Dashboard</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>실적 및 품질 현황</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="ar-btn ar-btn-sm ar-btn-ink"><Ic.plus /> 사건 등록</button>
        </div>
      </div>

      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="ar-card" style={{ padding: 24 }}>
          <div className="ar-eyebrow" style={{ marginBottom: 16 }}>Enterprise Analytics</div>
          <EnterpriseAnalytics />
        </div>
        
        <div className="ar-card" style={{ padding: 24 }}>
          <div className="ar-eyebrow" style={{ marginBottom: 16 }}>Quality Tier & Ranking</div>
          <QualityTier />
        </div>
      </div>
    </>
  );
}
