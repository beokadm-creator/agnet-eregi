import React, { useState, useEffect, useCallback } from "react";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

interface Transitions {
  caseId: string;
  currentStatus: string;
  allowedEvents: string[];
}

const EVENT_LABELS: Record<string, string> = {
  SUBMIT_DOCS: "서류 제출",
  APPROVE_ALL_DOCS: "전체 서류 승인",
  REQUEST_REVISION: "수정 요청",
  COMPLETE_FILING: "등기 완료 처리",
};

const STATUS_LABELS: Record<string, string> = {
  draft_filing: "초안 작성 중",
  under_review: "서류 검토 중",
  awaiting_payment: "결제 대기 중",
  filing_submitted: "등기 신청 완료",
  completed: "등기 완료",
  needs_revision: "수정 요청",
};

const PRIMARY_EVENTS = new Set(["APPROVE_ALL_DOCS", "COMPLETE_FILING"]);

export default function WorkflowTransitions() {
  const { selectedCase, busy, setBusy, setLog, loadCaseDetail, actingPartnerId, claims } = useAppContext();
  const [transitions, setTransitions] = useState<Transitions | null>(null);

  const partnerId = actingPartnerId || (claims?.partnerId ? String(claims.partnerId) : "");

  const loadTransitions = useCallback(async () => {
    if (!selectedCase) return;
    try {
      const api = getApi();
      api.actingPartnerId = partnerId;
      const res = await api.get(`/v1/cases/${selectedCase.id}/transitions`);
      setTransitions(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "워크플로우 상태 로드 실패";
      setLog(`[Error] ${msg}`);
    }
  }, [selectedCase, partnerId, setLog]);

  useEffect(() => {
    loadTransitions();
  }, [loadTransitions]);

  if (!selectedCase || !transitions) return null;

  async function fireEvent(event: string) {
    setBusy(true);
    setLog(`상태 전환 중: ${EVENT_LABELS[event] || event}...`);
    try {
      const api = getApi();
      api.actingPartnerId = partnerId;
      await api.post(`/v1/cases/${selectedCase.id}/events`, { event, payload: {} });
      setLog(`${EVENT_LABELS[event] || event} 완료.`);
      await loadTransitions();
      await loadCaseDetail(selectedCase.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "상태 전환 실패";
      setLog(`[Error] ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  const isPrimary = (event: string) => PRIMARY_EVENTS.has(event);
  const isRevision = (event: string) => event === "REQUEST_REVISION";

  return (
    <div className="pc-card" style={{ marginBottom: 24 }}>
      <div className="pc-card-header" style={{ borderBottom: "1px solid var(--pc-border)", paddingBottom: 16, marginBottom: 16 }}>
        <h3 className="pc-card-title" style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>⚙️</span> 워크플로우 상태
        </h3>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, background: "var(--pc-surface)", padding: "12px 16px", borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
        <span style={{ fontSize: 14, color: "var(--pc-text-muted)", fontWeight: 600 }}>현재 상태:</span>
        <span className="pc-badge pc-badge-neutral" style={{ fontSize: 14 }}>
          {STATUS_LABELS[transitions.currentStatus] || transitions.currentStatus}
        </span>
      </div>

      {transitions.allowedEvents.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", background: "var(--pc-bg)", padding: 16, borderRadius: "var(--pc-radius)", border: "1px dashed var(--pc-border)" }}>
          <span style={{ fontSize: 13, color: "var(--pc-text-muted)", display: "flex", alignItems: "center", width: "100%" }}>가능한 액션:</span>
          {transitions.allowedEvents.map((event) => (
            <button
              key={event}
              onClick={() => fireEvent(event)}
              disabled={busy}
              className="pc-btn"
              style={{
                background: isRevision(event)
                  ? "var(--pc-warning)"
                  : isPrimary(event)
                    ? "var(--pc-brand)"
                    : "var(--pc-surface)",
                color: isPrimary(event) || isRevision(event) ? "#fff" : "var(--pc-text)",
                borderColor: isRevision(event)
                  ? "var(--pc-warning)"
                  : isPrimary(event)
                    ? "var(--pc-brand)"
                    : "var(--pc-border)",
              }}
            >
              {EVENT_LABELS[event] || event}
            </button>
          ))}
        </div>
      )}

      {transitions.allowedEvents.length === 0 && (
        <div style={{ color: "var(--pc-text-muted)", fontSize: 13, textAlign: "center", padding: 16, background: "var(--pc-surface)", borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
          현재 실행 가능한 상태 전환 액션이 없습니다.
        </div>
      )}
    </div>
  );
}
