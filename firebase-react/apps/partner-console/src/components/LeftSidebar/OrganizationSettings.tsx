import { useEffect, useState } from "react";
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
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--pc-text)" }}>조직 생성</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <input 
            type="text" 
            placeholder="조직 이름" 
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="pc-input"
            style={{ flex: 1 }}
          />
          <button 
            onClick={handleCreateOrg} 
            disabled={busy || !orgName}
            className="pc-btn pc-btn-brand"
          >
            생성
          </button>
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--pc-text)" }}>워크스페이스 생성</h4>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)} className="pc-input" style={{ flex: 1 }}>
            <option value="">조직 선택</option>
            {organizations?.map((o) => (
              <option key={o.id} value={String(o.id)}>{o.name} ({o.id})</option>
            ))}
          </select>
          <button onClick={loadOrganizations} disabled={busy} className="pc-btn">
            새로고침
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input 
            type="text" 
            placeholder="워크스페이스 이름" 
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            className="pc-input"
            style={{ flex: 1 }}
          />
          <button 
            onClick={handleCreateWorkspace} 
            disabled={busy || !workspaceName || !selectedOrgId}
            className="pc-btn pc-btn-brand"
          >
            생성
          </button>
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "var(--pc-text)" }}>내 조직</div>
        {organizations.length === 0 ? (
          <div style={{ color: "var(--pc-text-muted)", fontSize: 13, background: "var(--pc-surface)", padding: 16, borderRadius: "var(--pc-radius)", textAlign: "center" }}>조직이 없습니다.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {organizations?.map((o) => (
              <div key={o.id} style={{ border: "1px solid var(--pc-border)", borderRadius: "var(--pc-radius)", padding: 12, background: "var(--pc-surface)" }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{o.name}</div>
                <div className="pc-mono" style={{ color: "var(--pc-text-muted)", fontSize: 12, marginTop: 4 }}>ID: {o.id}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "var(--pc-text)" }}>최근 생성된 워크스페이스</div>
        {workspaces.length === 0 ? (
          <div style={{ color: "var(--pc-text-muted)", fontSize: 13, background: "var(--pc-surface)", padding: 16, borderRadius: "var(--pc-radius)", textAlign: "center" }}>생성된 워크스페이스가 없습니다.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {workspaces?.map((w) => (
              <div key={w.id} style={{ border: "1px solid var(--pc-border)", borderRadius: "var(--pc-radius)", padding: 12, background: "var(--pc-surface)" }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{w.name}</div>
                <div className="pc-mono" style={{ color: "var(--pc-text-muted)", fontSize: 12, marginTop: 4 }}>ID: {w.id}</div>
                <div className="pc-mono" style={{ color: "var(--pc-text-muted)", fontSize: 12 }}>Organization: {w.organizationId}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
