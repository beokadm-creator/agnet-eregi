import { useState } from "react";
import { ensureLogin, apiBase } from "../../api";

interface Props {
  caseId: string;
  onLog: (msg: string) => void;
  busy: boolean;
}

export function CompletionPanel({ caseId, onLog, busy }: Props) {
  const [validation, setValidation] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
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
    try {
      const token = await ensureLogin();
      const resp = await fetch(`${apiBase}/v1/cases/${caseId}/packages/validate`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error?.messageKo || "검증 요청 실패");
      }
      setValidation(json.data);
      if (json.data.evidenceId) setEvidenceId(json.data.evidenceId);
      onLog("validated package presence");
    } catch (e: any) {
      const msg = String(e?.message || e);
      setValidationError(msg);
      onLog(`[오류] 패키지 검증 실패: ${msg}`);
    } finally {
      setValidating(false);
    }
  };

  const handleCopyEvidence = async () => {
    if (!evidenceId) return;
    const text = `[Pilot Gate] caseId: ${caseId} | evidenceId: ${evidenceId} | status: ✅ | missing: 0`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      onLog("복사 실패");
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
        <div style={{ marginTop: 12, color: "#cf1322", fontSize: 13 }}>
          검증 실패: {validationError}
        </div>
      )}

      {validation && (
        <div style={{ marginTop: 12, textAlign: "left", background: "#fff", border: "1px solid #d9f7be", borderRadius: 8, padding: 12, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700, color: validation.ok ? "#389e0d" : "#cf1322" }}>
              {validation.ok ? "✅ signed/ 및 접수증 포함 확인됨" : "⚠️ 누락된 파일이 있습니다"}
            </div>
            {validation.ok && evidenceId && (
              <button 
                onClick={handleCopyEvidence}
                style={{ padding: "4px 8px", fontSize: 12, background: copied ? "#52c41a" : "#fff", color: copied ? "#fff" : "#1890ff", border: `1px solid ${copied ? "#52c41a" : "#1890ff"}`, borderRadius: 4, cursor: "pointer" }}
              >
                {copied ? "복사됨!" : "증거 복사"}
              </button>
            )}
          </div>
          {evidenceId && (
            <div style={{ fontSize: 11, color: "#8c8c8c", marginBottom: 8 }}>
              Evidence ID: {evidenceId}
            </div>
          )}
          {Array.isArray(validation.missing) && validation.missing.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>누락:</div>
              <div style={{ color: "#cf1322" }}>{validation.missing.join(", ")}</div>
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
