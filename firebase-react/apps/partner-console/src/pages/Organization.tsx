import React from 'react';
import OrganizationSettings from "../components/LeftSidebar/OrganizationSettings";
import TeamMembers from "../components/LeftSidebar/TeamMembers";

export default function Organization() {
  return (
    <div className="pc-page">
      <div className="pc-page-header">
        <div>
          <div className="pc-eyebrow" style={{ marginBottom: 6 }}>조직 및 팀</div>
          <h1 className="pc-page-title">조직 관리</h1>
          <p className="pc-page-sub">조직 기본 정보 및 팀원 권한 설정</p>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="pc-section">
          <div className="pc-section-header">
            <h2 className="pc-section-title">조직 설정</h2>
          </div>
          <div className="pc-section-body">
            <OrganizationSettings />
          </div>
        </div>
        
        <div className="pc-section">
          <div className="pc-section-header">
            <h2 className="pc-section-title">팀원 관리</h2>
          </div>
          <div className="pc-section-body">
            <TeamMembers />
          </div>
        </div>
      </div>
    </div>
  );
}
