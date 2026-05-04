import React, { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

export default function EvidencesManager() {
  const { evidences, selectedCase, expandedEvidenceId, setExpandedEvidenceId, busy, setBusy, setLog, loadCaseDetail } = useAppContext();
  
  const [newEvidenceType, setNewEvidenceType] = useState("");
  const [newEvidenceFile, setNewEvidenceFile] = useState<File | null>(null);

  if (!selectedCase) return null;

  async function addEvidence() {
    if (!newEvidenceType || !newEvidenceFile || !selectedCase) return;
    setBusy(true);
    setLog("증거물 업로드 중...");
    try {
      const { uploadUrl, evidenceId } = await getApi().post(`/v1/partner/cases/${selectedCase.id}/evidences/upload-url`, {
        type: newEvidenceType,
        filename: newEvidenceFile.name,
        contentType: newEvidenceFile.type,
        sizeBytes: newEvidenceFile.size
      });

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": newEvidenceFile.type },
        body: newEvidenceFile
      });
      if (!uploadRes.ok) throw new Error("Storage 업로드에 실패했습니다.");

      await getApi().post(`/v1/partner/cases/${selectedCase.id}/evidences/${evidenceId}/complete`, {});
      setLog("증거물 업로드 완료");
      setNewEvidenceType("");
      setNewEvidenceFile(null);
      await loadCaseDetail(selectedCase.id);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadEvidence(evidenceId: string) {
    if (!selectedCase) return;
    setBusy(true);
    setLog(`증거물 다운로드 링크 생성 중...`);
    try {
      const res = await getApi().post(`/v1/partner/cases/${selectedCase.id}/evidences/${evidenceId}/download-url`, {});
      window.open(res.downloadUrl, "_blank");
      setLog("다운로드 창을 열었습니다.");
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function runAiReview(evidenceId: string) {
    if (!selectedCase) return;
    setBusy(true);
    setLog("AI 검토 생성 중...");
    try {
      await getApi().post(`/v1/partner/cases/${selectedCase.id}/evidences/${evidenceId}/ai/review`, {});
      setLog("AI 검토 생성 완료");
      await loadCaseDetail(selectedCase.id);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pc-card">
      <div className="pc-card-header" style={{ borderBottom: "1px solid var(--pc-border)", paddingBottom: 16, marginBottom: 16 }}>
        <h3 className="pc-card-title" style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📁</span> 증거물 목록
        </h3>
      </div>
      
      <div style={{ display: "flex", gap: 8, marginBottom: 16, background: "var(--pc-surface)", padding: 12, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
        <select value={newEvidenceType} onChange={e => setNewEvidenceType(e.target.value)} className="pc-input" style={{ flex: 1 }}>
          <option value="">-- 유형 선택 --</option>
          <option value="passport">여권 사본</option>
          <option value="bank_statement">은행 잔고 증명서</option>
          <option value="business_license">사업자 등록증</option>
        </select>
        <input 
          type="file"
          accept=".pdf,image/png,image/jpeg,image/jpg"
          onChange={e => setNewEvidenceFile(e.target.files?.[0] || null)} 
          className="pc-input"
          style={{ flex: 2 }} 
        />
        <button onClick={addEvidence} disabled={busy || !newEvidenceType || !newEvidenceFile} className="pc-btn pc-btn-brand">업로드</button>
      </div>

      {evidences.length === 0 ? (
        <div style={{ color: "var(--pc-text-muted)", fontSize: 13, textAlign: "center", padding: 24 }}>등록된 증거물이 없습니다.</div>
      ) : (
        <div style={{ border: "1px solid var(--pc-border)", borderRadius: "var(--pc-radius)", overflow: "hidden" }}>
          <table className="pc-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>유형</th>
                <th>파일명</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {evidences?.map(e => (
                <React.Fragment key={e.id}>
                  <tr 
                    style={{ cursor: "pointer", background: expandedEvidenceId === e.id ? "var(--pc-surface-active)" : "var(--pc-bg)" }}
                    onClick={() => setExpandedEvidenceId(expandedEvidenceId === e.id ? null : e.id)}
                  >
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ display: "inline-block", width: 16, fontSize: 10, color: "var(--pc-text-muted)" }}>
                        {expandedEvidenceId === e.id ? "▼" : "▶"}
                      </span>
                      {e.type}
                    </td>
                    <td>
                      {e.status === "pending" ? (
                        <span style={{ color: "var(--pc-text-muted)" }}>업로드 중...</span>
                      ) : (
                        <button onClick={(event) => { event.stopPropagation(); downloadEvidence(e.id); }} style={{ background: "transparent", border: "none", color: "var(--pc-brand)", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                          {e.filename || "다운로드"}
                        </button>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <span className={`pc-badge ${e.status === "validated" || e.status === "ai_verified" ? "pc-badge-success" : e.status === "failed" || e.status === "manual_review_required" ? "pc-badge-danger" : "pc-badge-warning"}`}>
                          {e.status.toUpperCase()}
                        </span>
                        {e.source === "user" && <span style={{ fontSize: 11, color: "var(--pc-brand)", fontWeight: 600 }}>USER UPLOAD</span>}
                      </div>
                    </td>
                  </tr>

                  {expandedEvidenceId === e.id && (
                    <tr>
                      <td colSpan={3} style={{ padding: 16, background: "var(--pc-surface)" }}>

                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                          <button onClick={(event) => { event.stopPropagation(); runAiReview(e.id); }} disabled={busy} className="pc-btn pc-btn-brand">AI 검토</button>
                        </div>
                        
                        {e.defectReasons && e.defectReasons.length > 0 && (
                          <div style={{ marginBottom: 12, padding: 16, background: "var(--pc-danger-soft)", borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-danger)" }}>
                            <h4 style={{ margin: "0 0 8px 0", color: "var(--pc-danger)", fontSize: 14, fontWeight: 700 }}>🚨 결함 사유 (검증 실패)</h4>
                            <ul style={{ margin: 0, paddingLeft: 20, color: "var(--pc-danger)", fontSize: 13, lineHeight: 1.6 }}>
                              {e.defectReasons?.map((reason: string, idx: number) => (
                                <li key={idx}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {e.aiReview && (
                          <div style={{ marginBottom: 12, padding: 16, background: "var(--pc-bg)", borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
                            <h4 style={{ margin: "0 0 8px 0", color: "var(--pc-text)", fontSize: 14, fontWeight: 700 }}>🤖 AI 검토</h4>
                            {e.aiReview.shortSummaryKo && <div style={{ fontSize: 13, color: "var(--pc-text)", marginBottom: 10 }}>{e.aiReview.shortSummaryKo}</div>}
                            {Array.isArray(e.aiReview.defectsKo) && e.aiReview.defectsKo.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pc-text-muted)", marginBottom: 6 }}>결함</div>
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                                  {e.aiReview.defectsKo.map((x: string, idx: number) => <li key={idx}>{x}</li>)}
                                </ul>
                              </div>
                            )}
                            {Array.isArray(e.aiReview.missingFieldsKo) && e.aiReview.missingFieldsKo.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pc-text-muted)", marginBottom: 6 }}>누락/보완</div>
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                                  {e.aiReview.missingFieldsKo.map((x: string, idx: number) => <li key={idx}>{x}</li>)}
                                </ul>
                              </div>
                            )}
                            {e.aiReview.suggestedRequestMessageKo && (
                              <div style={{ padding: 12, background: "var(--pc-surface)", borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)", fontSize: 13, lineHeight: 1.6 }}>
                                {e.aiReview.suggestedRequestMessageKo}
                              </div>
                            )}
                          </div>
                        )}

                        {e.aiExtraction && Object.keys(e.aiExtraction).length > 0 && (
                          <div style={{ padding: 16, background: "var(--pc-bg)", borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
                            <h4 style={{ margin: "0 0 12px 0", color: "var(--pc-text)", fontSize: 14, fontWeight: 700 }}>🤖 AI 인식 데이터</h4>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13, color: "var(--pc-text)" }}>
                              {Object.entries(e.aiExtraction)?.map(([key, data]: [string, any]) => (
                                <div key={key} style={{ background: "var(--pc-surface)", padding: "8px 12px", borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)", display: "flex", flexDirection: "column", gap: 4 }}>
                                  <strong style={{ color: "var(--pc-text-muted)", fontSize: 11, textTransform: "uppercase" }}>{key}</strong> 
                                  <div>
                                    {typeof data.value === "boolean" ? (data.value ? "Yes" : "No") : data.value}
                                    {data.confidence && <span style={{ marginLeft: 8, fontSize: 11, color: data.confidence < 0.8 ? "var(--pc-danger)" : "var(--pc-success)" }}>({(data.confidence * 100).toFixed(0)}%)</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(!e.defectReasons || e.defectReasons.length === 0) && (!e.aiReview) && (!e.aiExtraction || Object.keys(e.aiExtraction).length === 0) && (
                          <div style={{ color: "var(--pc-text-muted)", fontSize: 13, textAlign: "center", padding: 12 }}>
                            AI 분석 데이터가 없습니다.
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
