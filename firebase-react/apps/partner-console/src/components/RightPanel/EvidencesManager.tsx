import React, { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
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

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1em", borderBottom: "1px solid var(--ar-surface-muted)", paddingBottom: 8 }}>📁 증거물 (Evidences)</h3>
      
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={newEvidenceType} onChange={e => setNewEvidenceType(e.target.value)} style={{ padding: 6 }}>
          <option value="">-- 유형 선택 --</option>
          <option value="passport">여권 사본</option>
          <option value="bank_statement">은행 잔고 증명서</option>
          <option value="business_license">사업자 등록증</option>
        </select>
        <Input 
          type="file"
          accept=".pdf,image/png,image/jpeg,image/jpg"
          onChange={e => setNewEvidenceFile(e.target.files?.[0] || null)} 
          style={{ flex: 1, padding: 6 }} 
        />
        <Button onClick={addEvidence} disabled={busy || !newEvidenceType || !newEvidenceFile} style={{ padding: "6px 12px", background: "var(--ar-accent)", color: "var(--ar-canvas)", border: "none", borderRadius: "var(--ar-r1)", cursor: "pointer" }}>업로드</Button>
      </div>

      {evidences.length === 0 ? (
        <div style={{ color: "var(--ar-slate)", fontSize: "0.9em" }}>등록된 증거물이 없습니다.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid var(--ar-hairline)" }}>유형</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid var(--ar-hairline)" }}>파일 링크</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid var(--ar-hairline)" }}>상태</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid var(--ar-hairline)" }}>등록일</th>
            </tr>
          </thead>
          <tbody>
            {evidences?.map(e => (
              <React.Fragment key={e.id}>
                <tr 
                  style={{ cursor: "pointer", background: expandedEvidenceId === e.id ? "var(--ar-paper-alt)" : "transparent" }}
                  onClick={() => setExpandedEvidenceId(expandedEvidenceId === e.id ? null : e.id)}
                >
                  <td style={{ padding: 8, borderBottom: "1px solid var(--ar-surface-muted)", fontWeight: "bold" }}>
                    <span style={{ display: "inline-block", width: 16, fontSize: "0.8em" }}>
                      {expandedEvidenceId === e.id ? "▼" : "▶"}
                    </span>
                    {e.type}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--ar-surface-muted)" }}>
                    {e.status === "pending" ? (
                      <span style={{ color: "var(--ar-slate)" }}>업로드 중...</span>
                    ) : (
                      <Button onClick={(event) => { event.stopPropagation(); downloadEvidence(e.id); }} style={{ background: "transparent", border: "none", color: "var(--ar-accent)", textDecoration: "underline", cursor: "pointer", padding: 0 }}>
                        {e.filename || "다운로드"}
                      </Button>
                    )}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--ar-surface-muted)" }}>
                    <span style={{ 
                      background: e.status === "validated" || e.status === "ai_verified" ? "var(--ar-success-soft)" : e.status === "failed" || e.status === "manual_review_required" ? "var(--ar-danger-soft)" : "var(--ar-warning-soft)",
                      color: e.status === "validated" || e.status === "ai_verified" ? "var(--ar-success)" : e.status === "failed" || e.status === "manual_review_required" ? "var(--ar-danger)" : "var(--ar-warning)",
                      padding: "2px 6px", borderRadius: "var(--ar-r1)", fontSize: "0.85em", fontWeight: "bold"
                    }}>
                      {e.status.toUpperCase()}
                    </span>
                    {e.scanStatus && <span style={{ marginLeft: 4, fontSize: "0.8em", color: "var(--ar-graphite)" }}>({e.scanStatus})</span>}
                    {e.source === "user" && <span style={{ marginLeft: 4, fontSize: "0.8em", color: "var(--ar-accent)" }}>[User Upload]</span>}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--ar-surface-muted)", color: "var(--ar-graphite)" }}>{new Date(e.createdAt).toLocaleString()}</td>
                </tr>

                {expandedEvidenceId === e.id && (
                  <tr>
                    <td colSpan={4} style={{ padding: 16, background: "var(--ar-paper-alt)", borderBottom: "2px solid var(--ar-hairline)" }}>
                      
                      {e.defectReasons && e.defectReasons.length > 0 && (
                        <div style={{ marginBottom: 12, padding: 12, background: "var(--ar-danger-soft)", borderRadius: "var(--ar-r1)", border: "1px solid var(--ar-danger-soft)" }}>
                          <h4 style={{ margin: "0 0 8px 0", color: "var(--ar-danger)", fontSize: "0.95em" }}>🚨 문서 결함 사유 (Document AI 검증 실패)</h4>
                          <ul style={{ margin: 0, paddingLeft: 20, color: "var(--ar-danger)", fontSize: "0.85em" }}>
                            {e.defectReasons?.map((reason: string, idx: number) => (
                              <li key={idx}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {e.aiExtraction && Object.keys(e.aiExtraction).length > 0 && (
                        <div style={{ padding: 12, background: "var(--ar-accent-soft)", borderRadius: "var(--ar-r1)", border: "1px solid var(--ar-accent-soft)" }}>
                          <h4 style={{ margin: "0 0 8px 0", color: "var(--ar-accent)", fontSize: "0.95em" }}>🤖 AI 자동 인식 데이터</h4>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "0.85em", color: "var(--ar-accent)", marginBottom: 12 }}>
                            {Object.entries(e.aiExtraction)?.map(([key, data]: [string, any]) => (
                              <div key={key} style={{ background: "var(--ar-canvas)", padding: "4px 8px", borderRadius: "var(--ar-r1)", border: "1px solid var(--ar-accent-soft)" }}>
                                <strong style={{ textTransform: "capitalize", marginRight: 8, color: "var(--ar-ink)" }}>{key}:</strong> 
                                {typeof data.value === "boolean" ? (data.value ? "Yes" : "No") : data.value}
                                {data.confidence && <span style={{ marginLeft: 4, fontSize: "0.8em", color: data.confidence < 0.8 ? "var(--ar-danger)" : "var(--ar-slate)" }}>({(data.confidence * 100).toFixed(0)}%)</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(!e.defectReasons || e.defectReasons.length === 0) && (!e.aiExtraction || Object.keys(e.aiExtraction).length === 0) && (
                        <div style={{ color: "var(--ar-slate)", fontSize: "0.85em", textAlign: "center", padding: 8 }}>
                          AI 분석 데이터 또는 결함 사유가 없습니다.
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
