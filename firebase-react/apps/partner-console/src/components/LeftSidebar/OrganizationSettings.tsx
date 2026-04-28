import { useEffect, useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

export default function OrganizationSettings() {
  const { busy, setBusy, setLog } = useAppContext();
  const [orgName, setOrgName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");

  async function loadOrganizations() {
    try {
      const res = await getApi().get("/v1/partner/organizations");
      const next = res.items || [];
      setOrganizations(next);
      if (!selectedOrgId && next.length > 0) setSelectedOrgId(String(next[0].id));
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    }
  }

  useEffect(() => {
    loadOrganizations();
  }, []);

  async function handleCreateOrg() {
    if (!orgName) return;
    setBusy(true);
    setLog("조직 생성 중...");
    try {
      const res = await getApi().post("/v1/partner/organizations", { name: orgName });
      setLog(`조직 생성 완료: ${res.id}`);
      setOrgName("");
      await loadOrganizations();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateWorkspace() {
    if (!workspaceName || !selectedOrgId) return;
    setBusy(true);
    setLog("워크스페이스 생성 중...");
    try {
      const res = await getApi().post("/v1/partner/workspaces", { name: workspaceName, organizationId: selectedOrgId });
      setLog(`워크스페이스 생성 완료: ${res.id}`);
      setWorkspaceName("");
      setWorkspaces((prev) => [{ ...res }, ...prev]);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>조직 및 워크스페이스 관리</h3>
      
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>조직 생성</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <Input 
            type="text" 
            placeholder="조직 이름" 
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            style={{ flex: 1, padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }}
          />
          <Button 
            onClick={handleCreateOrg} 
            disabled={busy || !orgName}
            style={{ padding: "6px 12px", borderRadius: 4, border: "none", background: "#007AFF", color: "#fff", cursor: "pointer" }}
          >
            생성
          </Button>
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>워크스페이스 생성</h4>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)} style={{ flex: 1, padding: "6px 10px" }}>
            <option value="">조직 선택</option>
            {organizations.map((o) => (
              <option key={o.id} value={String(o.id)}>{o.name} ({o.id})</option>
            ))}
          </select>
          <Button onClick={loadOrganizations} disabled={busy} style={{ padding: "6px 12px", borderRadius: 4, border: "1px solid #ccc", background: "#eee", cursor: "pointer" }}>
            새로고침
          </Button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Input 
            type="text" 
            placeholder="워크스페이스 이름" 
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            style={{ flex: 1, padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }}
          />
          <Button 
            onClick={handleCreateWorkspace} 
            disabled={busy || !workspaceName || !selectedOrgId}
            style={{ padding: "6px 12px", borderRadius: 4, border: "none", background: "#007AFF", color: "#fff", cursor: "pointer" }}
          >
            생성
          </Button>
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: "0.9em" }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>내 조직</div>
        {organizations.length === 0 ? (
          <div style={{ color: "#999" }}>조직이 없습니다.</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {organizations.map((o) => (
              <div key={o.id} style={{ border: "1px solid #eee", borderRadius: 6, padding: 10, background: "#fafafa" }}>
                <div style={{ fontWeight: 600 }}>{o.name}</div>
                <div style={{ color: "#666", fontSize: "0.85em" }}>ID: {o.id}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: "0.9em" }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>최근 생성된 워크스페이스</div>
        {workspaces.length === 0 ? (
          <div style={{ color: "#999" }}>생성된 워크스페이스가 없습니다.</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {workspaces.map((w) => (
              <div key={w.id} style={{ border: "1px solid #eee", borderRadius: 6, padding: 10, background: "#fafafa" }}>
                <div style={{ fontWeight: 600 }}>{w.name}</div>
                <div style={{ color: "#666", fontSize: "0.85em" }}>ID: {w.id}</div>
                <div style={{ color: "#666", fontSize: "0.85em" }}>Organization: {w.organizationId}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
