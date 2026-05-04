import React from 'react';
import NotificationSettings from "../components/LeftSidebar/NotificationSettings";
import B2gCredentials from "../components/LeftSidebar/B2gCredentials";
import SecuritySettings from "../components/LeftSidebar/SecuritySettings";
import DeveloperSettings from "../components/LeftSidebar/DeveloperSettings";

export default function Settings() {
  return (
    <div className="pc-page">
      <div className="pc-page-header">
        <div>
          <div className="pc-eyebrow" style={{ marginBottom: 6 }}>설정</div>
          <h1 className="pc-page-title">환경 설정</h1>
          <p className="pc-page-sub">시스템, 알림, 보안, 개발자 도구를 설정합니다.</p>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="pc-section">
            <div className="pc-section-header">
              <h2 className="pc-section-title">알림 설정</h2>
            </div>
            <div className="pc-section-body">
              <NotificationSettings />
            </div>
          </div>
          
          <div className="pc-section">
            <div className="pc-section-header">
              <h2 className="pc-section-title">B2G 연동 정보</h2>
            </div>
            <div className="pc-section-body">
              <B2gCredentials />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="pc-section">
            <div className="pc-section-header">
              <h2 className="pc-section-title">보안 설정</h2>
            </div>
            <div className="pc-section-body">
              <SecuritySettings />
            </div>
          </div>

          <div className="pc-section">
            <div className="pc-section-header">
              <h2 className="pc-section-title">개발자 및 Webhook</h2>
            </div>
            <div className="pc-section-body">
              <DeveloperSettings />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
