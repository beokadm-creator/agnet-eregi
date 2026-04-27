import { useState } from "react";
import { ensureLogin, apiBase } from "../../api";

interface Props {
  caseId: string;
  onLog: (msg: string) => void;
  busy: boolean;
}

const slotLabelMap: Record<string, string> = {
  "slot_corp_seal_cert": "법인인감증명서",
  "slot_corp_registry": "법인등기부등본",
  "slot_minutes_signed": "의사록 (서명본)",
  "slot_power_of_attorney_signed": "위임장 (서명본)",
  "slot_filing_receipt": "접수증",
  "slot_resignation_letter_signed": "사임서 (서명본)",
  "slot_acceptance_letter_signed": "취임승낙서 (서명본)"
};

function getSlotLabel(slotId: string): string {
  return slotLabelMap[slotId] || slotId;
}

export function CompletionPanel({ caseId, onLog, busy }: Props) {
  const [validation, setValidation] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const downloadSubmissionPackage = async () => {
    try {
      const token = await ensureLogin();
      const resp = await fetch(`${apiBase}/v1/cases/${caseId}/packages/submission.zip`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        const json = await resp.json().catch(() => null);
        throw new Error(json?.error?.messageKo || "다운로드 실패");
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `submission_package_${caseId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onLog("downloaded submission package");
    } catch (e: any) {
      onLog(String(e?.message || e));
    }
  };

  const downloadClosingReport = async () => {
    try {
      const token = await ensureLogin();
      const resp = await fetch(`${apiBase}/v1/cases/${caseId}/reports/closing.docx`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        const json = await resp.json().catch(() => null);
        throw new Error(json?.error?.messageKo || "다운로드 실패");
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `closing_report_${caseId}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onLog("downloaded closing report");
    } catch (e: any) {
      onLog(String(e?.message || e));
    }
  };

  const validatePackage = async () => {
    setValidating(true);
    setValidation(null);
    setValidationError(null);
    setRequestId(null);
    try {
      const token = await ensureLogin();
      const resp = await fetch(`${apiBase}/v1/cases/${caseId}/packages/validate`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });
      const reqId = resp.headers.get("X-Request-Id") || "unknown";
      setRequestId(reqId);
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.ok) {
        if (json?.error?.requestId) setRequestId(json.error.requestId);
        throw new Error(json?.error?.messageKo || "검증 요청 실패");
      }
      setValidation(json.data);
      if (json.data.evidenceId) setEvidenceId(json.data.evidenceId);
      onLog(`validated package presence (requestId: ${reqId})`);
    } catch (e: any) {
      const msg = String(e?.message || e);
      setValidationError(msg);
      onLog(`[오류] 패키지 검증 실패: ${msg}`);
    } finally {
      setValidating(false);
    }
  };

  const handleCopyEvidence = async () => {
    if (!validation && !validationError) return;
    const evId = evidenceId || validation?.evidenceId || "unknown";
    const ok = validation?.ok ?? false;
    const missingCount = Array.isArray(validation?.missing) ? validation.missing.length : 0;
    const reqId = requestId || "N/A";
    
    let text = `[Pilot Gate] caseId: ${caseId} | evidenceId: ${evId} | status: ${ok ? "✅" : "❌"} | missingCount: ${missingCount} | requestId: ${reqId}`;
    if (!ok && missingCount > 0) {
      text += ` | missing: ${validation.missing.join(",")}`;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onLog("증거 복사 완료");
    } catch (e) {
      onLog("증거 복사 실패");
    }
  };

  return (
    <div style={{ padding: 24, border: "1px solid #b7eb8f", borderRadius: 8, background: "#f6ffed", textAlign: "center" }}>
      <h3 style={{ margin: "0 0 16px 0", color: "#389e0d" }}>✅ 케이스 완료 (completed)</h3>
      <div style={{ color: "#666", marginBottom: 20 }}>
        모든 작업이 성공적으로 완료되었습니다. 아래에서 최종 서류와 리포트를 다운로드하세요.
      </div>

      <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
        <button 
          onClick={downloadSubmissionPackage} 
          disabled={busy} 
          style={{ padding: "12px 24px", fontSize: 16, background: "#1890ff", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}
        >
          제출 패키지 (ZIP)
        </button>
        <button 
          onClick={downloadClosingReport} 
          disabled={busy} 
          style={{ padding: "12px 24px", fontSize: 16, background: "#fff", color: "#1890ff", border: "1px solid #1890ff", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}
        >
          종료 리포트 (DOCX)
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          onClick={validatePackage}
          disabled={busy || validating}
          style={{ padding: "8px 16px", fontSize: 14, background: "#fff", color: "#389e0d", border: "1px solid #b7eb8f", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}
        >
          {validating ? "검증 중..." : "ZIP 포함 파일 검증"}
        </button>
      </div>

      {validationError && (
        <div style={{ marginTop: 12, padding: 8, background: "#fff1f0", border: "1px solid #ffccc7", color: "#cf1322", borderRadius: 4, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>검증 오류:</strong> {validationError}
            </div>
            <button 
              onClick={handleCopyEvidence}
              style={{ padding: "4px 8px", fontSize: 12, background: copied ? "#52c41a" : "#fff", color: copied ? "#fff" : "#1890ff", border: `1px solid ${copied ? "#52c41a" : "#1890ff"}`, borderRadius: 4, cursor: "pointer" }}
            >
              {copied ? "복사됨!" : "에러 복사"}
            </button>
          </div>
          <div style={{ marginTop: 8, fontWeight: "bold" }}>다음 액션 가이드:</div>
          <div>서류 업로드 상태를 확인한 후 다시 검증을 시도해주세요.</div>
          {requestId && <div style={{ fontSize: 11, color: "#8c8c8c", marginTop: 4 }}>Request ID: {requestId}</div>}
        </div>
      )}

      {validation && (
        <div style={{ marginTop: 12, textAlign: "left", background: "#fff", border: `1px solid ${validation.ok ? "#d9f7be" : "#ffa39e"}`, borderRadius: 8, padding: 12, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700, color: validation.ok ? "#389e0d" : "#cf1322" }}>
              {validation.ok ? "✅ signed/ 및 접수증 포함 확인됨" : "⚠️ 누락된 파일이 있습니다"}
            </div>
            <button 
              onClick={handleCopyEvidence}
              style={{ padding: "4px 8px", fontSize: 12, background: copied ? "#52c41a" : "#fff", color: copied ? "#fff" : "#1890ff", border: `1px solid ${copied ? "#52c41a" : "#1890ff"}`, borderRadius: 4, cursor: "pointer" }}
            >
              {copied ? "복사됨!" : "증거 복사"}
            </button>
          </div>
          {evidenceId && (
            <div style={{ fontSize: 11, color: "#8c8c8c", marginBottom: 8 }}>
              Evidence ID: {evidenceId}
              {requestId && <span style={{ marginLeft: 8 }}>| Request ID: {requestId}</span>}
            </div>
          )}
          {Array.isArray(validation.missing) && validation.missing.length > 0 && (
            <div style={{ marginBottom: 12, background: "#fff1f0", padding: 8, borderRadius: 4, border: "1px solid #ffccc7" }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: "#cf1322" }}>다음 액션 가이드:</div>
              <div style={{ color: "#cf1322", marginBottom: 8 }}>누락된 서명본/접수증을 업로드한 뒤 다시 ‘ZIP 포함 파일 검증’을 눌러주세요.</div>
              <ul style={{ margin: 0, paddingLeft: 20, color: "#cf1322" }}>
                {validation.missing.map((slot: string) => (
                  <li key={slot}>
                    {getSlotLabel(slot)} <span style={{ fontSize: "0.8em", color: "#ff4d4f" }}>({slot})</span>
                    <div style={{ fontSize: "0.85em", color: "#666", marginTop: 2 }}>
                      👉 {slot.includes("receipt") ? "접수증 영역에서" : "서명본 패널에서"} 파일을 확인하고 다시 업로드해주세요.
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ color: "#666" }}>
            접수증: {validation.filingReceipt?.status} / storage: {validation.filingReceipt?.exists ? "ok" : "missing"}
          </div>
        </div>
      )}
    </div>
  );
}
export default CompletionPanel;
