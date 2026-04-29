import { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

export default function NotificationSettings() {
  const { notificationSettings, setNotificationSettings, busy, setBusy, setLog } = useAppContext();
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookSecret, setNewWebhookSecret] = useState("");
  const [newSlackWebhookUrl, setNewSlackWebhookUrl] = useState("");

  if (!notificationSettings) return null;

  async function updateNotificationSettings(newSettings: any) {
    setBusy(true);
    setLog("알림 설정 업데이트 중...");
    try {
      const res = await getApi().post("/v1/partner/notification-settings", newSettings);
      setNotificationSettings(res.settings);
      setLog("알림 설정 저장 완료");
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function addWebhook() {
    if (!newWebhookUrl) return;
    const newSettings = {
      ...notificationSettings,
      channels: {
        ...notificationSettings.channels,
        webhook: [
          ...(notificationSettings.channels?.webhook || []),
          { url: newWebhookUrl, secret: newWebhookSecret, enabled: true }
        ]
      }
    };
    await updateNotificationSettings(newSettings);
    setNewWebhookUrl("");
    setNewWebhookSecret("");
  }

  async function addSlackWebhook() {
    if (!newSlackWebhookUrl) return;
    const currentChannels = notificationSettings.channels || {};
    const currentSlack = currentChannels.slack || [];
    const newSettings = {
      ...notificationSettings,
      channels: {
        ...currentChannels,
        slack: [...currentSlack, { url: newSlackWebhookUrl, enabled: true }]
      }
    };
    await updateNotificationSettings(newSettings);
    setNewSlackWebhookUrl("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "var(--pc-text)" }}>알림 설정</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--pc-surface)", padding: 24, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={notificationSettings.events?.packageReady} 
              onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, packageReady: e.target.checked } })} 
              style={{ accentColor: "var(--pc-brand)", width: 16, height: 16 }}
            />
            Package Ready
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={notificationSettings.events?.closingReportReady} 
              onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, closingReportReady: e.target.checked } })} 
              style={{ accentColor: "var(--pc-brand)", width: 16, height: 16 }}
            />
            Closing Report Ready
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={notificationSettings.events?.caseCompleted} 
              onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, caseCompleted: e.target.checked } })} 
              style={{ accentColor: "var(--pc-brand)", width: 16, height: 16 }}
            />
            Case Completed
          </label>
        </div>
      </div>
      
      <div>
        <h4 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 600, color: "var(--pc-text)" }}>웹훅 목록</h4>
        {notificationSettings.channels?.webhook?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {notificationSettings.channels?.webhook?.map((w: any, idx: number) => (
              <div key={idx} style={{ background: "var(--pc-surface)", padding: 16, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  <div><strong style={{ color: "var(--pc-text)" }}>URL:</strong> {w.url}</div>
                  {w.secret && <div><strong style={{ color: "var(--pc-text)" }}>Secret:</strong> ***</div>}
                </div>
                <button onClick={() => {
                  const currentChannels = notificationSettings.channels || {};
                  const newWebhooks = [...(currentChannels.webhook || [])];
                  newWebhooks.splice(idx, 1);
                  updateNotificationSettings({ ...notificationSettings, channels: { ...currentChannels, webhook: newWebhooks } });
                }} className="pc-btn pc-btn-danger">삭제</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--pc-text-muted)", fontSize: 13, marginBottom: 16 }}>등록된 웹훅이 없습니다.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input placeholder="https://my-server.com/webhook" value={newWebhookUrl} onChange={e => setNewWebhookUrl(e.target.value)} className="pc-input" />
          <input placeholder="Secret (optional)" value={newWebhookSecret} onChange={e => setNewWebhookSecret(e.target.value)} className="pc-input" />
          <button onClick={addWebhook} disabled={busy || !newWebhookUrl} className="pc-btn pc-btn-brand" style={{ alignSelf: "flex-start" }}>웹훅 추가</button>
        </div>
      </div>
      
      <div>
        <h4 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 600, color: "var(--pc-danger)" }}>Slack 웹훅 목록</h4>
        {notificationSettings.channels?.slack?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {notificationSettings.channels?.slack?.map((s: any, idx: number) => (
              <div key={idx} style={{ background: "var(--pc-danger-soft)", padding: 16, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-danger)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  <div><strong style={{ color: "var(--pc-text)" }}>URL:</strong> {s.url}</div>
                </div>
                <button onClick={() => {
                  const currentChannels = notificationSettings.channels || {};
                  const newSlack = [...(currentChannels.slack || [])];
                  newSlack.splice(idx, 1);
                  updateNotificationSettings({ ...notificationSettings, channels: { ...currentChannels, slack: newSlack } });
                }} className="pc-btn pc-btn-danger">삭제</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--pc-text-muted)", fontSize: 13, marginBottom: 16 }}>등록된 Slack 웹훅이 없습니다.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input placeholder="https://hooks.slack.com/services/..." value={newSlackWebhookUrl} onChange={e => setNewSlackWebhookUrl(e.target.value)} className="pc-input" />
          <button onClick={addSlackWebhook} disabled={busy || !newSlackWebhookUrl} className="pc-btn" style={{ alignSelf: "flex-start", background: "var(--pc-danger)", color: "#fff", borderColor: "var(--pc-danger)" }}>Slack 웹훅 추가</button>
        </div>
      </div>
    </div>
  );
}
