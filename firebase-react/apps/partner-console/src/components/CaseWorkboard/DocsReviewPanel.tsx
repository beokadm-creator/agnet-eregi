import { useState } from "react";
import { apiPost } from "../../api";
import { InlineError } from "./InlineError";

interface Props {
  caseId: string;
  documents: any[];
  onLog: (msg: string) => void;
  onRefresh: () => void;
  busy: boolean;
}

export function DocsReviewPanel({ caseId, documents, onLog, onRefresh, busy }: Props) {
  const [selectedDocId, setSelectedDocId] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"ok" | "needs_fix">("needs_fix");
  const [issueCodes, setIssueCodes] = useState("");
  const [issueSummaries, setIssueSummaries] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleReview = async () => {
    if (!selectedDocId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiPost(`/v1/cases/${caseId}/documents/${selectedDocId}/review`, {
        decision: reviewDecision,
        issueCodes: issueCodes.split(",").map((s) => s.trim()).filter(Boolean),
        issueSummariesKo: issueSummaries.split(",").map((s) => s.trim()).filter(Boolean)
      });
      onLog(`document reviewed: ${data.status}`);
      onRefresh();
    } catch (e: any) {
      const msg = String(e?.message || e);
      onLog(`[오류] 문서 검토 실패: ${msg}`);
      setErrorMsg(`검토 반영 중 오류가 발생했습니다: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}>
      <h3 style={{ margin: "0 0 12px 0" }}>문서 검토 (docs_review)</h3>
      <div style={{ color: "#666", marginBottom: 12, fontSize: 14 }}>
        업로드된 필수 서류들을 검토하고, 문제가 있으면 needs_fix로 상태를 변경하여 사용자에게 보완을 요청합니다.
      </div>
      
      {errorMsg && (
        <InlineError message={errorMsg} onClose={() => setErrorMsg(null)} onRetry={handleReview} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>문서 목록</h4>
          {documents.length === 0 ? (
            <div style={{ fontSize: 14, color: "#999" }}>업로드된 문서가 없습니다.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14 }}>
              {documents.map((d) => (
                <li key={d.documentId} style={{ padding: 8, border: "1px solid #eee", marginBottom: 4, borderRadius: 4, background: selectedDocId === d.documentId ? "#e6f7ff" : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{d.slotId}</strong>
                    <span style={{ color: d.status === "ok" ? "green" : d.status === "needs_fix" ? "red" : "#666" }}>{d.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>ID: {d.documentId}</div>
                  <button 
                    onClick={() => setSelectedDocId(d.documentId)}
                    style={{ marginTop: 8, padding: "4px 8px", fontSize: 12 }}
                  >
                    검토하기
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ background: "#fafafa", padding: 12, borderRadius: 6 }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>검토 액션</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 80 }}>선택 문서:</span>
              <input value={selectedDocId} readOnly style={{ flex: 1, padding: 6, background: "#eee" }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 80 }}>판정:</span>
              <select value={reviewDecision} onChange={(e) => setReviewDecision(e.target.value as any)} style={{ flex: 1, padding: 6 }}>
                <option value="ok">ok (승인)</option>
                <option value="needs_fix">needs_fix (보완요청)</option>
              </select>
            </label>
            {reviewDecision === "needs_fix" && (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 80 }}>이슈 코드:</span>
                  <input value={issueCodes} onChange={(e) => setIssueCodes(e.target.value)} placeholder="예: ID_LEGIBILITY" style={{ flex: 1, padding: 6 }} />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 80 }}>사유 요약:</span>
                  <input value={issueSummaries} onChange={(e) => setIssueSummaries(e.target.value)} placeholder="예: 신분증 흐림" style={{ flex: 1, padding: 6 }} />
                </label>
              </>
            )}
            <button 
              disabled={busy || loading || !selectedDocId} 
              onClick={handleReview}
              style={{ marginTop: 8, padding: 8, background: "#1890ff", color: "#fff", border: "none", borderRadius: 4 }}
            >
              검토 결과 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
