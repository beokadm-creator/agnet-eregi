import React, { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
import { getAuth } from "firebase/auth";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

export default function DeveloperSettings() {
  const { setLog, busy, setBusy } = useAppContext();
  const [apiKey, setApiKey] = useState("");

  const auth = getAuth();
  const user = auth.currentUser;

  async function handleGenerateApiKey() {
    if (!user) {
      setLog("[Developer] 로그인된 사용자 정보가 없습니다.");
      return;
    }

    setBusy(true);
    setLog("[Developer] API 키 생성 요청 중...");

    try {
      const res = await getApi().post("/v1/partner/api-keys", {});
      
      if (res.apiKey) {
        setApiKey(res.apiKey);
        setLog("[Developer] API 키가 성공적으로 생성되었습니다.");
      } else {
        setLog(`[Developer] API 키 생성 응답 오류: ${JSON.stringify(res)}`);
      }
    } catch (error: any) {
      setLog(`[Developer] API 키 생성 실패: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  function copyToClipboard() {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setLog("[Developer] API 키가 클립보드에 복사되었습니다.");
    }
  }

  return (
    <div style={{ marginTop: 24, padding: 16, border: "1px solid #ccc", borderRadius: 8, background: "#fafafa" }}>
      <h3 style={{ margin: "0 0 12px" }}>개발자 설정 (API 연동)</h3>
      <p style={{ fontSize: "0.9em", color: "#555", marginBottom: 12 }}>
        B2B/B2G 파트너 시스템 연동을 위한 API 키를 발급받을 수 있습니다. 발급된 키는 안전하게 보관하세요.
      </p>

      {!apiKey ? (
        <Button variant="primary" onClick={handleGenerateApiKey} disabled={busy}>
          새 API 키 생성
        </Button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ color: "#2e7d32", fontWeight: "bold" }}>✅ API 키가 발급되었습니다.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Input 
              value={apiKey} 
              readOnly 
              style={{ flex: 1, fontFamily: "monospace" }} 
            />
            <Button variant="secondary" onClick={copyToClipboard}>
              복사
            </Button>
          </div>
          <span style={{ color: "#c62828", fontSize: "0.85em" }}>
            ⚠️ 이 창을 닫으면 API 키를 다시 확인할 수 없습니다. 즉시 복사하여 안전한 곳에 저장하세요.
          </span>
          <Button variant="secondary" size="sm" onClick={() => setApiKey("")} style={{ alignSelf: "flex-start", marginTop: 8 }}>
            완료 (숨기기)
          </Button>
        </div>
      )}
    </div>
  );
}
