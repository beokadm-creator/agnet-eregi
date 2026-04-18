import { useState, useEffect } from "react";
import { apiPost } from "../../api";
import { DocumentUploadWidget } from "./DocumentUploadWidget";
import { InlineError } from "./InlineError";

interface Props {
  caseId: string;
  filing: any;
  documents: any[];
  onLog: (msg: string) => void;
  onRefresh: () => void;
  busy: boolean;
}

export function FilingSubmittedPanel({ caseId, filing, documents, onLog, onRefresh, busy }: Props) {
  const [localFiling, setLocalFiling] = useState({
    receiptNo: "",
    jurisdictionKo: "서울중앙지방법원",
    submittedDate: "2026-01-12",
    memoKo: ""
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (filing) {
      setLocalFiling({
        receiptNo: filing.receiptNo || "",
        jurisdictionKo: filing.jurisdictionKo || "서울중앙지방법원",
        submittedDate: filing.submittedDate || "2026-01-12",
        memoKo: filing.memoKo || ""
      });
    }
  }, [filing]);

  const saveFilingInfo = async () => {
    setErrorMsg(null);
    try {
      await apiPost(`/v1/cases/${caseId}/filing`, localFiling);
      onLog("접수 정보 저장 완료");
      onRefresh();
    } catch (e: any) {
      const msg = String(e?.message || e);
      onLog(`[오류] 접수 정보 저장 실패: ${msg}`);
      setErrorMsg(`접수 정보 저장 중 오류가 발생했습니다: ${msg}`);
    }
  };

  // We look for slot_filing_receipt (or any required slots that aren't signed)
  // For filing_submitted stage, typically slot_filing_receipt is required.
  const hasReceipt = documents.some(d => d.slotId === "slot_filing_receipt" && d.status === "ok");

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}>
      <h3 style={{ margin: "0 0 12px 0" }}>등기 제출 및 접수증 (filing_submitted)</h3>
      <div style={{ color: "#666", marginBottom: 12, fontSize: 14 }}>
        등기소 접수 정보를 입력하고, 접수증을 업로드하여 케이스를 완료 상태(completed)로 만듭니다.
      </div>

      {errorMsg && (
        <InlineError message={errorMsg} onClose={() => setErrorMsg(null)} onRetry={saveFilingInfo} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>접수 정보 입력</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 80 }}>접수번호</span>
              <input value={localFiling.receiptNo} onChange={e => setLocalFiling({...localFiling, receiptNo: e.target.value})} style={{ flex: 1, padding: 6 }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 80 }}>관할</span>
              <input value={localFiling.jurisdictionKo} onChange={e => setLocalFiling({...localFiling, jurisdictionKo: e.target.value})} style={{ flex: 1, padding: 6 }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 80 }}>접수일</span>
              <input value={localFiling.submittedDate} onChange={e => setLocalFiling({...localFiling, submittedDate: e.target.value})} style={{ flex: 1, padding: 6 }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 80 }}>메모</span>
              <input value={localFiling.memoKo} onChange={e => setLocalFiling({...localFiling, memoKo: e.target.value})} style={{ flex: 1, padding: 6 }} />
            </label>
            <button onClick={saveFilingInfo} disabled={busy} style={{ marginTop: 8, padding: 8, background: "#fafafa", border: "1px solid #ddd", borderRadius: 4 }}>저장</button>
          </div>
        </div>

        <div style={{ background: "#fafafa", padding: 12, borderRadius: 6 }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>접수증 업로드</h4>
          <div style={{ fontSize: 13, marginBottom: 12, color: hasReceipt ? "green" : "red" }}>
            {hasReceipt ? "✅ 접수증이 업로드되었습니다." : "접수증이 필요합니다."}
          </div>

          {!hasReceipt ? (
            <DocumentUploadWidget 
              caseId={caseId}
              slotId="slot_filing_receipt"
              label="접수증"
              autoReviewDecision="ok"
              onSuccess={onRefresh}
              onLog={onLog}
              disabled={busy}
            />
          ) : (
            <div style={{ padding: 8, border: "1px solid #b7eb8f", background: "#f6ffed", borderRadius: 4, fontSize: 13 }}>
              ✅ slot_filing_receipt (확보 완료)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
