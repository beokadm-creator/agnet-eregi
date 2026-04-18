import { useState } from "react";
import { apiPost } from "../../api";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "@rp/firebase";

interface Props {
  caseId: string;
  slotId: string;
  label?: string;
  autoReviewDecision?: "ok" | "needs_fix" | "manual"; // "manual" shows radio buttons
  onSuccess?: () => void;
  onLog: (msg: string) => void;
  disabled?: boolean;
}

export function DocumentUploadWidget({ caseId, slotId, label, autoReviewDecision = "ok", onSuccess, onLog, disabled }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);
  
  // Manual review state
  const [reviewDecision, setReviewDecision] = useState<"ok" | "needs_fix">("ok");
  const [issueCodes, setIssueCodes] = useState("");
  const [issueSummaries, setIssueSummaries] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    if (autoReviewDecision === "manual" && reviewDecision === "needs_fix") {
      if (!issueCodes.trim() && !issueSummaries.trim()) {
        setError("보완 요청 사유(이슈 코드 또는 사유 요약)를 최소 1개 이상 입력해주세요.");
        return;
      }
    }

    setUploading(true);
    setError(null);
    setProgressText("1/4 인텐트 생성 중...");

    try {
      // 1. Intent
      const res = await apiPost(`/v1/cases/${caseId}/documents/upload-intent`, {
        slotId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size
      });
      const { documentId, versionId, storagePath } = res.data;
      
      setProgressText("2/4 파일 업로드 중...");
      // 2. Storage Upload
      await uploadBytes(storageRef(storage, storagePath), file, { contentType: file.type });

      setProgressText("3/4 업로드 확정 중...");
      // 3. Complete
      await apiPost(`/v1/cases/${caseId}/documents/${documentId}/versions/${versionId}/complete`, {
        sha256: "client_sha256",
        sizeBytes: file.size
      });

      // 4. Review
      const finalDecision = autoReviewDecision === "manual" ? reviewDecision : autoReviewDecision;
      setProgressText(`4/4 문서 검토(${finalDecision}) 중...`);
      await apiPost(`/v1/cases/${caseId}/documents/${documentId}/review`, {
        decision: finalDecision,
        issueCodes: finalDecision === "needs_fix" ? issueCodes.split(",").map(s => s.trim()).filter(Boolean) : [],
        issueSummariesKo: finalDecision === "needs_fix" ? issueSummaries.split(",").map(s => s.trim()).filter(Boolean) : []
      });

      setProgressText("업로드 완료!");
      onLog(`Upload and complete for ${slotId} successful. (${finalDecision})`);
      if (onSuccess) onSuccess();
      
      // Reset after a short delay
      setTimeout(() => {
        setFile(null);
        setProgressText(null);
        setReviewDecision("ok");
        setIssueCodes("");
        setIssueSummaries("");
      }, 2000);

    } catch (e: any) {
      const msg = String(e?.message || e);
      setError(`실패: ${msg}`);
      onLog(`Upload failed for ${slotId}: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const isNeedsFixValid = reviewDecision !== "needs_fix" || (issueCodes.trim() !== "" || issueSummaries.trim() !== "");
  const disableUpload = disabled || uploading || !file || (autoReviewDecision === "manual" && !isNeedsFixValid);
  const validationError =
    autoReviewDecision === "manual" && file && reviewDecision === "needs_fix" && !isNeedsFixValid
      ? "보완 요청 사유(이슈 코드 또는 사유 요약)를 최소 1개 이상 입력해주세요."
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, background: "#fff", padding: 12, border: "1px solid #eee", borderRadius: 6 }}>
      {label && <div style={{ fontWeight: 600, color: "#333" }}>{label}</div>}
      
      <input 
        type="file" 
        onChange={e => {
          setFile(e.target.files?.[0] || null);
          setError(null);
        }} 
        disabled={disabled || uploading} 
      />
      
      {autoReviewDecision === "manual" && file && (
        <div style={{ marginTop: 8, padding: 12, background: "#fafafa", borderRadius: 6, border: "1px solid #e8e8e8" }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>제출 전 검토 판정</div>
          <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input 
                type="radio" 
                name={`review-${slotId}`} 
                checked={reviewDecision === "ok"} 
                onChange={() => setReviewDecision("ok")} 
                disabled={disabled || uploading}
              />
              승인 (ok)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input 
                type="radio" 
                name={`review-${slotId}`} 
                checked={reviewDecision === "needs_fix"} 
                onChange={() => setReviewDecision("needs_fix")} 
                disabled={disabled || uploading}
              />
              보완 요청 (needs_fix)
            </label>
          </div>
          
          {reviewDecision === "needs_fix" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ width: 60 }}>이슈 코드</span>
                <input 
                  value={issueCodes} 
                  onChange={e => {
                    setIssueCodes(e.target.value);
                    setError(null);
                  }} 
                  placeholder="예: ID_LEGIBILITY" 
                  style={{ flex: 1, padding: "4px 8px" }}
                  disabled={disabled || uploading}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ width: 60 }}>사유 요약</span>
                <input 
                  value={issueSummaries} 
                  onChange={e => {
                    setIssueSummaries(e.target.value);
                    setError(null);
                  }} 
                  placeholder="예: 사진 흐림" 
                  style={{ flex: 1, padding: "4px 8px" }}
                  disabled={disabled || uploading}
                />
              </label>
            </div>
          )}
        </div>
      )}

      {validationError && !error && (
        <div style={{ color: "#d4380d", background: "#fff2f0", padding: "6px 8px", borderRadius: 4, fontSize: 13 }}>
          {validationError}
        </div>
      )}

      {error && (
        <div style={{ color: "#d4380d", background: "#fff2f0", padding: "6px 8px", borderRadius: 4, fontSize: 13 }}>
          {error}
        </div>
      )}

      {progressText && !error && (
        <div style={{ color: "#1890ff", fontSize: 13 }}>
          {progressText}
        </div>
      )}
      
      <div style={{ display: "flex", gap: 8 }}>
        <button 
          onClick={handleUpload} 
          disabled={disableUpload} 
          style={{ 
            padding: "6px 12px", 
            background: disableUpload ? "#f5f5f5" : (reviewDecision === "needs_fix" ? "#faad14" : "#1890ff"), 
            color: disableUpload ? "#b8b8b8" : "#fff", 
            border: "1px solid #d9d9d9",
            borderRadius: 4,
            cursor: disableUpload ? "not-allowed" : "pointer",
            fontWeight: "bold"
          }}
        >
          {uploading ? "처리 중..." : (error ? "재시도" : (autoReviewDecision === "manual" && reviewDecision === "needs_fix" ? "업로드 및 보완 요청" : "업로드 및 승인 확정"))}
        </button>
      </div>
    </div>
  );
}
