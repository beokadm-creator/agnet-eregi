import React, { useState } from "react";

export default function OrganizationSettings() {
  const [orgName, setOrgName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  const handleCreateOrg = () => {
    // API call to create organization
    console.log("Create Org:", orgName);
    setOrgName("");
  };

  const handleCreateWorkspace = () => {
    // API call to create workspace
    console.log("Create Workspace:", workspaceName);
    setWorkspaceName("");
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>조직 및 워크스페이스 관리</h3>
      
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>조직 생성</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <input 
            type="text" 
            placeholder="조직 이름" 
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            style={{ flex: 1, padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }}
          />
          <button 
            onClick={handleCreateOrg}
            style={{ padding: "6px 12px", borderRadius: 4, border: "none", background: "#007AFF", color: "#fff", cursor: "pointer" }}
          >
            생성
          </button>
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>워크스페이스 생성</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <input 
            type="text" 
            placeholder="워크스페이스 이름" 
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            style={{ flex: 1, padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }}
          />
          <button 
            onClick={handleCreateWorkspace}
            style={{ padding: "6px 12px", borderRadius: 4, border: "none", background: "#007AFF", color: "#fff", cursor: "pointer" }}
          >
            생성
          </button>
        </div>
      </div>
    </div>
  );
}
