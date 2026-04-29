import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '@rp/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../apiBase';

interface NotificationSettings {
  submissionCompleted: boolean;
  submissionFailed: boolean;
  webhookUrls: string[];
}

interface WebhookInput {
  url: string;
  secret: string;
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="uw-card" style={{ padding: '32px', marginBottom: 24 }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', letterSpacing: '-0.01em' }}>{title}</h3>
      {children}
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '1px solid var(--uw-border)' }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--uw-ink)' }}>{label}</div>
        {description && <div style={{ fontSize: 13, color: 'var(--uw-slate)', marginTop: 4 }}>{description}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        border: 'none',
        background: checked ? 'var(--uw-brand)' : 'var(--uw-border-strong)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s',
        padding: 0,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'white',
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

const LANGUAGES = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
];

const CURRENCIES = [
  { value: 'KRW', label: 'KRW (₩)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'JPY', label: 'JPY (¥)' },
];

export default function Settings() {
  const { token } = useAuth();
  const user = auth.currentUser;

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    submissionCompleted: true,
    submissionFailed: true,
    webhookUrls: [],
  });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  const [language, setLanguage] = useState('ko');
  const [currency, setCurrency] = useState('KRW');

  const [webhookInput, setWebhookInput] = useState<WebhookInput>({ url: '', secret: '' });

  const loadNotifSettings = useCallback(async () => {
    if (!token) return;
    setNotifLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/user/notification-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setNotifSettings({
          submissionCompleted: json.data.submissionCompleted ?? true,
          submissionFailed: json.data.submissionFailed ?? true,
          webhookUrls: json.data.webhookUrls ?? [],
        });
      }
    } catch {
    } finally {
      setNotifLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadNotifSettings();
    const savedLang = localStorage.getItem('uw-language');
    const savedCurrency = localStorage.getItem('uw-currency');
    if (savedLang) setLanguage(savedLang);
    if (savedCurrency) setCurrency(savedCurrency);
  }, [loadNotifSettings]);

  const saveNotifSettings = async () => {
    if (!token) return;
    setNotifSaving(true);
    setNotifSaved(false);
    try {
      await fetch(`${getApiBaseUrl()}/v1/user/notification-settings`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(notifSettings),
      });
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 2000);
    } catch {
    } finally {
      setNotifSaving(false);
    }
  };

  const addWebhook = () => {
    const trimmed = webhookInput.url.trim();
    if (!trimmed) return;
    if (notifSettings.webhookUrls.includes(trimmed)) return;
    setNotifSettings((prev) => ({ ...prev, webhookUrls: [...prev.webhookUrls, trimmed] }));
    setWebhookInput({ url: '', secret: '' });
  };

  const removeWebhook = (url: string) => {
    setNotifSettings((prev) => ({
      ...prev,
      webhookUrls: prev.webhookUrls.filter((u) => u !== url),
    }));
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    localStorage.setItem('uw-language', value);
  };

  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
    localStorage.setItem('uw-currency', value);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
    }
  };

  return (
    <div className="uw-container">
      <div className="animate-slide-up" style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 8, fontSize: 14, color: 'var(--uw-fog)', fontWeight: 500 }}>설정</div>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-0.025em', margin: 0 }}>
          설정
        </h1>
      </div>

      <SettingsSection title="알림 설정">
        {notifLoading ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--uw-slate)', fontSize: 14 }}>
            불러오는 중...
          </div>
        ) : (
          <>
            <SettingRow label="사건 완료 알림" description="등기가 완료되면 알려드립니다.">
              <Toggle
                checked={notifSettings.submissionCompleted}
                onChange={(v) => setNotifSettings((prev) => ({ ...prev, submissionCompleted: v }))}
              />
            </SettingRow>
            <SettingRow label="사건 실패 알림" description="등기 처리 중 오류가 발생하면 알려드립니다.">
              <Toggle
                checked={notifSettings.submissionFailed}
                onChange={(v) => setNotifSettings((prev) => ({ ...prev, submissionFailed: v }))}
              />
            </SettingRow>

            <div style={{ paddingTop: 20, borderTop: '1px solid var(--uw-border)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--uw-ink)', marginBottom: 4 }}>Webhook URL</div>
              <div style={{ fontSize: 13, color: 'var(--uw-slate)', marginBottom: 12 }}>이벤트 발생 시 알림을 받을 URL을 등록하세요.</div>

              {notifSettings.webhookUrls.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {notifSettings.webhookUrls.map((url) => (
                    <div
                      key={url}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--uw-surface)',
                        borderRadius: 10,
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: 'var(--uw-ink)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                        {url}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeWebhook(url)}
                        style={{ background: 'none', border: 'none', color: 'var(--uw-danger)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '4px 8px' }}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  placeholder="https://example.com/webhook"
                  value={webhookInput.url}
                  onChange={(e) => setWebhookInput((prev) => ({ ...prev, url: e.target.value }))}
                  className="uw-input"
                  style={{ flex: 2, height: 40, fontSize: 13 }}
                />
                <input
                  type="text"
                  placeholder="Secret (선택)"
                  value={webhookInput.secret}
                  onChange={(e) => setWebhookInput((prev) => ({ ...prev, secret: e.target.value }))}
                  className="uw-input"
                  style={{ flex: 1, height: 40, fontSize: 13 }}
                />
                <button type="button" className="uw-btn uw-btn-outline uw-btn-sm" onClick={addWebhook} disabled={!webhookInput.url.trim()}>
                  추가
                </button>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="uw-btn uw-btn-brand uw-btn-sm"
                onClick={saveNotifSettings}
                disabled={notifSaving}
              >
                {notifSaving ? '저장 중...' : notifSaved ? '✓ 저장됨' : '알림 설정 저장'}
              </button>
            </div>
          </>
        )}
      </SettingsSection>

      <SettingsSection title="언어 및 통화">
        <SettingRow label="언어" description="표시 언어를 선택합니다.">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={{
              height: 40,
              padding: '0 12px',
              fontSize: 14,
              fontWeight: 500,
              border: '1px solid var(--uw-border)',
              borderRadius: 10,
              background: 'var(--uw-surface)',
              color: 'var(--uw-ink)',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--uw-font-sans)',
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="통화" description="가격 표시에 사용할 통화를 선택합니다.">
          <select
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            style={{
              height: 40,
              padding: '0 12px',
              fontSize: 14,
              fontWeight: 500,
              border: '1px solid var(--uw-border)',
              borderRadius: 10,
              background: 'var(--uw-surface)',
              color: 'var(--uw-ink)',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--uw-font-sans)',
            }}
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="계정 정보">
        <SettingRow label="이메일">
          <span style={{ fontSize: 15, color: 'var(--uw-slate)' }}>{user?.email ?? '—'}</span>
        </SettingRow>
        <SettingRow label="UID">
          <span style={{ fontSize: 13, color: 'var(--uw-fog)', fontFamily: 'monospace' }}>{user?.uid ?? '—'}</span>
        </SettingRow>
        <div style={{ paddingTop: 20, borderTop: '1px solid var(--uw-border)' }}>
          <button
            type="button"
            className="uw-btn uw-btn-outline"
            onClick={handleLogout}
            style={{ borderColor: 'var(--uw-danger)', color: 'var(--uw-danger)' }}
          >
            로그아웃
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}
