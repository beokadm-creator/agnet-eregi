import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@agentregi/ui-components";
import { useAppContext } from "../../context/AppContext";
import { initApi } from "../../services/api";

export default function TokenInput() {
  const { t } = useTranslation();
  const { token, setToken, busy, loadCases } = useAppContext();

  useEffect(() => {
    const t = localStorage.getItem("partner_token");
    if (t) {
      setToken(t);
      initApi(() => t);
    }
  }, [setToken]);

  function handleSaveToken(tStr: string) {
    setToken(tStr);
    localStorage.setItem("partner_token", tStr);
    initApi(() => tStr);
  }

  return (
    <div style={{ marginBottom: 20, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #ddd", display: "flex", gap: 8, alignItems: "center" }}>
      <label style={{ fontWeight: "bold" }}>Partner Token:</label>
      <Input 
        value={token} 
        onChange={e => handleSaveToken(e.target.value)} 
        style={{ flex: 1, padding: 8, borderRadius: 4, border: "1px solid #ccc" }} 
        placeholder="Firebase Auth Token (custom claims: { partnerId: 'xxx' })" 
      />
      <Button onClick={loadCases} disabled={busy || !token} style={{ padding: "8px 16px", background: "#00695c", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
        {t('auth_load')}
      </Button>
    </div>
  );
}
