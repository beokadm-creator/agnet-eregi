import React from 'react';
import Subscriptions from "../components/LeftSidebar/Subscriptions";
import SettlementsAndAds from "../components/LeftSidebar/SettlementsAndAds";

export default function Billing() {
  return (
    <div className="pc-page">
      <div className="pc-page-header">
        <div>
          <div className="pc-eyebrow" style={{ marginBottom: 6 }}>정산 및 요금제</div>
          <h1 className="pc-page-title">구독 및 정산</h1>
          <p className="pc-page-sub">플랜 관리와 매출 정산 내역을 확인하세요.</p>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="pc-section">
          <div className="pc-section-header">
            <h2 className="pc-section-title">구독 플랜</h2>
          </div>
          <div className="pc-section-body">
            <Subscriptions />
          </div>
        </div>
        
        <div className="pc-section">
          <div className="pc-section-header">
            <h2 className="pc-section-title">정산 및 광고비</h2>
          </div>
          <div className="pc-section-body">
            <SettlementsAndAds />
          </div>
        </div>
      </div>
    </div>
  );
}
