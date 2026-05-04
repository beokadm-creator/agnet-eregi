import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../apiBase';
import { auth } from '@rp/firebase';

interface Submission {
  id: string;
  casePackId: string;
  status: string;
  createdAt: string;
  partnerId?: string;
  partnerName?: string;
  caseTitle?: string;
}

interface SubmissionsResponse {
  items: Submission[];
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'uw-badge uw-badge-warning',
  submitted: 'uw-badge uw-badge-brand',
  processing: 'uw-badge uw-badge-brand',
  completed: 'uw-badge uw-badge-success',
  failed: 'uw-badge',
  cancelled: 'uw-badge',
};

const QUICK_ACTIONS = [
  '법인 설립',
  '본점 이전',
  '임원 변경',
  '자본금 증자',
  '상호 변경',
  '청산',
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function SkeletonCard() {
  return (
    <div
      className="uw-card"
      style={{
        padding: '24px',
        opacity: 0.6,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    >
      <div style={{ height: 20, width: '60%', background: 'var(--uw-surface)', borderRadius: 6, marginBottom: 16 }} />
      <div style={{ height: 14, width: '40%', background: 'var(--uw-surface)', borderRadius: 6, marginBottom: 12 }} />
      <div style={{ height: 14, width: '30%', background: 'var(--uw-surface)', borderRadius: 6 }} />
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { token } = useAuth();
  const user = auth.currentUser;

  const getStatusText = (status: string): string => {
    const map: Record<string, string> = {
      draft: t('status.draft'),
      submitted: t('status.submitted'),
      processing: t('status.processing'),
      completed: t('status.completed'),
      failed: t('status.failed'),
      cancelled: t('status.cancelled'),
    };
    return map[status] || status;
  };

  const [searchText, setSearchText] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubmissions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/user/submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.messageKo || json.error?.code || 'API Error');
      const data = json.data as SubmissionsResponse;
      setSubmissions(data.items ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '오류가 발생했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = searchText.trim();
    if (text) {
      navigate(`/funnel?intent=${encodeURIComponent(text)}`);
    } else {
      navigate('/funnel');
    }
  };

  const handleQuickAction = (action: string) => {
    navigate(`/funnel?intent=${encodeURIComponent(action)}`);
  };

  return (
    <div className="uw-container">
      {/* Section 1 — Welcome + Quick Start */}
      <div className="animate-slide-up" style={{ marginBottom: 48 }}>
        <div style={{ marginBottom: 8, fontSize: 14, color: 'var(--uw-fog)', fontWeight: 500 }}>
          {t('dashboard.breadcrumb')}
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-0.025em', margin: '0 0 8px' }}>
          {user?.email ? t('dashboard.greeting', { email: user.email }) : t('dashboard.greeting_no_email')}
        </h1>
        <p style={{ fontSize: 16, color: 'var(--uw-slate)', margin: '0 0 32px', lineHeight: 1.5 }}>
          {t('dashboard.subtitle')}
        </p>

        <form className="uw-search-box" onSubmit={handleSearchSubmit} style={{ maxWidth: 600 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px' }}>
            <span>🔍</span>
            <input
              type="text"
              placeholder={t('dashboard.search_placeholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: 16,
                fontWeight: 500,
                color: 'var(--uw-ink)',
              }}
            />
          </div>
          <button type="submit" className="uw-btn uw-btn-brand uw-btn-lg" style={{ minWidth: 100 }}>
            {t('dashboard.search_button')} <span style={{ fontSize: 18 }}>→</span>
          </button>
        </form>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          {QUICK_ACTIONS.map((t) => (
            <button
              key={t}
              type="button"
              className="uw-btn uw-btn-outline uw-btn-sm"
              style={{ borderRadius: 999 }}
              onClick={() => handleQuickAction(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Section 2 — My Submissions */}
      <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            {t('dashboard.my_cases')}
          </h2>
          {submissions.length > 0 && !loading && (
            <button
              type="button"
              className="uw-btn uw-btn-brand uw-btn-sm"
              onClick={() => navigate('/funnel')}
            >
              {t('dashboard.new_registration')}
            </button>
          )}
        </div>

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {error && (
          <div className="uw-card" style={{ padding: '40px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--uw-ink)', marginBottom: 8 }}>
              {t('dashboard.load_error')}
            </div>
            <div style={{ fontSize: 14, color: 'var(--uw-slate)', marginBottom: 20 }}>
              {error}
            </div>
            <button type="button" className="uw-btn uw-btn-outline uw-btn-sm" onClick={loadSubmissions}>
              {t('common.retry')}
            </button>
          </div>
        )}

        {!loading && !error && submissions.length === 0 && (
          <div className="uw-card" style={{ padding: '60px 32px', textAlign: 'center' }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'var(--uw-brand-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                margin: '0 auto 20px',
              }}
            >
              📋
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--uw-ink)', marginBottom: 8 }}>
              {t('dashboard.no_cases')}
            </div>
            <div style={{ fontSize: 15, color: 'var(--uw-slate)', marginBottom: 24, lineHeight: 1.5 }}>
              {t('dashboard.start_new')}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {QUICK_ACTIONS.slice(0, 4).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="uw-btn uw-btn-soft uw-btn-sm"
                  style={{ borderRadius: 999 }}
                  onClick={() => handleQuickAction(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && submissions.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {submissions.map((sub) => (
              <div
                key={sub.id}
                className="uw-card"
                style={{
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onClick={() => navigate(`/submissions/${sub.id}`)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--uw-ink)', flex: 1, marginRight: 12, lineHeight: 1.3 }}>
                    {sub.caseTitle || sub.casePackId}
                  </div>
                  <span className={STATUS_BADGE[sub.status] || 'uw-badge'} style={{ flexShrink: 0 }}>
                    {getStatusText(sub.status)}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--uw-slate)', marginBottom: 8 }}>
                  {formatDate(sub.createdAt)}
                </div>
                {sub.partnerName && (
                  <div style={{ fontSize: 13, color: 'var(--uw-graphite)' }}>
                    {t('common.manager_label', { name: sub.partnerName })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
