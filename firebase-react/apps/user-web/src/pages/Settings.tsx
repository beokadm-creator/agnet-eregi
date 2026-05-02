import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { token } = useAuth();
  const user = auth.currentUser;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  useEffect(() => {
    return () => { timers.current.forEach(clearTimeout); };
  }, []);

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
      timers.current.push(setTimeout(() => setNotifSaved(false), 2000));
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
        <div style={{ marginBottom: 8, fontSize: 14, color: 'var(--uw-fog)', fontWeight: 500 }}>{t('settings.breadcrumb')}</div>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-0.025em', margin: 0 }}>
          {t('settings.title')}
        </h1>
      </div>

      <SettingsSection title={t('settings.notifications')}>
        {notifLoading ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--uw-slate)', fontSize: 14 }}>
            {t('settings.loading')}
          </div>
        ) : (
          <>
            <SettingRow label={t('settings.case_complete_notif')} description={t('settings.case_complete_desc')}>
              <Toggle
                checked={notifSettings.submissionCompleted}
                onChange={(v) => setNotifSettings((prev) => ({ ...prev, submissionCompleted: v }))}
              />
            </SettingRow>
            <SettingRow label={t('settings.case_fail_notif')} description={t('settings.case_fail_desc')}>
              <Toggle
                checked={notifSettings.submissionFailed}
                onChange={(v) => setNotifSettings((prev) => ({ ...prev, submissionFailed: v }))}
              />
            </SettingRow>

            <div style={{ paddingTop: 20, borderTop: '1px solid var(--uw-border)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--uw-ink)', marginBottom: 4 }}>{t('settings.webhook_title')}</div>
              <div style={{ fontSize: 13, color: 'var(--uw-slate)', marginBottom: 12 }}>{t('settings.webhook_desc')}</div>

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
                        {t('settings.delete')}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  placeholder={t('settings.webhook_placeholder')}
                  value={webhookInput.url}
                  onChange={(e) => setWebhookInput((prev) => ({ ...prev, url: e.target.value }))}
                  className="uw-input"
                  style={{ flex: 2, height: 40, fontSize: 13 }}
                />
                <input
                  type="text"
                  placeholder={t('settings.webhook_secret_placeholder')}
                  value={webhookInput.secret}
                  onChange={(e) => setWebhookInput((prev) => ({ ...prev, secret: e.target.value }))}
                  className="uw-input"
                  style={{ flex: 1, height: 40, fontSize: 13 }}
                />
                <button type="button" className="uw-btn uw-btn-outline uw-btn-sm" onClick={addWebhook} disabled={!webhookInput.url.trim()}>
                  {t('settings.add_button')}
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
                {notifSaving ? t('settings.saving') : notifSaved ? t('settings.saved') : t('settings.save_button')}
              </button>
            </div>
          </>
        )}
      </SettingsSection>

      <SettingsSection title={t('settings.language_and_currency')}>
        <SettingRow label={t('settings.language_label')} description={t('settings.language_desc')}>
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
        <SettingRow label={t('settings.currency_label')} description={t('settings.currency_desc')}>
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

      <SettingsSection title={t('settings.account_info')}>
        <SettingRow label={t('settings.email')}>
          <span style={{ fontSize: 15, color: 'var(--uw-slate)' }}>{user?.email ?? '—'}</span>
        </SettingRow>
        <SettingRow label={t('settings.uid')}>
          <span style={{ fontSize: 13, color: 'var(--uw-fog)', fontFamily: 'monospace' }}>{user?.uid ?? '—'}</span>
        </SettingRow>
        <div style={{ paddingTop: 20, borderTop: '1px solid var(--uw-border)' }}>
          <button
            type="button"
            className="uw-btn uw-btn-outline"
            onClick={handleLogout}
            style={{ borderColor: 'var(--uw-danger)', color: 'var(--uw-danger)' }}
          >
            {t('common.logout')}
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}
