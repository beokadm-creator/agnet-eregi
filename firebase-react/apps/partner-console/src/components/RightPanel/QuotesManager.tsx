import { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
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
      const assumptions = finalizeQuoteAssumptions.split(",").map(s => s.trim()).filter(Boolean);
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
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1em", borderBottom: "1px solid var(--ar-surface-muted)", paddingBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>💰 견적 관리 (Quotes)</span>
        <Button 
          onClick={generateAIAssistantQuote} 
          disabled={busy} 
          style={{ background: "var(--ar-accent)", color: "var(--ar-canvas)", border: "none", padding: "4px 8px", borderRadius: "var(--ar-r1)", cursor: "pointer", fontSize: "0.85em", fontWeight: "bold" }}
        >
          🤖 AI로 초안 생성
        </Button>
      </h3>
      
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", background: "var(--ar-paper-alt)", padding: 12, borderRadius: "var(--ar-r1)" }}>
        <h4 style={{ margin: "0 0 8px 0", width: "100%", fontSize: "0.95em" }}>견적 제안 (Draft) 생성</h4>
        <Input type="number" placeholder="최소 금액" value={newQuotePriceMin || ""} onChange={e => setNewQuotePriceMin(Number(e.target.value))} style={{ flex: 1, padding: 6, minWidth: 100 }} />
        <Input type="number" placeholder="최대 금액" value={newQuotePriceMax || ""} onChange={e => setNewQuotePriceMax(Number(e.target.value))} style={{ flex: 1, padding: 6, minWidth: 100 }} />
        <Input type="number" placeholder="최소 소요시간(hr)" value={newQuoteEtaMin || ""} onChange={e => setNewQuoteEtaMin(Number(e.target.value))} style={{ flex: 1, padding: 6, minWidth: 100 }} />
        <Input type="number" placeholder="최대 소요시간(hr)" value={newQuoteEtaMax || ""} onChange={e => setNewQuoteEtaMax(Number(e.target.value))} style={{ flex: 1, padding: 6, minWidth: 100 }} />
        <Button onClick={createQuoteDraft} disabled={busy || !newQuotePriceMin || !newQuotePriceMax} style={{ padding: "6px 12px", background: "var(--ar-accent)", color: "var(--ar-canvas)", border: "none", borderRadius: "var(--ar-r1)", cursor: "pointer", fontWeight: "bold" }}>
          제안 생성
        </Button>
      </div>

      {quotes.length === 0 ? (
        <div style={{ color: "var(--ar-slate)", fontSize: "0.9em" }}>견적 이력이 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {quotes.map(q => (
            <div key={q.id} style={{ padding: 12, border: "1px solid var(--ar-surface-muted)", borderRadius: "var(--ar-r1)", background: "var(--ar-canvas)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <span style={{ fontWeight: "bold", marginRight: 8 }}>
                    {q.status === "draft" ? "제안됨 (Draft)" : q.status === "finalized" ? "확정됨 (Finalized)" : q.status === "accepted" ? "동의 완료 (Accepted)" : q.status}
                  </span>
                  <span style={{ fontSize: "0.85em", color: "var(--ar-graphite)" }}>
                    {q.priceMin.toLocaleString()} ~ {q.priceMax.toLocaleString()} 원 ({q.etaMinHours}~{q.etaMaxHours}시간)
                  </span>
                </div>
                <div style={{ fontSize: "0.8em", color: "var(--ar-slate)" }}>
                  {new Date(q.createdAt).toLocaleString()}
                </div>
              </div>

              {q.finalPrice && (
                <div style={{ fontSize: "0.9em", color: "var(--ar-warning)", fontWeight: "bold", marginBottom: 4 }}>
                  최종 확정액: {q.finalPrice.toLocaleString()} 원
                </div>
              )}
              
              {q.assumptionsKo && q.assumptionsKo.length > 0 && (
                <ul style={{ margin: "4px 0 8px 0", paddingLeft: 20, fontSize: "0.85em", color: "var(--ar-graphite)" }}>
                  {q.assumptionsKo.map((asm: string, idx: number) => <li key={idx}>{asm}</li>)}
                </ul>
              )}

              {q.status === "draft" && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, background: "var(--ar-warning-soft)", padding: 8, borderRadius: "var(--ar-r1)" }}>
                  <Input type="number" placeholder="최종 확정 금액" value={finalizeQuotePrice || ""} onChange={e => setFinalizeQuotePrice(Number(e.target.value))} style={{ flex: 1, padding: 6 }} />
                  <Input placeholder="전제 조건 (쉼표로 구분)" value={finalizeQuoteAssumptions} onChange={e => setFinalizeQuoteAssumptions(e.target.value)} style={{ flex: 2, padding: 6 }} />
                  <Button onClick={() => finalizeQuote(q.id)} disabled={busy || !finalizeQuotePrice} style={{ padding: "6px 12px", background: "var(--ar-warning)", color: "var(--ar-canvas)", border: "none", borderRadius: "var(--ar-r1)", cursor: "pointer", fontSize: "0.9em" }}>
                    최종 확정하기
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
