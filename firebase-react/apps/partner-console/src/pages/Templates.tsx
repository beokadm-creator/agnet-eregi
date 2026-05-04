import React from 'react';
import TemplateManager from "../components/LeftSidebar/TemplateManager";

export default function Templates() {
  return (
    <div className="pc-page">
      <div className="pc-page-header">
        <div>
          <div className="pc-eyebrow" style={{ marginBottom: 6 }}>템플릿</div>
          <h1 className="pc-page-title">서류 템플릿 관리</h1>
          <p className="pc-page-sub">자주 사용하는 서류 양식을 관리하고 자동화하세요.</p>
        </div>
      </div>
      <div className="pc-section">
        <div className="pc-section-body">
          <TemplateManager />
        </div>
      </div>
    </div>
  );
}
