import React, { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
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
    <div style={{ borderTop: "2px solid #eee", paddingTop: 16 }}>
      <h3 style={{ margin: "0 0 12px 0", color: "#00695c", fontSize: "1.1em" }}>알림 설정 (Webhooks)</h3>
      <div style={{ marginBottom: 12, fontSize: "0.9em" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Input type="checkbox" checked={notificationSettings.events?.packageReady} onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, packageReady: e.target.checked } })} />
          Package Ready
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Input type="checkbox" checked={notificationSettings.events?.closingReportReady} onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, closingReportReady: e.target.checked } })} />
          Closing Report Ready
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Input type="checkbox" checked={notificationSettings.events?.caseCompleted} onChange={e => updateNotificationSettings({ ...notificationSettings, events: { ...notificationSettings.events, caseCompleted: e.target.checked } })} />
          Case Completed
        </label>
      </div>
      
      <div style={{ marginBottom: 12 }}>
        <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em" }}>웹훅 목록</h4>
        {notificationSettings.channels?.webhook?.map((w: any, idx: number) => (
          <div key={idx} style={{ background: "#f5f5f5", padding: 8, borderRadius: 4, marginBottom: 8, fontSize: "0.85em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div><strong>URL:</strong> {w.url}</div>
              {w.secret && <div><strong>Secret:</strong> ***</div>}
            </div>
            <Button onClick={() => {
              const currentChannels = notificationSettings.channels || {};
              const newWebhooks = [...(currentChannels.webhook || [])];
              newWebhooks.splice(idx, 1);
              updateNotificationSettings({ ...notificationSettings, channels: { ...currentChannels, webhook: newWebhooks } });
            }} style={{ background: "#d32f2f", color: "white", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}>삭제</Button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Input placeholder="https://my-server.com/webhook" value={newWebhookUrl} onChange={e => setNewWebhookUrl(e.target.value)} style={{ padding: 6, fontSize: "0.85em" }} />
        <Input placeholder="Secret (optional)" value={newWebhookSecret} onChange={e => setNewWebhookSecret(e.target.value)} style={{ padding: 6, fontSize: "0.85em" }} />
        <Button onClick={addWebhook} disabled={busy || !newWebhookUrl} style={{ padding: "6px 12px", background: "#0277bd", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.9em" }}>웹훅 추가</Button>
      </div>
      
      <div style={{ marginTop: 20, marginBottom: 12 }}>
        <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em", color: "#e91e63" }}>Slack 웹훅 목록</h4>
        {notificationSettings.channels?.slack?.map((s: any, idx: number) => (
          <div key={idx} style={{ background: "#fce4ec", padding: 8, borderRadius: 4, marginBottom: 8, fontSize: "0.85em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div><strong>URL:</strong> {s.url}</div>
            </div>
            <Button onClick={() => {
              const currentChannels = notificationSettings.channels || {};
              const newSlack = [...(currentChannels.slack || [])];
              newSlack.splice(idx, 1);
              updateNotificationSettings({ ...notificationSettings, channels: { ...currentChannels, slack: newSlack } });
            }} style={{ background: "#d32f2f", color: "white", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}>삭제</Button>
          </div>
        ))}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <Input placeholder="https://hooks.slack.com/services/..." value={newSlackWebhookUrl} onChange={e => setNewSlackWebhookUrl(e.target.value)} style={{ padding: 6, fontSize: "0.85em" }} />
          <Button onClick={addSlackWebhook} disabled={busy || !newSlackWebhookUrl} style={{ padding: "6px 12px", background: "#e91e63", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.9em" }}>Slack 웹훅 추가</Button>
        </div>
      </div>
    </div>
  );
}
