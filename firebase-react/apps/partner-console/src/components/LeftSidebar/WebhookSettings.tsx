import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

type WebhookItem = {
  id: string;
  url: string;
  events: string[];
  status: string;
  secret?: string;
  createdAt?: any;
  updatedAt?: any;
};

export default function WebhookSettings() {
  const { setLog, busy, setBusy } = useAppContext();
  const [items, setItems] = useState<WebhookItem[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newSecret, setNewSecret] = useState("");

  const auth = getAuth();
  const user = auth.currentUser;

  async function refreshWebhooks() {
    try {
      const res = await getApi().get("/v1/partner/webhooks");
      setItems(res.items || []);
    } catch (error: any) {
      setLog(`[Webhook] 웹훅 목록 조회 실패: ${error.message}`);
    }
  }

  useEffect(() => {
    if (user) {
      refreshWebhooks();
    }
  }, [user]);

  async function handleCreateWebhook() {
    if (!user) {
      setLog("[Webhook] 로그인된 사용자 정보가 없습니다.");
      return;
    }
    if (!newUrl.startsWith("http")) {
      setLog("[Webhook] 유효한 웹훅 URL을 입력하세요 (http/https).");
      return;
    }

    setBusy(true);
    setLog("[Webhook] 웹훅 등록 요청 중...");

    try {
      const res = await getApi().post("/v1/partner/webhooks", {
        url: newUrl,
        events: ["*"],
      });
      
      if (res.secret) {
        setNewSecret(res.secret);
        setLog("[Webhook] 웹훅이 성공적으로 등록되었습니다.");
        setNewUrl("");
        await refreshWebhooks();
      } else {
        setLog(`[Webhook] 웹훅 등록 응답 오류: ${JSON.stringify(res)}`);
      }
    } catch (error: any) {
      setLog(`[Webhook] 웹훅 등록 실패: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  function copyToClipboard() {
    if (newSecret) {
      navigator.clipboard.writeText(newSecret);
      setLog("[Webhook] 웹훅 시크릿이 클립보드에 복사되었습니다.");
    }
  }

  async function handleDelete(webhookId: string) {
    if (!window.confirm("정말로 이 웹훅을 삭제하시겠습니까?")) return;

    setBusy(true);
    setLog("[Webhook] 웹훅 삭제 요청 중...");
    try {
      await getApi().delete(`/v1/partner/webhooks/${webhookId}`);
      setLog("[Webhook] 웹훅이 삭제되었습니다.");
      await refreshWebhooks();
    } catch (error: any) {
      setLog(`[Webhook] 웹훅 삭제 실패: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleStatus(webhook: WebhookItem) {
    setBusy(true);
    const newStatus = webhook.status === "active" ? "inactive" : "active";
    setLog(`[Webhook] 웹훅 상태 변경 요청 중... (${newStatus})`);
    try {
      await getApi().put(`/v1/partner/webhooks/${webhook.id}`, {
        url: webhook.url,
        events: webhook.events,
        status: newStatus
      });
      setLog(`[Webhook] 웹훅 상태가 ${newStatus}로 변경되었습니다.`);
      await refreshWebhooks();
    } catch (error: any) {
      setLog(`[Webhook] 웹훅 상태 변경 실패: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "var(--pc-text)" }}>웹훅 설정 (이벤트 구독)</h3>
      <p style={{ fontSize: 14, color: "var(--pc-text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
        시스템 이벤트(예: 케이스 할당, 상태 변경 등)를 외부 서버에서 수신할 수 있도록 웹훅을 등록하세요.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <input 
          value={newUrl} 
          onChange={(e: any) => setNewUrl(e.target.value)} 
          placeholder="https://your-domain.com/webhook" 
          className="pc-input"
          style={{ flex: 1, minWidth: "250px" }}
        />
        <button onClick={handleCreateWebhook} disabled={busy || !newUrl} className="pc-btn pc-btn-brand">
          새 웹훅 등록
        </button>
      </div>

      {newSecret && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24, background: "var(--pc-success-soft)", padding: 20, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-success)" }}>
          <span style={{ color: "var(--pc-success)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>✅ 새 웹훅이 등록되었습니다.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newSecret} readOnly className="pc-input pc-mono" style={{ flex: 1 }} />
            <button onClick={copyToClipboard} className="pc-btn">
              복사
            </button>
          </div>
          <span style={{ color: "var(--pc-danger)", fontSize: 13 }}>
            ⚠️ 이 창을 닫으면 웹훅 서명 검증을 위한 시크릿 키를 다시 확인할 수 없습니다. 즉시 복사하여 안전한 곳에 저장하세요.
          </span>
          <button onClick={() => setNewSecret("")} className="pc-btn" style={{ alignSelf: "flex-start", marginTop: 8 }}>
            완료 (숨기기)
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--pc-text)" }}>등록된 웹훅 목록</div>
        {items.length === 0 ? (
          <div style={{ color: "var(--pc-text-muted)", fontSize: 14, background: "var(--pc-surface)", padding: 24, borderRadius: "var(--pc-radius)", textAlign: "center", border: "1px solid var(--pc-border)" }}>
            등록된 웹훅이 없습니다.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items?.map((k) => (
              <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: 16, border: "1px solid var(--pc-border)", borderRadius: "var(--pc-radius)", background: "var(--pc-surface)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, overflow: "hidden" }}>
                  <span className="pc-mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--pc-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {k.url}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--pc-text-muted)" }}>
                    상태: {k.status} | 이벤트: {k.events?.join(", ") || "*"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button 
                    onClick={() => handleToggleStatus(k)} 
                    disabled={busy}
                    className="pc-btn"
                  >
                    {k.status === "active" ? "비활성화" : "활성화"}
                  </button>
                  <button onClick={() => handleDelete(k.id)} disabled={busy} className="pc-btn pc-btn-danger">
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
