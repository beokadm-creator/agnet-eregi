import { useState } from "react";
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
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--pc-text)" }}>🏛️ 공공기관 연동 인증서 관리</h3>
        <p style={{ fontSize: 14, color: "var(--pc-text-muted)", margin: 0, lineHeight: 1.6 }}>
          대법원(IROS), 정부24 등 전자신청 시 사용할 공동인증서를 등록합니다.<br/>
          인증서는 GCP Secret Manager에 암호화되어 안전하게 보관됩니다.
        </p>
      </div>
      
      <div style={{ display: "flex", gap: 12, background: "var(--pc-surface)", padding: 24, borderRadius: "var(--pc-radius)", alignItems: "center", border: "1px solid var(--pc-border)" }}>
        <select value={newB2gAgency} onChange={e => setNewB2gAgency(e.target.value)} className="pc-input" style={{ flex: 1 }}>
          <option value="IROS">인터넷등기소 (IROS)</option>
          <option value="HOMETAX">국세청 홈택스 (HOMETAX)</option>
          <option value="GOV24">정부24 (GOV24)</option>
        </select>
        <input type="password" placeholder="인증서 비밀번호" value={newB2gPassword} onChange={e => setNewB2gPassword(e.target.value)} className="pc-input" style={{ flex: 1 }} />
        <input placeholder="PFX/PKCS#12 base64" value={newB2gCertData} onChange={e => setNewB2gCertData(e.target.value)} className="pc-input" style={{ flex: 2 }} />
        <button onClick={registerB2gCredential} disabled={busy || !newB2gPassword || !newB2gCertData.trim()} className="pc-btn pc-btn-brand" style={{ whiteSpace: "nowrap" }}>
          인증서 등록
        </button>
      </div>

      <div>
        <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--pc-text)" }}>등록된 인증서 목록</h4>
        {b2gCredentials.length === 0 ? (
          <div style={{ color: "var(--pc-text-muted)", fontSize: 14, background: "var(--pc-bg)", padding: 24, borderRadius: "var(--pc-radius)", textAlign: "center", border: "1px dashed var(--pc-border)" }}>
            등록된 공공기관 인증서가 없습니다.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {b2gCredentials?.map((cred: any) => (
              <div key={cred.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--pc-surface)", padding: 16, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--pc-text)", marginBottom: 4 }}>{cred.agencyType}</div>
                  <div style={{ fontSize: 13, color: "var(--pc-text-muted)" }}>
                    등록일: {new Date(cred.createdAt).toLocaleString()} | 상태: <span style={{ color: "var(--pc-success)", fontWeight: 700 }}>{cred.status.toUpperCase()}</span>
                  </div>
                </div>
                <div className="pc-mono" style={{ fontSize: 12, color: "var(--pc-text-muted)", background: "var(--pc-bg)", padding: "4px 8px", borderRadius: 4 }}>
                  ID: {cred.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
