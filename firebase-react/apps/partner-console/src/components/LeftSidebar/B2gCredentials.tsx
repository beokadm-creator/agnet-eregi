import React, { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

export default function B2gCredentials() {
  const { b2gCredentials, loadCases, busy, setBusy, setLog } = useAppContext();
  const [newB2gAgency, setNewB2gAgency] = useState("IROS");
  const [newB2gPassword, setNewB2gPassword] = useState("");

  async function registerB2gCredential() {
    if (!newB2gPassword) return;
    setBusy(true);
    setLog(`공동인증서 연동 준비 중 (${newB2gAgency})...`);
    try {
      const res = await getApi().post("/v1/partners/credentials", {
        agencyCode: newB2gAgency,
        certPassword: newB2gPassword,
        certData: "dummy_pfx_data_for_demo"
      });
      setLog(`인증서 연동 완료: ${res.credential.id}`);
      setNewB2gPassword("");
      await loadCases();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderTop: "2px solid #eee", paddingTop: 16, marginTop: 16 }}>
      <h3 style={{ margin: "0 0 12px 0", color: "#1565c0", fontSize: "1.1em" }}>🏛️ 공공기관 연동 인증서 관리 (EP-13)</h3>
      <div style={{ marginBottom: 12, fontSize: "0.9em", color: "#666" }}>
        대법원(IROS), 정부24 등 전자신청 시 사용할 공동인증서를 등록합니다.<br/>
        인증서는 GCP Secret Manager에 암호화되어 안전하게 보관됩니다.
      </div>
      <div style={{ display: "flex", gap: 8, background: "#e3f2fd", padding: 12, borderRadius: 6, alignItems: "center", marginBottom: 16 }}>
        <select value={newB2gAgency} onChange={e => setNewB2gAgency(e.target.value)} style={{ padding: 6, flex: 1 }}>
          <option value="IROS">인터넷등기소 (IROS)</option>
          <option value="HOMETAX">국세청 홈택스 (HOMETAX)</option>
          <option value="GOV24">정부24 (GOV24)</option>
        </select>
        <Input type="password" placeholder="인증서 비밀번호" value={newB2gPassword} onChange={e => setNewB2gPassword(e.target.value)} style={{ padding: 6, flex: 1 }} />
        <Button onClick={registerB2gCredential} disabled={busy || !newB2gPassword} style={{ padding: "6px 12px", background: "#1565c0", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
          인증서 등록
        </Button>
      </div>

      {b2gCredentials.length === 0 ? (
        <div style={{ color: "#999", fontSize: "0.85em" }}>등록된 공공기관 인증서가 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {b2gCredentials.map((cred: any) => (
            <div key={cred.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: 12, borderRadius: 6, border: "1px solid #90caf9" }}>
              <div>
                <div style={{ fontWeight: "bold", color: "#0d47a1" }}>{cred.agencyType}</div>
                <div style={{ fontSize: "0.8em", color: "#666" }}>
                  등록일: {new Date(cred.createdAt).toLocaleString()} | 상태: <span style={{ color: "#2e7d32", fontWeight: "bold" }}>{cred.status.toUpperCase()}</span>
                </div>
              </div>
              <div style={{ fontSize: "0.85em", color: "#555", background: "#f5f5f5", padding: "4px 8px", borderRadius: 4 }}>
                ID: {cred.id}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
