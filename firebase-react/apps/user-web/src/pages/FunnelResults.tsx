import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

interface PartnerInfo {
  partnerId: string;
  name: string;
  price: number;
  rankingScore?: number;
  rating?: number;
  reviewCount?: number;
  area?: string;
  etaDays?: number;
}

interface FunnelResults {
  recommended: PartnerInfo;
  compareTop3: PartnerInfo[];
  sponsored: PartnerInfo[];
}

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

function PartnerCard({
  partner,
  isRecommended = false,
  isSponsored = false,
  onSelect,
  busy,
}: {
  partner: PartnerInfo;
  isRecommended?: boolean;
  isSponsored?: boolean;
  onSelect: (partnerId: string) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="uw-card animate-slide-up"
      style={{
        padding: isRecommended ? "36px 32px" : "28px 24px",
        background: isRecommended ? "var(--uw-bg)" : "var(--uw-surface)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: isRecommended ? 22 : 18, fontWeight: 800, color: "var(--uw-ink)", letterSpacing: "-0.01em" }}>
            {partner.name}
          </div>
          <div style={{ fontSize: 13, color: "var(--uw-slate)", marginTop: 4 }}>
            {partner.area || t('results.nationwide')}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          {isRecommended && (
            <span className="uw-badge uw-badge-brand" style={{ fontSize: 12, fontWeight: 700 }}>
              {t('results.recommended')}
            </span>
          )}
          {isSponsored && (
            <span className="uw-badge" style={{ fontSize: 11, color: "var(--uw-fog)", fontWeight: 600 }}>
              {t('results.ad')}
            </span>
          )}
          {partner.rating && (
            <span style={{ fontSize: 13, color: "var(--uw-graphite)", fontWeight: 600 }}>
              ★ {partner.rating}{partner.reviewCount ? ` ${t('results.review_count', { count: partner.reviewCount })}` : ""}
            </span>
          )}
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: isRecommended ? "1fr 1fr 1fr" : "1fr 1fr",
        gap: 16,
        padding: "16px 0",
        borderTop: "1px solid var(--uw-border)",
        borderBottom: "1px solid var(--uw-border)",
      }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--uw-fog)", fontWeight: 600, marginBottom: 4 }}>{t('results.cost_label')}</div>
          <div className="uw-tabular" style={{ fontSize: isRecommended ? 20 : 17, fontWeight: 800, color: "var(--uw-ink)" }}>
            {formatPrice(partner.price)}{t('common.currency_unit')}
          </div>
        </div>
        {isRecommended && partner.etaDays && (
          <div>
            <div style={{ fontSize: 11, color: "var(--uw-fog)", fontWeight: 600, marginBottom: 4 }}>{t('results.time_label')}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--uw-ink)" }}>
              {t('funnel.days', { count: partner.etaDays ?? 0 })}
            </div>
          </div>
        )}
        {partner.rankingScore && (
          <div>
            <div style={{ fontSize: 11, color: "var(--uw-fog)", fontWeight: 600, marginBottom: 4 }}>{t('results.score_label')}</div>
            <div className="uw-tabular" style={{ fontSize: isRecommended ? 20 : 17, fontWeight: 800, color: "var(--uw-brand)" }}>
              {Math.round(partner.rankingScore * 100)}{t('results.score_unit')}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => onSelect(partner.partnerId)}
        disabled={busy}
        className={`uw-btn ${isRecommended ? "uw-btn-brand uw-btn-lg" : "uw-btn-outline"}`}
        style={{ width: "100%" }}
      >
        {busy ? t('common.processing') : t('results.select_button')}
      </button>
    </div>
  );
}

export default function FunnelResults() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { token } = useAuth();

  const [results, setResults] = useState<FunnelResults | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectingPartner, setSelectingPartner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apiGet<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) {
      const msg = json.error?.messageKo || json.error?.code || "API Error";
      throw new Error(msg);
    }
    return json.data as T;
  }

  async function apiPost<T = unknown>(path: string, body: Record<string, string>): Promise<T> {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      const msg = json.error?.messageKo || json.error?.code || "API Error";
      throw new Error(msg);
    }
    return json.data as T;
  }

  useEffect(() => {
    if (sessionId && token) {
      loadResults();
    }
  }, [sessionId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadResults() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiGet<FunnelResults>(`/v1/funnel/sessions/${sessionId}/results`);
      setResults(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('results.load_error'));
    } finally {
      setBusy(false);
    }
  }

  async function selectPartner(partnerId: string) {
    if (!sessionId) return;
    setSelectingPartner(partnerId);
    setError(null);
    try {
      interface SubmissionResponse {
        id: string;
      }
      const data = await apiPost<SubmissionResponse>("/v1/user/submissions", {
        casePackId: "auto",
        partnerId,
        funnelSessionId: sessionId,
      });
      navigate(`/submissions/${data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('results.select_error'));
      setSelectingPartner(null);
    }
  }

  if (busy && !results) {
    return (
      <div className="uw-container" style={{ maxWidth: 960, margin: "0 auto", textAlign: "center", padding: "120px 0" }}>
        <div style={{ color: "var(--uw-fog)", fontSize: 16 }}>{t('results.analyzing')}</div>
      </div>
    );
  }

  if (error && !results) {
    return (
      <div className="uw-container" style={{ maxWidth: 640, margin: "0 auto", paddingTop: 80, paddingBottom: 80 }}>
        <div style={{
          padding: "20px 24px",
          borderRadius: "var(--uw-radius-md)",
          background: "var(--uw-danger-soft)",
          color: "var(--uw-danger)",
          fontSize: 15,
          marginBottom: 24,
        }}>
          {error}
        </div>
        <button onClick={() => navigate("/")} className="uw-btn uw-btn-outline">
          {t('results.back_to_dashboard_full')}
        </button>
      </div>
    );
  }

  if (!results) return null;

  return (
    <div className="uw-container" style={{ maxWidth: 960, margin: "0 auto", paddingTop: 60, paddingBottom: 80 }}>
      <button
        onClick={() => navigate("/")}
        className="uw-btn uw-btn-ghost uw-btn-sm"
        style={{ marginBottom: 32, padding: 0 }}
      >
        {t('results.back_to_dashboard')}
      </button>

      <div className="animate-slide-up" style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
          {t('results.title')}
        </h1>
        <p style={{ fontSize: 16, color: "var(--uw-slate)", marginTop: 12 }}>
          {t('results.subtitle')}
        </p>
      </div>

      {error && (
        <div style={{
          padding: "14px 20px",
          borderRadius: "var(--uw-radius-md)",
          background: "var(--uw-danger-soft)",
          color: "var(--uw-danger)",
          fontSize: 14,
          marginBottom: 24,
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 48 }}>
        <PartnerCard
          partner={results.recommended}
          isRecommended
          onSelect={selectPartner}
          busy={selectingPartner !== null}
        />
      </div>

      {results.compareTop3.length > 0 && (
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 20px" }}>{t('results.compare')}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {results.compareTop3.map((p, idx) => (
              <div key={p.partnerId} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: idx === 0 ? "var(--uw-brand)" : "var(--uw-surface)",
                  color: idx === 0 ? "white" : "var(--uw-slate)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 800,
                  flexShrink: 0,
                }}>
                  {idx + 1}
                </span>
                <PartnerCard
                  partner={p}
                  onSelect={selectPartner}
                  busy={selectingPartner !== null}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {results.sponsored.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--uw-slate)" }}>
              {t('results.sponsored_partners')}
            </h2>
            <span style={{ fontSize: 11, color: "var(--uw-fog)", fontWeight: 600, padding: "2px 8px", background: "var(--uw-surface)", borderRadius: 4 }}>
              {t('results.ad')}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {results.sponsored.map((p) => (
              <PartnerCard
                key={p.partnerId}
                partner={p}
                isSponsored
                onSelect={selectPartner}
                busy={selectingPartner !== null}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
