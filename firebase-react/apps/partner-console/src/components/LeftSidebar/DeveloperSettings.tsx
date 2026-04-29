import { useEffect, useState } from "react";
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
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "var(--pc-text)" }}>개발자 설정 (API 연동)</h3>
        <p style={{ fontSize: 14, color: "var(--pc-text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
          B2B/B2G 파트너 시스템 연동을 위한 API 키를 발급받을 수 있습니다. 발급된 키는 안전하게 보관하세요.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <button onClick={handleGenerateApiKey} disabled={busy} className="pc-btn pc-btn-brand">
            새 API 키 생성
          </button>
          <button onClick={handleRotate} disabled={busy} className="pc-btn">
            API 키 회전 (전체 회수)
          </button>
        </div>

        {apiKey && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24, background: "var(--pc-success-soft)", padding: 20, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-success)" }}>
            <span style={{ color: "var(--pc-success)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              ✅ 새 API 키가 발급되었습니다.
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={apiKey} readOnly className="pc-input pc-mono" style={{ flex: 1 }} />
              <button onClick={copyToClipboard} className="pc-btn">
                복사
              </button>
            </div>
            <span style={{ color: "var(--pc-danger)", fontSize: 13 }}>
              ⚠️ 이 창을 닫으면 API 키를 다시 확인할 수 없습니다. 즉시 복사하여 안전한 곳에 저장하세요.
            </span>
            <button onClick={() => setApiKey("")} className="pc-btn" style={{ alignSelf: "flex-start", marginTop: 8 }}>
              완료 (숨기기)
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--pc-text)" }}>발급된 키 목록</div>
          {items.length === 0 ? (
            <div style={{ color: "var(--pc-text-muted)", fontSize: 14, background: "var(--pc-surface)", padding: 24, borderRadius: "var(--pc-radius)", textAlign: "center", border: "1px solid var(--pc-border)" }}>
              발급된 키가 없습니다.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items?.map((k) => (
                <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: 16, border: "1px solid var(--pc-border)", borderRadius: "var(--pc-radius)", background: "var(--pc-surface)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className="pc-mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--pc-text)" }}>{k.prefix ? `ar_${k.prefix}.********` : k.id}</span>
                    <span style={{ fontSize: 12, color: "var(--pc-text-muted)" }}>{k.status || "unknown"}</span>
                  </div>
                  <button onClick={() => handleRevoke(k.id)} disabled={busy || k.status !== "active"} className="pc-btn pc-btn-danger">
                    회수
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <WebhookSettings />
    </div>
  );
}
