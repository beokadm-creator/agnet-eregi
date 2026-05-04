import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

// --- Types ---
interface TelegramSettings { enabled: boolean; botToken: string; chatId: string; webhookToken: string; updatedAt?: string; }
interface TossPaymentsSettings { enabled: boolean; clientKey: string; secretKey: string; updatedAt?: string; }
interface LlmSettings { enabled: boolean; provider: "glm"; model: string; endpoint: string; apiKey: string; apiKeySet?: boolean; updatedAt?: string; }
interface AlertPolicyRules { circuitBreakerOpen: boolean; deadJobs: boolean; failRateThreshold: number; deniedThreshold: number; }
interface AlertPolicy { enabled: boolean; cooldownSec: number; rules: AlertPolicyRules; channels: { useGateWebhook: boolean }; }
interface PricingBenchmarkItem {
  scenarioKey: string;
  region: string;
  minFee: number;
  avgFee: number;
  maxFee: number;
  officialCostIncluded: boolean;
  sourceLabel: string;
  sourceUrl: string;
  note?: string;
}

function formatTimestamp(ts: unknown): string {
  if (!ts) return "-";
  if (typeof ts === "string") return new Date(ts).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (typeof ts === "object" && ts !== null && "_seconds" in ts) return new Date((ts as { _seconds: number })._seconds * 1000).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  return "-";
}

const EMPTY_TELEGRAM: TelegramSettings = { enabled: false, botToken: "", chatId: "", webhookToken: "" };
const EMPTY_TOSS: TossPaymentsSettings = { enabled: false, clientKey: "", secretKey: "" };
const EMPTY_LLM: LlmSettings = { enabled: false, provider: "glm", model: "glm-5.1", endpoint: "https://api.z.ai/api/coding/paas/v4", apiKey: "", apiKeySet: false };
const EMPTY_POLICY: AlertPolicy = { enabled: false, cooldownSec: 300, rules: { circuitBreakerOpen: true, deadJobs: true, failRateThreshold: 0.3, deniedThreshold: 0.1 }, channels: { useGateWebhook: false } };
const DEFAULT_PRICING_BENCHMARKS: PricingBenchmarkItem[] = [{ scenarioKey: "corp_establishment", region: "KR", minFee: 395900, avgFee: 520000, maxFee: 650000, officialCostIncluded: true, sourceLabel: "헬프미/회사등기 공개가 기준", sourceUrl: "https://reg.help-me.kr/pricing/%EB%B2%95%EC%9D%B8%EC%84%A4%EB%A6%BD/%EC%A3%BC%EC%8B%9D%ED%9A%8C%EC%82%AC-%EC%9D%BC%EB%B0%98", note: "초기 공개 견적 기준값입니다. 자본금, 지역, 과밀억제권역 여부에 따라 달라질 수 있습니다." }];

function PasswordField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input type={show ? "text" : "password"} className="ops-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ paddingRight: 60 }} />
      <button type="button" onClick={() => setShow(!show)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--ops-text-muted)" }}>{show ? "숨기기" : "보기"}</button>
    </div>
  );
}

export default function Settings() {
  const { token } = useAuth();

  const [telegram, setTelegram] = useState<TelegramSettings>(EMPTY_TELEGRAM);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramMsg, setTelegramMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [toss, setToss] = useState<TossPaymentsSettings>(EMPTY_TOSS);
  const [tossLoading, setTossLoading] = useState(true);
  const [tossSaving, setTossSaving] = useState(false);
  const [tossMsg, setTossMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [llm, setLlm] = useState<LlmSettings>(EMPTY_LLM);
  const [llmLoading, setLlmLoading] = useState(true);
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmMsg, setLlmMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [llmTestMsg, setLlmTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pricingBenchmarks, setPricingBenchmarks] = useState<PricingBenchmarkItem[]>(DEFAULT_PRICING_BENCHMARKS);
  const [pricingText, setPricingText] = useState(JSON.stringify(DEFAULT_PRICING_BENCHMARKS, null, 2));
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingMsg, setPricingMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [gates, setGates] = useState<string[]>([]);
  const [selectedGate, setSelectedGate] = useState("");
  const [policy, setPolicy] = useState<AlertPolicy>(EMPTY_POLICY);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyMsg, setPolicyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [gatesLoading, setGatesLoading] = useState(true);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    Promise.allSettled([
      fetch(`${getApiBaseUrl()}/v1/ops/settings/telegram`, { headers }).then((r) => r.json()),
      fetch(`${getApiBaseUrl()}/v1/ops/settings/tosspayments`, { headers }).then((r) => r.json()),
      fetch(`${getApiBaseUrl()}/v1/ops/settings/llm`, { headers }).then((r) => r.json()),
      fetch(`${getApiBaseUrl()}/v1/ops/settings/pricing-benchmarks`, { headers }).then((r) => r.json()),
      fetch(`${getApiBaseUrl()}/v1/ops/health/summary?limit=50`, { headers }).then((r) => r.json()),
    ]).then(([tgRes, tossRes, llmRes, pricingRes, gatesRes]) => {
      if (tgRes.status === "fulfilled" && tgRes.value.ok) setTelegram(tgRes.value.data?.settings || EMPTY_TELEGRAM);
      if (tossRes.status === "fulfilled" && tossRes.value.ok) setToss(tossRes.value.data?.settings || EMPTY_TOSS);
      if (llmRes.status === "fulfilled" && llmRes.value.ok) {
        const s = llmRes.value.data?.settings || EMPTY_LLM;
        setLlm({ ...s, apiKey: "" });
      }
      if (pricingRes.status === "fulfilled" && pricingRes.value.ok) {
        const items = pricingRes.value.data?.settings?.items || DEFAULT_PRICING_BENCHMARKS;
        setPricingBenchmarks(items);
        setPricingText(JSON.stringify(items, null, 2));
      }
      if (gatesRes.status === "fulfilled" && gatesRes.value.ok) setGates(gatesRes.value.data?.items?.map((i: any) => i.gateKey).filter(Boolean) || []);
    }).finally(() => { setTelegramLoading(false); setTossLoading(false); setLlmLoading(false); setPricingLoading(false); setGatesLoading(false); });
  }, [token]);

  const loadPolicy = useCallback(async (gateKey: string) => {
    if (!gateKey) return;
    setPolicyLoading(true); setPolicyMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/gates/${encodeURIComponent(gateKey)}/alert-policy`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setPolicy(json.ok && json.data?.policy ? json.data.policy : EMPTY_POLICY);
    } catch { setPolicy(EMPTY_POLICY); } finally { setPolicyLoading(false); }
  }, [token]);

  const saveTelegram = async () => {
    setTelegramSaving(true); setTelegramMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/settings/telegram`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(telegram) });
      const json = await res.json();
      setTelegramMsg({ ok: json.ok, text: json.ok ? "저장되었습니다." : "저장 실패" });
    } catch { setTelegramMsg({ ok: false, text: "요청 실패" }); } finally { setTelegramSaving(false); }
  };

  const saveToss = async () => {
    setTossSaving(true); setTossMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/settings/tosspayments`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(toss) });
      const json = await res.json();
      setTossMsg({ ok: json.ok, text: json.ok ? "저장되었습니다." : "저장 실패" });
    } catch { setTossMsg({ ok: false, text: "요청 실패" }); } finally { setTossSaving(false); }
  };

  const saveLlm = async () => {
    setLlmSaving(true); setLlmMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/settings/llm`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(llm) });
      const json = await res.json();
      if (json.ok && json.data?.settings) setLlm({ ...(json.data.settings as any), apiKey: "" });
      setLlmMsg({ ok: json.ok, text: json.ok ? "저장되었습니다." : "저장 실패" });
    } catch { setLlmMsg({ ok: false, text: "요청 실패" }); } finally { setLlmSaving(false); }
  };

  const savePricingBenchmarks = async () => {
    setPricingSaving(true); setPricingMsg(null);
    try {
      const parsed = JSON.parse(pricingText);
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/settings/pricing-benchmarks`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsed }),
      });
      const json = await res.json();
      if (json.ok) {
        const items = json.data?.settings?.items || parsed;
        setPricingBenchmarks(items);
        setPricingText(JSON.stringify(items, null, 2));
      }
      setPricingMsg({ ok: !!json.ok, text: json.ok ? "저장되었습니다." : "저장 실패" });
    } catch {
      setPricingMsg({ ok: false, text: "JSON 형식을 확인해주세요." });
    } finally { setPricingSaving(false); }
  };

  const testLlm = async () => {
    setLlmTesting(true); setLlmTestMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/settings/llm/test`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ settings: llm }) });
      const json = await res.json();
      const preview = json?.data?.preview ? `응답: ${json.data.preview}` : "";
      setLlmTestMsg({ ok: !!json.ok, text: json.ok ? `성공 (${json.data.latencyMs}ms)${preview ? ` · ${preview}` : ""}` : "실패" });
    } catch { setLlmTestMsg({ ok: false, text: "요청 실패" }); } finally { setLlmTesting(false); }
  };

  const savePolicy = async () => {
    if (!selectedGate) return;
    setPolicySaving(true); setPolicyMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ops/gates/${encodeURIComponent(selectedGate)}/alert-policy`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(policy) });
      const json = await res.json();
      setPolicyMsg({ ok: json.ok, text: json.ok ? "저장되었습니다." : "저장 실패" });
    } catch { setPolicyMsg({ ok: false, text: "요청 실패" }); } finally { setPolicySaving(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 className="ops-title">통합 설정</h1>
        <p className="ops-subtitle">알림 채널, 결제 연동, Gate 알림 정책을 관리합니다.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="ops-panel">
          <div className="ops-panel-header"><h3 className="ops-panel-title">Telegram 알림</h3></div>
          <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {telegramLoading ? <div style={{ fontSize: 13, color: "var(--ops-text-muted)" }}>불러오는 중...</div> : (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                  <input type="checkbox" checked={telegram.enabled} onChange={(e) => setTelegram((p) => ({ ...p, enabled: e.target.checked }))} style={{ accentColor: "var(--ops-brand)", width: 16, height: 16 }} />
                  활성화
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>Bot Token</label>
                  <PasswordField value={telegram.botToken} onChange={(v) => setTelegram((p) => ({ ...p, botToken: v }))} placeholder="Bot Token" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>Chat ID</label>
                  <input className="ops-input" value={telegram.chatId} onChange={(e) => setTelegram((p) => ({ ...p, chatId: e.target.value }))} placeholder="Chat ID" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>Webhook Token</label>
                  <PasswordField value={telegram.webhookToken} onChange={(v) => setTelegram((p) => ({ ...p, webhookToken: v }))} placeholder="Webhook Token" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <button className="ops-btn ops-btn-brand" onClick={saveTelegram} disabled={telegramSaving}>{telegramSaving ? "저장 중" : "저장"}</button>
                  {telegramMsg && <span style={{ fontSize: 13, color: telegramMsg.ok ? "var(--ops-success)" : "var(--ops-danger)" }}>{telegramMsg.text}</span>}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="ops-panel">
          <div className="ops-panel-header"><h3 className="ops-panel-title">TossPayments 결제</h3></div>
          <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {tossLoading ? <div style={{ fontSize: 13, color: "var(--ops-text-muted)" }}>불러오는 중...</div> : (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                  <input type="checkbox" checked={toss.enabled} onChange={(e) => setToss((p) => ({ ...p, enabled: e.target.checked }))} style={{ accentColor: "var(--ops-brand)", width: 16, height: 16 }} />
                  활성화
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>Client Key</label>
                  <input className="ops-input" value={toss.clientKey} onChange={(e) => setToss((p) => ({ ...p, clientKey: e.target.value }))} placeholder="Client Key" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>Secret Key</label>
                  <PasswordField value={toss.secretKey} onChange={(v) => setToss((p) => ({ ...p, secretKey: v }))} placeholder="Secret Key" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <button className="ops-btn ops-btn-brand" onClick={saveToss} disabled={tossSaving}>{tossSaving ? "저장 중" : "저장"}</button>
                  {tossMsg && <span style={{ fontSize: 13, color: tossMsg.ok ? "var(--ops-success)" : "var(--ops-danger)" }}>{tossMsg.text}</span>}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="ops-panel">
          <div className="ops-panel-header"><h3 className="ops-panel-title">AI 엔진 (GLM)</h3></div>
          <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {llmLoading ? <div style={{ fontSize: 13, color: "var(--ops-text-muted)" }}>불러오는 중...</div> : (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                  <input type="checkbox" checked={llm.enabled} onChange={(e) => setLlm((p) => ({ ...p, enabled: e.target.checked }))} style={{ accentColor: "var(--ops-brand)", width: 16, height: 16 }} />
                  활성화
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>Provider</label>
                    <input className="ops-input" value={llm.provider} disabled />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>Model</label>
                    <input className="ops-input" value={llm.model} onChange={(e) => setLlm((p) => ({ ...p, model: e.target.value }))} placeholder="glm-5.1" />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>Endpoint</label>
                  <input className="ops-input" value={llm.endpoint} onChange={(e) => setLlm((p) => ({ ...p, endpoint: e.target.value }))} placeholder="https://api.z.ai/api/coding/paas/v4" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>API Key {llm.apiKeySet ? "(등록됨)" : ""}</label>
                  <PasswordField value={llm.apiKey} onChange={(v) => setLlm((p) => ({ ...p, apiKey: v }))} placeholder="Z.AI API Key" />
                </div>
                <div style={{ fontSize: 12, color: "var(--ops-text-muted)" }}>업데이트: {formatTimestamp(llm.updatedAt)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                  <button className="ops-btn ops-btn-brand" onClick={saveLlm} disabled={llmSaving}>{llmSaving ? "저장 중" : "저장"}</button>
                  <button className="ops-btn" onClick={testLlm} disabled={llmTesting}>{llmTesting ? "테스트 중" : "테스트"}</button>
                  {llmMsg && <span style={{ fontSize: 13, color: llmMsg.ok ? "var(--ops-success)" : "var(--ops-danger)" }}>{llmMsg.text}</span>}
                  {llmTestMsg && <span style={{ fontSize: 13, color: llmTestMsg.ok ? "var(--ops-success)" : "var(--ops-danger)" }}>{llmTestMsg.text}</span>}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="ops-panel" style={{ gridColumn: "1 / -1" }}>
          <div className="ops-panel-header"><h3 className="ops-panel-title">시장 평균 가격 벤치마크</h3></div>
          <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {pricingLoading ? <div style={{ fontSize: 13, color: "var(--ops-text-muted)" }}>불러오는 중...</div> : (
              <>
                <div style={{ fontSize: 13, color: "var(--ops-text-muted)", lineHeight: 1.6 }}>
                  `scenarioKey`, `region`, `minFee`, `avgFee`, `maxFee`, `officialCostIncluded`, `sourceLabel`, `sourceUrl`, `note` 형식의 배열 JSON을 입력합니다.
                </div>
                <textarea
                  className="ops-input"
                  value={pricingText}
                  onChange={(e) => setPricingText(e.target.value)}
                  style={{ minHeight: 280, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, lineHeight: 1.5 }}
                />
                <div style={{ fontSize: 12, color: "var(--ops-text-muted)" }}>
                  현재 항목 수: {pricingBenchmarks.length}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button className="ops-btn ops-btn-brand" onClick={savePricingBenchmarks} disabled={pricingSaving}>{pricingSaving ? "저장 중" : "저장"}</button>
                  {pricingMsg && <span style={{ fontSize: 13, color: pricingMsg.ok ? "var(--ops-success)" : "var(--ops-danger)" }}>{pricingMsg.text}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="ops-panel">
        <div className="ops-panel-header"><h3 className="ops-panel-title">Gate 알림 정책</h3></div>
        <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {gatesLoading ? <div style={{ fontSize: 13, color: "var(--ops-text-muted)" }}>Gate 목록을 불러오는 중...</div> : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 300 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>Gate 선택</label>
                <select className="ops-input" value={selectedGate} onChange={(e) => { setSelectedGate(e.target.value); loadPolicy(e.target.value); }}>
                  <option value="">— Gate를 선택하세요 —</option>
                  {gates.map((gk) => <option key={gk} value={gk}>{gk}</option>)}
                </select>
              </div>

              {selectedGate && (policyLoading ? <div style={{ fontSize: 13, color: "var(--ops-text-muted)" }}>정책을 불러오는 중...</div> : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 8, padding: 16, background: "var(--ops-bg)", borderRadius: "var(--ops-radius)", border: "1px solid var(--ops-border)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ops-text)", marginBottom: 4 }}>기본 설정</div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                      <input type="checkbox" checked={policy.enabled} onChange={(e) => setPolicy((p) => ({ ...p, enabled: e.target.checked }))} style={{ accentColor: "var(--ops-brand)", width: 16, height: 16 }} />
                      알림 활성화
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>쿨다운 (초)</label>
                      <input type="number" className="ops-input" value={policy.cooldownSec} onChange={(e) => setPolicy((p) => ({ ...p, cooldownSec: Number(e.target.value) || 0 }))} min={0} />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ops-text)", marginBottom: 4 }}>룰 설정</div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                      <input type="checkbox" checked={policy.rules.circuitBreakerOpen} onChange={(e) => setPolicy((p) => ({ ...p, rules: { ...p.rules, circuitBreakerOpen: e.target.checked } }))} style={{ accentColor: "var(--ops-brand)", width: 16, height: 16 }} />
                      서킷 브레이커 알림
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                      <input type="checkbox" checked={policy.rules.deadJobs} onChange={(e) => setPolicy((p) => ({ ...p, rules: { ...p.rules, deadJobs: e.target.checked } }))} style={{ accentColor: "var(--ops-brand)", width: 16, height: 16 }} />
                      데드 잡 알림
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>실패율 임계값</label>
                        <input type="number" className="ops-input" value={policy.rules.failRateThreshold} onChange={(e) => setPolicy((p) => ({ ...p, rules: { ...p.rules, failRateThreshold: Number(e.target.value) || 0 } }))} min={0} max={1} step={0.01} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>거부율 임계값</label>
                        <input type="number" className="ops-input" value={policy.rules.deniedThreshold} onChange={(e) => setPolicy((p) => ({ ...p, rules: { ...p.rules, deniedThreshold: Number(e.target.value) || 0 } }))} min={0} max={1} step={0.01} />
                      </div>
                    </div>
                  </div>

                  <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                    <button className="ops-btn ops-btn-brand" onClick={savePolicy} disabled={policySaving}>{policySaving ? "저장 중" : "저장"}</button>
                    {policyMsg && <span style={{ fontSize: 13, color: policyMsg.ok ? "var(--ops-success)" : "var(--ops-danger)" }}>{policyMsg.text}</span>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
