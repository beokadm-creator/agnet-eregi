import { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

export default function B2gCredentials() {
  const { b2gCredentials, loadCases, busy, setBusy, setLog } = useAppContext();
  const [newB2gAgency, setNewB2gAgency] = useState("IROS");
  const [newB2gPassword, setNewB2gPassword] = useState("");
  const [newB2gCertData, setNewB2gCertData] = useState("");

  async function registerB2gCredential() {
    if (!newB2gPassword || !newB2gCertData.trim()) return;
    setBusy(true);
    setLog(`공동인증서 연동 준비 중 (${newB2gAgency})...`);
    try {
      const res = await getApi().post("/v1/partners/credentials", {
        agencyType: newB2gAgency,
        certPassword: newB2gPassword,
        certData: newB2gCertData.trim()
      });
      setLog(`인증서 연동 완료: ${res.credentialId}`);
      setNewB2gPassword("");
      setNewB2gCertData("");
      await loadCases();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderTop: "2px solid var(--ar-surface-muted)", paddingTop: 16, marginTop: 16 }}>
      <h3 style={{ margin: "0 0 12px 0", color: "var(--ar-accent)", fontSize: "1.1em" }}>🏛️ 공공기관 연동 인증서 관리 (EP-13)</h3>
      <div style={{ marginBottom: 12, fontSize: "0.9em", color: "var(--ar-graphite)" }}>
        대법원(IROS), 정부24 등 전자신청 시 사용할 공동인증서를 등록합니다.<br/>
        인증서는 GCP Secret Manager에 암호화되어 안전하게 보관됩니다.
      </div>
      <div style={{ display: "flex", gap: 8, background: "var(--ar-accent-soft)", padding: 12, borderRadius: "var(--ar-r1)", alignItems: "center", marginBottom: 16 }}>
        <select value={newB2gAgency} onChange={e => setNewB2gAgency(e.target.value)} style={{ padding: 6, flex: 1 }}>
          <option value="IROS">인터넷등기소 (IROS)</option>
          <option value="HOMETAX">국세청 홈택스 (HOMETAX)</option>
          <option value="GOV24">정부24 (GOV24)</option>
        </select>
        <Input type="password" placeholder="인증서 비밀번호" value={newB2gPassword} onChange={e => setNewB2gPassword(e.target.value)} style={{ padding: 6, flex: 1 }} />
        <Input placeholder="PFX/PKCS#12 base64" value={newB2gCertData} onChange={e => setNewB2gCertData(e.target.value)} style={{ padding: 6, flex: 2 }} />
        <Button onClick={registerB2gCredential} disabled={busy || !newB2gPassword || !newB2gCertData.trim()} style={{ padding: "6px 12px", background: "var(--ar-accent)", color: "var(--ar-canvas)", border: "none", borderRadius: "var(--ar-r1)", cursor: "pointer", fontWeight: "bold" }}>
          인증서 등록
        </Button>
      </div>

      {b2gCredentials.length === 0 ? (
        <div style={{ color: "var(--ar-slate)", fontSize: "0.85em" }}>등록된 공공기관 인증서가 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {b2gCredentials.map((cred: any) => (
            <div key={cred.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--ar-canvas)", padding: 12, borderRadius: "var(--ar-r1)", border: "1px solid var(--ar-accent-soft)" }}>
              <div>
                <div style={{ fontWeight: "bold", color: "var(--ar-accent)" }}>{cred.agencyType}</div>
                <div style={{ fontSize: "0.8em", color: "var(--ar-graphite)" }}>
                  등록일: {new Date(cred.createdAt).toLocaleString()} | 상태: <span style={{ color: "var(--ar-success)", fontWeight: "bold" }}>{cred.status.toUpperCase()}</span>
                </div>
              </div>
              <div style={{ fontSize: "0.85em", color: "var(--ar-graphite)", background: "var(--ar-paper-alt)", padding: "4px 8px", borderRadius: "var(--ar-r1)" }}>
                ID: {cred.id}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
