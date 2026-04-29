import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

interface FunnelQuestion {
  id: string;
  type: "single_choice" | "text";
  text: string;
  options?: string[];
}

interface ValuePreview {
  minPrice: number;
  maxPrice: number;
  etaDays: number;
  requiredDocs: string[];
}

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function Funnel() {
  const { sessionId: paramSessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { token } = useAuth();

  const [sessionId, setSessionId] = useState<string | null>(paramSessionId || null);
  const [intentText, setIntentText] = useState(searchParams.get("intent") || "");
  const [currentQuestion, setCurrentQuestion] = useState<FunnelQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [textInput, setTextInput] = useState<string>("");
  const [preview, setPreview] = useState<ValuePreview | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (sessionId && !currentQuestion) {
      setBusy(true);
      apiPost(`/v1/funnel/sessions/${sessionId}/answer`, { questionId: "", answer: "" })
        .then(() => navigate(`/funnel/${sessionId}/results`, { replace: true }))
        .catch(() => setError(t('funnel.session_error')))
        .finally(() => setBusy(false));
    }
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitIntent() {
    if (!intentText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      interface IntentResponse {
        sessionId: string;
        nextQuestion: FunnelQuestion;
        totalQuestions?: number;
      }
      const data = await apiPost<IntentResponse>("/v1/funnel/intent", {
        intentText: intentText.trim(),
      });
      setSessionId(data.sessionId);
      setCurrentQuestion(data.nextQuestion);
      setQuestionIndex(1);
      if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
      navigate(`/funnel/${data.sessionId}`, { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  }

  async function answerQuestion() {
    if (!sessionId || !currentQuestion) return;
    const answer = currentQuestion.type === "single_choice" ? selectedOption : textInput.trim();
    if (!answer) return;

    setBusy(true);
    setError(null);
    try {
      interface AnswerResponse {
        isCompleted: boolean;
        nextQuestion?: FunnelQuestion;
        preview?: ValuePreview;
        totalQuestions?: number;
      }
      const data = await apiPost<AnswerResponse>(
        `/v1/funnel/sessions/${sessionId}/answer`,
        { questionId: currentQuestion.id, answer }
      );

      if (data.preview) setPreview(data.preview);
      if (data.totalQuestions) setTotalQuestions(data.totalQuestions);

      if (data.isCompleted || !data.nextQuestion) {
        navigate(`/funnel/${sessionId}/results`);
        return;
      }

      setCurrentQuestion(data.nextQuestion);
      setQuestionIndex((prev) => prev + 1);
      setSelectedOption("");
      setTextInput("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  }

  if (!sessionId) {
    return (
      <div className="uw-container" style={{ maxWidth: 720, margin: "0 auto", paddingTop: 80, paddingBottom: 80 }}>
        <div className="animate-slide-up" style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
            {t('funnel.title_line1')}<br />
            <span style={{ color: "var(--uw-brand)" }}>{t('funnel.title_highlight')}</span>
          </h1>
          <p style={{ fontSize: 17, color: "var(--uw-slate)", marginTop: 16, lineHeight: 1.6 }}>
            {t('funnel.subtitle_line1')}<br />
            {t('funnel.subtitle_line2')}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
          <textarea
            value={intentText}
            onChange={(e) => setIntentText(e.target.value)}
            placeholder={t('funnel.placeholder')}
            className="uw-input"
            rows={4}
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              resize: "vertical",
              minHeight: 120,
              borderRadius: "var(--uw-radius-lg)",
              padding: "20px 24px",
            }}
          />

          {error && (
            <div style={{
              padding: "14px 20px",
              borderRadius: "var(--uw-radius-md)",
              background: "var(--uw-danger-soft)",
              color: "var(--uw-danger)",
              fontSize: 14,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={submitIntent}
            disabled={busy || !intentText.trim()}
            className="uw-btn uw-btn-brand uw-btn-lg"
            style={{ width: "100%" }}
          >
            {busy ? t('funnel.analyzing') : t('funnel.start_button')}
          </button>
        </div>

        <div style={{ marginTop: 32, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {["법인 설립", "본점 이전", "임원 변경", "자본금 증자", "상호 변경", "청산"].map((tag) => (
            <button
              key={tag}
              className="uw-btn uw-btn-outline uw-btn-sm"
              style={{ borderRadius: 999 }}
              onClick={() => setIntentText(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="uw-container" style={{ maxWidth: 640, margin: "0 auto", paddingTop: 60, paddingBottom: 80 }}>
      <button
        onClick={() => navigate("/")}
        className="uw-btn uw-btn-ghost uw-btn-sm"
        style={{ marginBottom: 32, padding: 0 }}
      >
        ← {t('common.dashboard')}
      </button>

      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--uw-brand)" }}>
            {t('funnel.question_label', { current: questionIndex, total: totalQuestions > 0 ? ` / ${totalQuestions}` : '' })}
          </span>
          <span style={{ fontSize: 13, color: "var(--uw-fog)" }}>{t('funnel.diagnosing')}</span>
        </div>
        <div style={{
          height: 6,
          borderRadius: 999,
          background: "var(--uw-surface)",
          overflow: "hidden",
        }}>
          <div
            className="animate-fade-in"
            style={{
              height: "100%",
              borderRadius: 999,
              background: "var(--uw-brand)",
              width: totalQuestions > 0 ? `${(questionIndex / totalQuestions) * 100}%` : "30%",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {currentQuestion && (
        <div className="uw-card animate-slide-up" style={{ padding: "40px 32px" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 32px", letterSpacing: "-0.01em", lineHeight: 1.4 }}>
            {currentQuestion.text}
          </h2>

          {currentQuestion.type === "single_choice" && currentQuestion.options && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
              {currentQuestion.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSelectedOption(opt)}
                  className="uw-btn"
                  style={{
                    textAlign: "left",
                    justifyContent: "flex-start",
                    padding: "16px 20px",
                    borderRadius: "var(--uw-radius-md)",
                    background: selectedOption === opt ? "var(--uw-brand-soft)" : "var(--uw-surface)",
                    color: selectedOption === opt ? "var(--uw-brand)" : "var(--uw-ink)",
                    fontWeight: selectedOption === opt ? 700 : 500,
                    border: selectedOption === opt ? "2px solid var(--uw-brand)" : "2px solid var(--uw-border)",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === "text" && (
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={t('funnel.answer_placeholder')}
              className="uw-input"
              rows={3}
              style={{
                fontSize: 16,
                lineHeight: 1.5,
                resize: "vertical",
                minHeight: 80,
                marginBottom: 32,
              }}
            />
          )}

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

          <button
            onClick={answerQuestion}
            disabled={
              busy ||
              (currentQuestion.type === "single_choice" ? !selectedOption : !textInput.trim())
            }
            className="uw-btn uw-btn-brand uw-btn-lg"
            style={{ width: "100%" }}
          >
            {busy ? t('common.processing') : t('funnel.next_button')}
          </button>
        </div>
      )}

      {!currentQuestion && busy && (
        <div style={{ textAlign: "center", padding: 80, color: "var(--uw-fog)", fontSize: 15 }}>
          {t('funnel.loading_question')}
        </div>
      )}

      {preview && (
        <div className="uw-card animate-fade-in" style={{ marginTop: 24, padding: "24px 28px", background: "var(--uw-surface)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--uw-brand)", marginBottom: 16, letterSpacing: "0.05em" }}>
            {t('funnel.preview_title')}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--uw-fog)", fontWeight: 600, marginBottom: 4 }}>{t('funnel.estimated_cost')}</div>
              <div className="uw-tabular" style={{ fontSize: 20, fontWeight: 800, color: "var(--uw-ink)" }}>
                ₩{formatPrice(preview.minPrice)}~₩{formatPrice(preview.maxPrice)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--uw-fog)", fontWeight: 600, marginBottom: 4 }}>{t('funnel.estimated_time')}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--uw-ink)" }}>
                {t('funnel.days', { count: preview.etaDays })}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, color: "var(--uw-fog)", fontWeight: 600, marginBottom: 6 }}>{t('funnel.required_docs')}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {preview.requiredDocs.map((doc) => (
                  <span key={doc} className="uw-badge" style={{ fontSize: 13 }}>
                    {doc}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
