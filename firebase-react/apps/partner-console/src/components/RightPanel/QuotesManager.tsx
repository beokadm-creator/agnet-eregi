import { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

export default function QuotesManager() {
  const { quotes, selectedCase, busy, setBusy, setLog, loadCaseDetail } = useAppContext();
  const [newQuotePriceMin, setNewQuotePriceMin] = useState<number>(0);
  const [newQuotePriceMax, setNewQuotePriceMax] = useState<number>(0);
  const [newQuoteEtaMin, setNewQuoteEtaMin] = useState<number>(24);
  const [newQuoteEtaMax, setNewQuoteEtaMax] = useState<number>(72);
  const [finalizeQuotePrice, setFinalizeQuotePrice] = useState<number>(0);
  const [finalizeQuoteAssumptions, setFinalizeQuoteAssumptions] = useState<string>("");

  if (!selectedCase) return null;

  async function createQuoteDraft() {
    if (!selectedCase) return;
    setBusy(true);
    setLog("견적 제안(Draft) 생성 중...");
    try {
      const res = await getApi().post(`/v1/partner/cases/${selectedCase.id}/quotes/draft`, {
        priceMin: newQuotePriceMin,
        priceMax: newQuotePriceMax,
        etaMinHours: newQuoteEtaMin,
        etaMaxHours: newQuoteEtaMax
      });
      setLog(`견적 초안 생성 완료: ${res.quote.id}`);
      setNewQuotePriceMin(0);
      setNewQuotePriceMax(0);
      await loadCaseDetail(selectedCase.id);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function finalizeQuote(quoteId: string) {
    if (!selectedCase) return;
    setBusy(true);
    setLog("견적 최종 확정 중...");
    try {
      const assumptions = finalizeQuoteAssumptions.split(",")?.map(s => s.trim()).filter(Boolean);
      await getApi().post(`/v1/partner/cases/${selectedCase.id}/quotes/${quoteId}/finalize`, {
        finalPrice: finalizeQuotePrice,
        assumptionsKo: assumptions
      });
      setLog(`견적 확정 완료 (승인 대기 중)`);
      setFinalizeQuotePrice(0);
      setFinalizeQuoteAssumptions("");
      await loadCaseDetail(selectedCase.id);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function generateAIAssistantQuote() {
    if (!selectedCase) return;
    setBusy(true);
    setLog("AI 견적 초안 생성 중...");
    try {
      const res = await getApi().post(`/v1/partner/cases/${selectedCase.id}/ai-assistant/quote`, {});
      setNewQuotePriceMin(res.draft.priceMin || 0);
      setNewQuotePriceMax(res.draft.priceMax || 0);
      setNewQuoteEtaMin(res.draft.etaMinHours || 24);
      setNewQuoteEtaMax(res.draft.etaMaxHours || 72);
      if (res.draft.assumptionsKo && Array.isArray(res.draft.assumptionsKo)) {
        setLog(`AI 제안 완료. (전제조건 제안: ${res.draft.assumptionsKo.join(", ")})`);
      } else {
        setLog("AI 견적 제안 완료");
      }
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pc-card">
      <div className="pc-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--pc-border)", paddingBottom: 16, marginBottom: 16 }}>
        <h3 className="pc-card-title" style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>💰</span> 견적 관리
        </h3>
        <button onClick={generateAIAssistantQuote} disabled={busy} className="pc-btn" style={{ background: "linear-gradient(135deg, var(--pc-brand), #8b5cf6)", color: "white", border: "none" }}>
          🤖 AI 초안 생성
        </button>
      </div>
      
      <div style={{ background: "var(--pc-surface)", padding: 16, borderRadius: "var(--pc-radius)", marginBottom: 16, border: "1px solid var(--pc-border)" }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--pc-text)" }}>새 제안(Draft) 작성</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input type="number" placeholder="최소 금액 (원)" value={newQuotePriceMin || ""} onChange={e => setNewQuotePriceMin(Number(e.target.value))} className="pc-input" />
          <input type="number" placeholder="최대 금액 (원)" value={newQuotePriceMax || ""} onChange={e => setNewQuotePriceMax(Number(e.target.value))} className="pc-input" />
          <input type="number" placeholder="최소 소요시간 (시간)" value={newQuoteEtaMin || ""} onChange={e => setNewQuoteEtaMin(Number(e.target.value))} className="pc-input" />
          <input type="number" placeholder="최대 소요시간 (시간)" value={newQuoteEtaMax || ""} onChange={e => setNewQuoteEtaMax(Number(e.target.value))} className="pc-input" />
        </div>
        <button onClick={createQuoteDraft} disabled={busy || !newQuotePriceMin || !newQuotePriceMax} className="pc-btn pc-btn-brand" style={{ width: "100%" }}>
          제안 생성
        </button>
      </div>

      {quotes.length === 0 ? (
        <div style={{ color: "var(--pc-text-muted)", fontSize: 13, textAlign: "center", padding: 24 }}>견적 이력이 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {quotes?.map(q => (
            <div key={q.id} style={{ padding: 16, border: "1px solid var(--pc-border)", borderRadius: "var(--pc-radius)", background: "var(--pc-bg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`pc-badge ${q.status === 'draft' ? 'pc-badge-neutral' : q.status === 'finalized' ? 'pc-badge-warning' : q.status === 'accepted' ? 'pc-badge-success' : 'pc-badge-brand'}`}>
                    {q.status.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pc-text)" }}>
                    {q.priceMin.toLocaleString()} ~ {q.priceMax.toLocaleString()} 원
                  </span>
                </div>
                <div className="pc-mono" style={{ fontSize: 12, color: "var(--pc-text-muted)" }}>
                  {new Date(q.createdAt).toLocaleString()}
                </div>
              </div>

              <div style={{ fontSize: 13, color: "var(--pc-text-muted)", marginBottom: 8 }}>
                예상 소요 시간: {q.etaMinHours} ~ {q.etaMaxHours} 시간
              </div>

              {q.finalPrice && (
                <div style={{ fontSize: 14, color: "var(--pc-success)", fontWeight: 700, marginBottom: 8, padding: 8, background: "var(--pc-success-soft)", borderRadius: "var(--pc-radius)" }}>
                  최종 확정액: {q.finalPrice.toLocaleString()} 원
                </div>
              )}
              
              {q.assumptionsKo && q.assumptionsKo.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pc-text-muted)", marginBottom: 4 }}>전제 조건:</div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--pc-text)", lineHeight: 1.6 }}>
                    {q.assumptionsKo?.map((asm: string, idx: number) => <li key={idx}>{asm}</li>)}
                  </ul>
                </div>
              )}

              {q.status === "draft" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, background: "var(--pc-warning-soft)", padding: 16, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-warning)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pc-text)" }}>최종 견적 확정</div>
                  <input type="number" placeholder="최종 금액 (원)" value={finalizeQuotePrice || ""} onChange={e => setFinalizeQuotePrice(Number(e.target.value))} className="pc-input" />
                  <input placeholder="추가 전제 조건 (쉼표로 구분)" value={finalizeQuoteAssumptions} onChange={e => setFinalizeQuoteAssumptions(e.target.value)} className="pc-input" />
                  <button onClick={() => finalizeQuote(q.id)} disabled={busy || !finalizeQuotePrice} className="pc-btn" style={{ background: "var(--pc-warning)", color: "#fff", borderColor: "var(--pc-warning)" }}>
                    확정하기
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
