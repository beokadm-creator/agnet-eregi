import { useState } from "react";
import { Button } from "@agentregi/ui-components";
import { auth } from "@rp/firebase";
import { getApiBaseUrl } from "../../apiBase";

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

  async function getToken(): Promise<string> {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) throw new Error("인증 토큰이 필요합니다.");
    return token;
  }

  const downloadSubmissionPackage = async () => {
    try {
      const token = await getToken();
      const apiBase = getApiBaseUrl();
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
      const token = await getToken();
      const apiBase = getApiBaseUrl();
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
      const token = await getToken();
      const apiBase = getApiBaseUrl();
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
    <div style={{ padding: 24, border: "1px solid var(--ar-success-soft)", borderRadius: "var(--ar-r1)", background: "var(--ar-success-soft)", textAlign: "center" }}>
      <h3 style={{ margin: "0 0 16px 0", color: "var(--ar-success)" }}>✅ 케이스 완료 (completed)</h3>
      <div style={{ color: "var(--ar-graphite)", marginBottom: 20 }}>
        모든 작업이 성공적으로 완료되었습니다. 아래에서 최종 서류와 리포트를 다운로드하세요.
      </div>

      <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
        <Button 
          onClick={downloadSubmissionPackage} 
          disabled={busy} 
          style={{ padding: "12px 24px", fontSize: 16, background: "var(--ar-accent)", color: "var(--ar-canvas)", border: "none", borderRadius: "var(--ar-r1)", cursor: "pointer", fontWeight: "bold" }}
        >
          제출 패키지 (ZIP)
        </Button>
        <Button 
          onClick={downloadClosingReport} 
          disabled={busy} 
          style={{ padding: "12px 24px", fontSize: 16, background: "var(--ar-canvas)", color: "var(--ar-accent)", border: "1px solid var(--ar-accent)", borderRadius: "var(--ar-r1)", cursor: "pointer", fontWeight: "bold" }}
        >
          종료 리포트 (DOCX)
        </Button>
      </div>

      <div style={{ marginTop: 16 }}>
        <Button
          onClick={validatePackage}
          disabled={busy || validating}
          style={{ padding: "8px 16px", fontSize: 14, background: "var(--ar-canvas)", color: "var(--ar-success)", border: "1px solid var(--ar-success-soft)", borderRadius: "var(--ar-r1)", cursor: "pointer", fontWeight: "bold" }}
        >
          {validating ? "검증 중..." : "ZIP 포함 파일 검증"}
        </Button>
      </div>

      {validationError && (
        <div style={{ marginTop: 12, padding: 8, background: "var(--ar-danger-soft)", border: "1px solid var(--ar-danger-soft)", color: "var(--ar-danger)", borderRadius: "var(--ar-r1)", fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>검증 오류:</strong> {validationError}
            </div>
            <Button 
              onClick={handleCopyEvidence}
              style={{ padding: "4px 8px", fontSize: 12, background: copied ? "var(--ar-success)" : "var(--ar-canvas)", color: copied ? "var(--ar-canvas)" : "var(--ar-accent)", border: `1px solid ${copied ? "var(--ar-success)" : "var(--ar-accent)"}`, borderRadius: "var(--ar-r1)", cursor: "pointer" }}
            >
              {copied ? "복사됨!" : "에러 복사"}
            </Button>
          </div>
          <div style={{ marginTop: 8, fontWeight: "bold" }}>다음 액션 가이드:</div>
          <div>서류 업로드 상태를 확인한 후 다시 검증을 시도해주세요.</div>
          {requestId && <div style={{ fontSize: 11, color: "var(--ar-slate)", marginTop: 4 }}>Request ID: {requestId}</div>}
        </div>
      )}

      {validation && (
        <div style={{ marginTop: 12, textAlign: "left", background: "var(--ar-canvas)", border: `1px solid ${validation.ok ? "var(--ar-success-soft)" : "var(--ar-danger-soft)"}`, borderRadius: "var(--ar-r1)", padding: 12, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700, color: validation.ok ? "var(--ar-success)" : "var(--ar-danger)" }}>
              {validation.ok ? "✅ signed/ 및 접수증 포함 확인됨" : "⚠️ 누락된 파일이 있습니다"}
            </div>
            <Button 
              onClick={handleCopyEvidence}
              style={{ padding: "4px 8px", fontSize: 12, background: copied ? "var(--ar-success)" : "var(--ar-canvas)", color: copied ? "var(--ar-canvas)" : "var(--ar-accent)", border: `1px solid ${copied ? "var(--ar-success)" : "var(--ar-accent)"}`, borderRadius: "var(--ar-r1)", cursor: "pointer" }}
            >
              {copied ? "복사됨!" : "증거 복사"}
            </Button>
          </div>
          {evidenceId && (
            <div style={{ fontSize: 11, color: "var(--ar-slate)", marginBottom: 8 }}>
              Evidence ID: {evidenceId}
              {requestId && <span style={{ marginLeft: 8 }}>| Request ID: {requestId}</span>}
            </div>
          )}
          {Array.isArray(validation.missing) && validation.missing.length > 0 && (
            <div style={{ marginBottom: 12, background: "var(--ar-danger-soft)", padding: 8, borderRadius: "var(--ar-r1)", border: "1px solid var(--ar-danger-soft)" }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--ar-danger)" }}>다음 액션 가이드:</div>
              <div style={{ color: "var(--ar-danger)", marginBottom: 8 }}>누락된 서명본/접수증을 업로드한 뒤 다시 'ZIP 포함 파일 검증'을 눌러주세요.</div>
              <ul style={{ margin: 0, paddingLeft: 20, color: "var(--ar-danger)" }}>
                {validation.missing?.map((slot: string) => (
                  <li key={slot}>
                    {getSlotLabel(slot)} <span style={{ fontSize: "0.8em", color: "var(--ar-danger)" }}>({slot})</span>
                    <div style={{ fontSize: "0.85em", color: "var(--ar-graphite)", marginTop: 2 }}>
                      👉 {slot.includes("receipt") ? "접수증 영역에서" : "서명본 패널에서"} 파일을 확인하고 다시 업로드해주세요.
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ color: "var(--ar-graphite)" }}>
            접수증: {validation.filingReceipt?.status} / storage: {validation.filingReceipt?.exists ? "ok" : "missing"}
          </div>
        </div>
      )}
    </div>
  );
}
export default CompletionPanel;
