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
  matchScore?: number;
  rating?: number;
  reviewCount?: number;
  area?: string;
  etaDays?: number;
  matchReasons?: string[];
}

interface FunnelResults {
  recommended: PartnerInfo | null;
  compareTop3: PartnerInfo[];
  sponsored: PartnerInfo[];
  ai?: any;
  preview?: {
    minPrice: number;
    maxPrice: number;
    etaDays: number;
    requiredDocs: string[];
  } | null;
  pricingBenchmark?: {
    scenarioKey: string;
    region: string;
    minFee: number;
    avgFee: number;
    maxFee: number;
    officialCostIncluded: boolean;
    sourceLabel: string;
    sourceUrl: string;
    note?: string;
  } | null;
  followUp?: {
    status?: string;
    questions?: Array<{
      id: string;
      text: string;
      type: "single_choice" | "number" | "text";
    }>;
    answers?: Record<string, string | number>;
  } | null;
}

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatAnswer(value: unknown): string {
  if (value === undefined || value === null || value === "") return "미응답";
  return String(value);
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
        {(partner.matchScore ?? partner.rankingScore) && (
          <div>
            <div style={{ fontSize: 11, color: "var(--uw-fog)", fontWeight: 600, marginBottom: 4 }}>{t('results.score_label')}</div>
            <div className="uw-tabular" style={{ fontSize: isRecommended ? 20 : 17, fontWeight: 800, color: "var(--uw-brand)" }}>
              {Math.round((partner.matchScore ?? partner.rankingScore ?? 0) * 100)}{t('results.score_unit')}
            </div>
          </div>
        )}
      </div>

      {Array.isArray(partner.matchReasons) && partner.matchReasons.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {partner.matchReasons.slice(0, 6).map((r, idx) => (
            <span
              key={`${partner.partnerId}-reason-${idx}`}
              className="uw-badge"
              style={{ fontSize: 11, color: "var(--uw-graphite)", background: "var(--uw-border)", border: "none" }}
            >
              {r}
            </span>
          ))}
        </div>
      )}

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
  const [ai, setAi] = useState<any | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [followupBusy, setFollowupBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectingPartner, setSelectingPartner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function isPartnerInfo(value: unknown): value is PartnerInfo {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<PartnerInfo>;
    return typeof candidate.partnerId === "string" && typeof candidate.name === "string";
  }

  function normalizeResults(value: unknown): FunnelResults | null {
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<FunnelResults>;
    return {
      recommended: isPartnerInfo(candidate.recommended) ? candidate.recommended : null,
      compareTop3: Array.isArray(candidate.compareTop3) ? candidate.compareTop3.filter(isPartnerInfo) : [],
      sponsored: Array.isArray(candidate.sponsored) ? candidate.sponsored.filter(isPartnerInfo) : [],
      ai: candidate.ai ?? null,
    };
  }

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

  async function apiPost<T = unknown>(path: string, body: Record<string, any>): Promise<T> {
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
      const data = normalizeResults(await apiGet(`/v1/funnel/sessions/${sessionId}/results`));
      if (!data) {
        throw new Error(t('results.load_error'));
      }
      setResults(data);
      setAi(data.ai || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('results.load_error'));
    } finally {
      setBusy(false);
    }
  }

  async function generateAi() {
    if (!sessionId) return;
    setAiBusy(true);
    setError(null);
    try {
      const data = await apiPost<{ ai: any }>(`/v1/funnel/sessions/${sessionId}/ai/suggestions`, {});
      setAi((data as any)?.ai || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AI 추천 생성 실패");
    } finally {
      setAiBusy(false);
    }
  }

  async function startFollowup() {
    if (!sessionId) return;
    setFollowupBusy(true);
    setError(null);
    try {
      await apiPost(`/v1/funnel/sessions/${sessionId}/followup/start`, {});
      navigate(`/funnel/${sessionId}?mode=followup`, { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "추가 질문 시작 실패");
    } finally {
      setFollowupBusy(false);
    }
  }

  async function selectPartner(partnerId: string) {
    if (!sessionId) return;
    setSelectingPartner(partnerId);
    setError(null);
    try {
      interface SubmissionResponse {
        submission: { id: string };
      }
      const data = await apiPost<SubmissionResponse>("/v1/user/submissions", {
        inputType: "funnel",
        partnerId,
        sessionId,
        submitNow: true,
        payload: {},
      });
      navigate(`/submissions/${data.submission.id}`);
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

  const hasPartners = Boolean(results.recommended) || results.compareTop3.length > 0 || results.sponsored.length > 0;
  const preview = results.preview || null;
  const previewAverage = preview ? Math.round((Number(preview.minPrice || 0) + Number(preview.maxPrice || 0)) / 2) : null;
  const pricingBenchmark = results.pricingBenchmark || null;
  const followUpQuestions = Array.isArray(results.followUp?.questions) ? results.followUp?.questions : [];
  const followUpAnswers = results.followUp?.answers || {};
  const answeredFollowUp = followUpQuestions.filter((q) => followUpAnswers[q.id] !== undefined && followUpAnswers[q.id] !== null && String(followUpAnswers[q.id]).trim() !== "");

  return (
    <div className="uw-container" style={{ maxWidth: 960, margin: "0 auto", paddingTop: 60, paddingBottom: 80 }}>
      <button
        onClick={() => navigate("/")}
        className="uw-btn uw-btn-ghost uw-btn-sm"
        style={{ marginBottom: 32, padding: 0 }}
      >
        {t('results.back_to_dashboard')}
      </button>

      <div className="uw-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--uw-ink)" }}>AI 추천</div>
          <button onClick={generateAi} disabled={aiBusy || busy} className="uw-btn uw-btn-outline">
            {aiBusy ? "생성 중..." : ai ? "갱신" : "생성"}
          </button>
        </div>
        {ai ? (
          <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
            {ai.summaryKo && <div style={{ padding: 12, borderRadius: 12, background: "var(--uw-surface)" }}>{ai.summaryKo}</div>}
            {Array.isArray(ai.recommendedNextStepsKo) && ai.recommendedNextStepsKo.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: "var(--uw-fog)", fontWeight: 800, marginBottom: 6 }}>다음 단계</div>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                  {ai.recommendedNextStepsKo.map((x: string, i: number) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            )}
            {Array.isArray(ai.recommendedPartnerCriteriaKo) && ai.recommendedPartnerCriteriaKo.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: "var(--uw-fog)", fontWeight: 800, marginBottom: 6 }}>추천 기준</div>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                  {ai.recommendedPartnerCriteriaKo.map((x: string, i: number) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            )}
            {Array.isArray(ai.suggestedQuestionsKo) && ai.suggestedQuestionsKo.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: "var(--uw-fog)", fontWeight: 800, marginBottom: 6 }}>추가 질문</div>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                  {ai.suggestedQuestionsKo.slice(0, 8).map((x: string, i: number) => <li key={i}>{x}</li>)}
                </ul>
                <button
                  onClick={startFollowup}
                  disabled={followupBusy || aiBusy || busy}
                  className="uw-btn uw-btn-outline"
                  style={{ marginTop: 10 }}
                >
                  {followupBusy ? "시작 중..." : "추가 질문 답변하기"}
                </button>
              </div>
            )}
            {Array.isArray(ai.followUpQuestions) && ai.followUpQuestions.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: "var(--uw-fog)", fontWeight: 800, marginBottom: 6 }}>추가 질문(구조화)</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {ai.followUpQuestions.slice(0, 6).map((q: any, i: number) => (
                    <div key={i} style={{ padding: 12, borderRadius: 12, background: "var(--uw-surface)" }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>{q.text}</div>
                      {q.why && <div style={{ fontSize: 13, color: "var(--uw-slate)", lineHeight: 1.55 }}>{q.why}</div>}
                      {Array.isArray(q.options) && q.options.length > 0 && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          {q.options.slice(0, 6).map((o: string) => (
                            <span key={o} className="uw-badge" style={{ fontSize: 12 }}>{o}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={startFollowup}
                  disabled={followupBusy || aiBusy || busy}
                  className="uw-btn uw-btn-outline"
                  style={{ marginTop: 10 }}
                >
                  {followupBusy ? "시작 중..." : "추가 질문 답변하기"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: "var(--uw-fog)", fontSize: 13 }}>진단 결과를 요약하고 추천 기준/다음 단계를 제안합니다.</div>
        )}
      </div>

      {(preview || answeredFollowUp.length > 0) && (
        <div className="uw-card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--uw-ink)", marginBottom: 12 }}>
            반영된 진단 요약
          </div>
          {pricingBenchmark && (
            <div style={{ padding: 16, borderRadius: 14, background: "rgba(97, 60, 240, 0.06)", border: "1px solid rgba(97, 60, 240, 0.12)", marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "var(--uw-fog)", fontWeight: 800, marginBottom: 8 }}>시장 평균 벤치마크</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--uw-fog)", marginBottom: 6 }}>시장 범위</div>
                  <div className="uw-tabular" style={{ fontSize: 18, fontWeight: 800, color: "var(--uw-ink)" }}>
                    ₩{formatPrice(pricingBenchmark.minFee)}~₩{formatPrice(pricingBenchmark.maxFee)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--uw-fog)", marginBottom: 6 }}>시장 평균</div>
                  <div className="uw-tabular" style={{ fontSize: 18, fontWeight: 800, color: "var(--uw-ink)" }}>
                    ₩{formatPrice(pricingBenchmark.avgFee)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--uw-fog)", marginBottom: 6 }}>비용 기준</div>
                  <div style={{ fontSize: 14, color: "var(--uw-slate)", lineHeight: 1.6 }}>
                    {pricingBenchmark.officialCostIncluded ? "공과금 포함 기준" : "대행 수수료 중심 기준"}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--uw-fog)", marginTop: 10 }}>
                출처: <a href={pricingBenchmark.sourceUrl} target="_blank" rel="noreferrer">{pricingBenchmark.sourceLabel}</a>
              </div>
              {pricingBenchmark.note && (
                <div style={{ fontSize: 12, color: "var(--uw-fog)", marginTop: 6 }}>
                  {pricingBenchmark.note}
                </div>
              )}
            </div>
          )}
          {preview && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: answeredFollowUp.length > 0 ? 20 : 0 }}>
              <div style={{ padding: 14, borderRadius: 12, background: "var(--uw-surface)" }}>
                <div style={{ fontSize: 12, color: "var(--uw-fog)", fontWeight: 700, marginBottom: 6 }}>예상 비용 범위</div>
                <div className="uw-tabular" style={{ fontSize: 18, fontWeight: 800, color: "var(--uw-ink)" }}>
                  ₩{formatPrice(preview.minPrice)}~₩{formatPrice(preview.maxPrice)}
                </div>
              </div>
              {previewAverage !== null && (
                <div style={{ padding: 14, borderRadius: 12, background: "var(--uw-surface)" }}>
                  <div style={{ fontSize: 12, color: "var(--uw-fog)", fontWeight: 700, marginBottom: 6 }}>기준 평균값</div>
                  <div className="uw-tabular" style={{ fontSize: 18, fontWeight: 800, color: "var(--uw-ink)" }}>
                    ₩{formatPrice(previewAverage)}
                  </div>
                </div>
              )}
              <div style={{ padding: 14, borderRadius: 12, background: "var(--uw-surface)" }}>
                <div style={{ fontSize: 12, color: "var(--uw-fog)", fontWeight: 700, marginBottom: 6 }}>예상 기간</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--uw-ink)" }}>
                  {t('funnel.days', { count: preview.etaDays })}
                </div>
              </div>
              <div style={{ padding: 14, borderRadius: 12, background: "var(--uw-surface)" }}>
                <div style={{ fontSize: 12, color: "var(--uw-fog)", fontWeight: 700, marginBottom: 6 }}>참고</div>
                <div style={{ fontSize: 13, color: "var(--uw-slate)", lineHeight: 1.6 }}>
                  현재 시나리오 기준 예상 범위입니다. 파트너 수급과 추가 조건에 따라 달라질 수 있습니다.
                </div>
              </div>
            </div>
          )}
          {preview && Array.isArray(preview.requiredDocs) && preview.requiredDocs.length > 0 && (
            <div style={{ marginBottom: answeredFollowUp.length > 0 ? 16 : 0 }}>
              <div style={{ fontSize: 12, color: "var(--uw-fog)", fontWeight: 800, marginBottom: 8 }}>예상 준비 서류</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {preview.requiredDocs.map((doc) => (
                  <span key={doc} className="uw-badge" style={{ fontSize: 12 }}>
                    {doc}
                  </span>
                ))}
              </div>
            </div>
          )}
          {answeredFollowUp.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: "var(--uw-fog)", fontWeight: 800, marginBottom: 8 }}>반영된 추가 질문 답변</div>
              <div style={{ display: "grid", gap: 10 }}>
                {answeredFollowUp.map((q) => (
                  <div key={q.id} style={{ padding: 14, borderRadius: 12, background: "var(--uw-surface)" }}>
                    <div style={{ fontSize: 13, color: "var(--uw-fog)", fontWeight: 700, marginBottom: 6 }}>{q.text}</div>
                    <div style={{ fontSize: 15, color: "var(--uw-ink)", fontWeight: 700 }}>
                      {formatAnswer(followUpAnswers[q.id])}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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

      {results.recommended ? (
        <div style={{ marginBottom: 48 }}>
          <PartnerCard
            partner={results.recommended}
            isRecommended
            onSelect={selectPartner}
            busy={selectingPartner !== null}
          />
        </div>
      ) : (
        <div className="uw-card" style={{ padding: 28, marginBottom: 48, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--uw-ink)", marginBottom: 8 }}>
            {t('results.title')}
          </div>
          <div style={{ fontSize: 14, color: "var(--uw-slate)", lineHeight: 1.6 }}>
            현재 조건에 맞는 추천 파트너가 아직 없습니다. 조건을 조정하거나 잠시 후 다시 시도해 주세요.
          </div>
        </div>
      )}

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

      {!hasPartners && !error && (
        <div className="uw-card" style={{ padding: 24, marginTop: 24, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "var(--uw-slate)", lineHeight: 1.6 }}>
            추천 가능한 파트너 데이터가 없어 결과를 제한적으로 표시했습니다.
          </div>
        </div>
      )}
    </div>
  );
}
