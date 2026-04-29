import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

// --- Types ---

interface TelegramSettings {
  enabled: boolean;
  botToken: string;
  chatId: string;
  webhookToken: string;
  updatedAt?: string | { _seconds: number; _nanoseconds: number };
}

interface TossPaymentsSettings {
  enabled: boolean;
  clientKey: string;
  secretKey: string;
  updatedAt?: string | { _seconds: number; _nanoseconds: number };
}

interface AlertPolicyRules {
  circuitBreakerOpen: boolean;
  deadJobs: boolean;
  failRateThreshold: number;
  deniedThreshold: number;
}

interface AlertPolicy {
  enabled: boolean;
  cooldownSec: number;
  rules: AlertPolicyRules;
  channels: { useGateWebhook: boolean };
}

// --- Helpers ---

function formatTimestamp(ts: unknown): string {
  if (!ts) return "-";
  if (typeof ts === "string") return new Date(ts).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (typeof ts === "object" && ts !== null && "_seconds" in ts) return new Date((ts as { _seconds: number })._seconds * 1000).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  return "-";
}

const EMPTY_TELEGRAM: TelegramSettings = { enabled: false, botToken: "", chatId: "", webhookToken: "" };
const EMPTY_TOSS: TossPaymentsSettings = { enabled: false, clientKey: "", secretKey: "" };
const EMPTY_POLICY: AlertPolicy = {
  enabled: false,
  cooldownSec: 300,
  rules: { circuitBreakerOpen: true, deadJobs: true, failRateThreshold: 0.3, deniedThreshold: 0.1 },
  channels: { useGateWebhook: false },
};

// --- Password Field Component ---

function PasswordField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        className="ar-input ar-input-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ paddingRight: 60 }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--ar-slate)" }}
      >
        {show ? "숨기기" : "보기"}
      </button>
    </div>
  );
}

// --- Component ---

export default function Settings() {
  const { token } = useAuth();

  // Telegram state
  const [telegram, setTelegram] = useState<TelegramSettings>(EMPTY_TELEGRAM);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramMsg, setTelegramMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showBotToken, setShowBotToken] = useState(false);
  const [showWebhookToken, setShowWebhookToken] = useState(false);

  // TossPayments state
  const [toss, setToss] = useState<TossPaymentsSettings>(EMPTY_TOSS);
  const [tossLoading, setTossLoading] = useState(true);
  const [tossSaving, setTossSaving] = useState(false);
  const [tossMsg, setTossMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);

  // Gate alert state
  const [gates, setGates] = useState<string[]>([]);
  const [selectedGate, setSelectedGate] = useState("");
  const [policy, setPolicy] = useState<AlertPolicy>(EMPTY_POLICY);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyMsg, setPolicyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [gatesLoading, setGatesLoading] = useState(true);

  // --- Load data on mount ---

  useEffect(() => {
    const baseUrl = getApiBaseUrl();
    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      fetch(`${baseUrl}/v1/ops/settings/telegram`, { headers }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch(`${baseUrl}/v1/ops/settings/tosspayments`, { headers }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch(`${baseUrl}/v1/ops/health/summary?limit=50`, { headers }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
    ]).then(([tgResult, tossResult, gatesResult]) => {
      if (tgResult.status === "fulfilled" && tgResult.value.data?.settings) {
        setTelegram(tgResult.value.data.settings);
      }
      if (tossResult.status === "fulfilled" && tossResult.value.data?.settings) {
        setToss(tossResult.value.data.settings);
      }
      if (gatesResult.status === "fulfilled" && gatesResult.value.data?.items) {
        const gateKeys = gatesResult.value.data.items.map((item: { gateKey: string }) => item.gateKey).filter(Boolean);
        setGates(gateKeys);
      }
    }).finally(() => {
      setTelegramLoading(false);
      setTossLoading(false);
      setGatesLoading(false);
    });
  }, [token]);

  // --- Load alert policy when gate is selected ---

  const loadPolicy = useCallback(async (gateKey: string) => {
    if (!gateKey) return;
    setPolicyLoading(true);
    setPolicyMsg(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/gates/${encodeURIComponent(gateKey)}/alert-policy`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.policy) {
          setPolicy(json.data.policy);
        }
      } else {
        setPolicy(EMPTY_POLICY);
      }
    } catch {
      setPolicy(EMPTY_POLICY);
    } finally {
      setPolicyLoading(false);
    }
  }, [token]);

  const handleGateSelect = (gateKey: string) => {
    setSelectedGate(gateKey);
    setPolicy(EMPTY_POLICY);
    setPolicyMsg(null);
    if (gateKey) loadPolicy(gateKey);
  };

  // --- Save Telegram ---

  const saveTelegram = async () => {
    setTelegramSaving(true);
    setTelegramMsg(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/settings/telegram`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: telegram.enabled, botToken: telegram.botToken, chatId: telegram.chatId, webhookToken: telegram.webhookToken }),
      });
      const json = await res.json();
      if (json.ok) {
        setTelegramMsg({ ok: true, text: "저장되었습니다." });
        if (json.data?.settings?.updatedAt) {
          setTelegram((prev) => ({ ...prev, updatedAt: json.data.settings.updatedAt }));
        }
      } else {
        setTelegramMsg({ ok: false, text: json.error?.messageKo || json.error?.message || "저장 실패" });
      }
    } catch {
      setTelegramMsg({ ok: false, text: "요청 실패" });
    } finally {
      setTelegramSaving(false);
    }
  };

  // --- Save TossPayments ---

  const saveToss = async () => {
    setTossSaving(true);
    setTossMsg(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/settings/tosspayments`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: toss.enabled, clientKey: toss.clientKey, secretKey: toss.secretKey }),
      });
      const json = await res.json();
      if (json.ok) {
        setTossMsg({ ok: true, text: "저장되었습니다." });
        if (json.data?.settings?.updatedAt) {
          setToss((prev) => ({ ...prev, updatedAt: json.data.settings.updatedAt }));
        }
      } else {
        setTossMsg({ ok: false, text: json.error?.messageKo || json.error?.message || "저장 실패" });
      }
    } catch {
      setTossMsg({ ok: false, text: "요청 실패" });
    } finally {
      setTossSaving(false);
    }
  };

  // --- Save Alert Policy ---

  const savePolicy = async () => {
    if (!selectedGate) return;
    setPolicySaving(true);
    setPolicyMsg(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/ops/gates/${encodeURIComponent(selectedGate)}/alert-policy`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const json = await res.json();
      if (json.ok) {
        setPolicyMsg({ ok: true, text: "저장되었습니다." });
      } else {
        setPolicyMsg({ ok: false, text: json.error?.messageKo || json.error?.message || "저장 실패" });
      }
    } catch {
      setPolicyMsg({ ok: false, text: "요청 실패" });
    } finally {
      setPolicySaving(false);
    }
  };

  // --- Render ---

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
          통합 설정
        </h1>
        <div className="ar-eyebrow" style={{ marginTop: 6, marginBottom: 0 }}>
          알림 채널, 결제 연동, Gate 알림 정책
        </div>
      </div>

      {/* Section 1 — Telegram */}
      <div className="ar-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>📱</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Telegram 알림</span>
        </div>

        {telegramLoading ? (
          <div style={{ fontSize: 13, color: "var(--ar-slate)", padding: "8px 0" }}>불러오는 중...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
              <input type="checkbox" checked={telegram.enabled} onChange={(e) => setTelegram((p) => ({ ...p, enabled: e.target.checked }))} style={{ accentColor: "var(--ar-accent)" }} />
              활성화
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="ar-label">Bot Token</span>
              <div style={{ position: "relative" }}>
                <input
                  type={showBotToken ? "text" : "password"}
                  className="ar-input ar-input-sm"
                  value={telegram.botToken}
                  onChange={(e) => setTelegram((p) => ({ ...p, botToken: e.target.value }))}
                  placeholder="Bot Token"
                  style={{ paddingRight: 60 }}
                />
                <button
                  type="button"
                  onClick={() => setShowBotToken(!showBotToken)}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--ar-slate)" }}
                >
                  {showBotToken ? "숨기기" : "보기"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="ar-label">Chat ID</span>
              <input
                type="text"
                className="ar-input ar-input-sm"
                value={telegram.chatId}
                onChange={(e) => setTelegram((p) => ({ ...p, chatId: e.target.value }))}
                placeholder="Chat ID"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="ar-label">Webhook Token</span>
              <div style={{ position: "relative" }}>
                <input
                  type={showWebhookToken ? "text" : "password"}
                  className="ar-input ar-input-sm"
                  value={telegram.webhookToken}
                  onChange={(e) => setTelegram((p) => ({ ...p, webhookToken: e.target.value }))}
                  placeholder="Webhook Token"
                  style={{ paddingRight: 60 }}
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookToken(!showWebhookToken)}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--ar-slate)" }}
                >
                  {showWebhookToken ? "숨기기" : "보기"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <button className="ar-btn ar-btn-sm ar-btn-ink" onClick={saveTelegram} disabled={telegramSaving}>
                {telegramSaving ? "저장 중..." : "저장"}
              </button>
            </div>

            {telegramMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--ar-r1)",
                  background: telegramMsg.ok ? "var(--ar-success-soft)" : "var(--ar-danger-soft)",
                  color: telegramMsg.ok ? "var(--ar-success)" : "var(--ar-danger)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {telegramMsg.ok ? "✅" : "❌"} {telegramMsg.text}
              </div>
            )}

            {telegram.updatedAt && (
              <div style={{ fontSize: 12, color: "var(--ar-slate)" }}>
                마지막 업데이트: {formatTimestamp(telegram.updatedAt)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 2 — TossPayments */}
      <div className="ar-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>💳</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>TossPayments 결제</span>
        </div>

        {tossLoading ? (
          <div style={{ fontSize: 13, color: "var(--ar-slate)", padding: "8px 0" }}>불러오는 중...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
              <input type="checkbox" checked={toss.enabled} onChange={(e) => setToss((p) => ({ ...p, enabled: e.target.checked }))} style={{ accentColor: "var(--ar-accent)" }} />
              활성화
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="ar-label">Client Key</span>
              <input
                type="text"
                className="ar-input ar-input-sm"
                value={toss.clientKey}
                onChange={(e) => setToss((p) => ({ ...p, clientKey: e.target.value }))}
                placeholder="Client Key"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="ar-label">Secret Key</span>
              <div style={{ position: "relative" }}>
                <input
                  type={showSecretKey ? "text" : "password"}
                  className="ar-input ar-input-sm"
                  value={toss.secretKey}
                  onChange={(e) => setToss((p) => ({ ...p, secretKey: e.target.value }))}
                  placeholder="Secret Key"
                  style={{ paddingRight: 60 }}
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--ar-slate)" }}
                >
                  {showSecretKey ? "숨기기" : "보기"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <button className="ar-btn ar-btn-sm ar-btn-ink" onClick={saveToss} disabled={tossSaving}>
                {tossSaving ? "저장 중..." : "저장"}
              </button>
            </div>

            {tossMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--ar-r1)",
                  background: tossMsg.ok ? "var(--ar-success-soft)" : "var(--ar-danger-soft)",
                  color: tossMsg.ok ? "var(--ar-success)" : "var(--ar-danger)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {tossMsg.ok ? "✅" : "❌"} {tossMsg.text}
              </div>
            )}

            {toss.updatedAt && (
              <div style={{ fontSize: 12, color: "var(--ar-slate)" }}>
                마지막 업데이트: {formatTimestamp(toss.updatedAt)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 3 — Gate Alert Policies */}
      <div className="ar-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ar-hairline)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>🔔</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Gate 알림 정책</span>
        </div>

        <div style={{ padding: 20 }}>
          {gatesLoading ? (
            <div style={{ fontSize: 13, color: "var(--ar-slate)" }}>Gate 목록을 불러오는 중...</div>
          ) : gates.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--ar-slate)" }}>Gate 데이터를 불러올 수 없습니다.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="ar-label">Gate 선택</span>
                <select
                  className="ar-input ar-input-sm"
                  value={selectedGate}
                  onChange={(e) => handleGateSelect(e.target.value)}
                >
                  <option value="">— Gate를 선택하세요 —</option>
                  {gates.map((gk) => (
                    <option key={gk} value={gk}>{gk}</option>
                  ))}
                </select>
              </div>

              {selectedGate && policyLoading && (
                <div style={{ fontSize: 13, color: "var(--ar-slate)" }}>정책을 불러오는 중...</div>
              )}

              {selectedGate && !policyLoading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                    <input type="checkbox" checked={policy.enabled} onChange={(e) => setPolicy((p) => ({ ...p, enabled: e.target.checked }))} style={{ accentColor: "var(--ar-accent)" }} />
                    알림 활성화
                  </label>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="ar-label">쿨다운 (초)</span>
                    <input
                      type="number"
                      className="ar-input ar-input-sm"
                      value={policy.cooldownSec}
                      onChange={(e) => setPolicy((p) => ({ ...p, cooldownSec: Number(e.target.value) || 0 }))}
                      min={0}
                    />
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ar-graphite)", marginTop: 4 }}>룰 설정</div>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                    <input type="checkbox" checked={policy.rules.circuitBreakerOpen} onChange={(e) => setPolicy((p) => ({ ...p, rules: { ...p.rules, circuitBreakerOpen: e.target.checked } }))} style={{ accentColor: "var(--ar-accent)" }} />
                    서킷 브레이커 알림
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                    <input type="checkbox" checked={policy.rules.deadJobs} onChange={(e) => setPolicy((p) => ({ ...p, rules: { ...p.rules, deadJobs: e.target.checked } }))} style={{ accentColor: "var(--ar-accent)" }} />
                    데드 잡 알림
                  </label>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="ar-label">실패율 임계값</span>
                    <input
                      type="number"
                      className="ar-input ar-input-sm"
                      value={policy.rules.failRateThreshold}
                      onChange={(e) => setPolicy((p) => ({ ...p, rules: { ...p.rules, failRateThreshold: Number(e.target.value) || 0 } }))}
                      min={0}
                      max={1}
                      step={0.01}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="ar-label">거부율 임계값</span>
                    <input
                      type="number"
                      className="ar-input ar-input-sm"
                      value={policy.rules.deniedThreshold}
                      onChange={(e) => setPolicy((p) => ({ ...p, rules: { ...p.rules, deniedThreshold: Number(e.target.value) || 0 } }))}
                      min={0}
                      max={1}
                      step={0.01}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                    <button className="ar-btn ar-btn-sm ar-btn-ink" onClick={savePolicy} disabled={policySaving}>
                      {policySaving ? "저장 중..." : "저장"}
                    </button>
                  </div>

                  {policyMsg && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "var(--ar-r1)",
                        background: policyMsg.ok ? "var(--ar-success-soft)" : "var(--ar-danger-soft)",
                        color: policyMsg.ok ? "var(--ar-success)" : "var(--ar-danger)",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {policyMsg.ok ? "✅" : "❌"} {policyMsg.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
