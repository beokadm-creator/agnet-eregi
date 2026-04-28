import { useEffect, useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
import { getAuth } from "firebase/auth";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";
import WebhookSettings from "./WebhookSettings";

type ApiKeyItem = {
  id: string;
  prefix?: string;
  status?: string;
  createdAt?: any;
  revokedAt?: any;
  lastUsedAt?: any;
};

export default function DeveloperSettings() {
  const { setLog, busy, setBusy } = useAppContext();
  const [apiKey, setApiKey] = useState("");
  const [items, setItems] = useState<ApiKeyItem[]>([]);

  const auth = getAuth();
  const user = auth.currentUser;

  async function refreshKeys() {
    try {
      const res = await getApi().get("/v1/partner/api-keys");
      setItems(res.items || []);
    } catch (error: any) {
      setLog(`[Developer] API 키 목록 조회 실패: ${error.message}`);
    }
  }

  useEffect(() => {
    if (user) {
      refreshKeys();
    }
  }, [user]);

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
        await refreshKeys();
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

  async function handleRevoke(keyId: string) {
    setBusy(true);
    setLog("[Developer] API 키 회수 요청 중...");
    try {
      await getApi().post(`/v1/partner/api-keys/${keyId}/revoke`, {});
      setLog("[Developer] API 키가 회수되었습니다.");
      await refreshKeys();
    } catch (error: any) {
      setLog(`[Developer] API 키 회수 실패: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRotate() {
    setBusy(true);
    setLog("[Developer] API 키 회전 요청 중...");
    try {
      const res = await getApi().post("/v1/partner/api-keys/rotate", { revokeAll: true });
      if (res.apiKey) {
        setApiKey(res.apiKey);
      }
      setLog("[Developer] 새 API 키가 발급되었습니다. (기존 키는 회수됨)");
      await refreshKeys();
    } catch (error: any) {
      setLog(`[Developer] API 키 회전 실패: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ marginTop: 24, padding: 16, border: "1px solid #ccc", borderRadius: 8, background: "#fafafa" }}>
        <h3 style={{ margin: "0 0 12px" }}>개발자 설정 (API 연동)</h3>
      <p style={{ fontSize: "0.9em", color: "#555", marginBottom: 12 }}>
        B2B/B2G 파트너 시스템 연동을 위한 API 키를 발급받을 수 있습니다. 발급된 키는 안전하게 보관하세요.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Button variant="primary" onClick={handleGenerateApiKey} disabled={busy}>
          새 API 키 생성
        </Button>
        <Button variant="secondary" onClick={handleRotate} disabled={busy}>
          API 키 회전(전체 회수)
        </Button>
      </div>

      {apiKey && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <span style={{ color: "#2e7d32", fontWeight: "bold" }}>✅ 새 API 키가 발급되었습니다.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Input value={apiKey} readOnly style={{ flex: 1, fontFamily: "monospace" }} />
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

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontWeight: "bold" }}>발급된 키 목록</div>
        {items.length === 0 ? (
          <div style={{ color: "#666", fontSize: "0.9em" }}>발급된 키가 없습니다.</div>
        ) : (
          items.map((k) => (
            <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 8, border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: "monospace" }}>{k.prefix ? `ar_${k.prefix}.********` : k.id}</span>
                <span style={{ fontSize: "0.85em", color: "#666" }}>{k.status || "unknown"}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="danger" size="sm" onClick={() => handleRevoke(k.id)} disabled={busy || k.status !== "active"}>
                  회수
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
      </div>
      
      <WebhookSettings />
    </>
  );
}
