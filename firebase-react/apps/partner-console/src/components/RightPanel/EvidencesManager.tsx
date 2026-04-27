import React, { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

export default function EvidencesManager() {
  const { evidences, selectedCase, expandedEvidenceId, setExpandedEvidenceId, busy, setBusy, setLog, loadCaseDetail } = useAppContext();
  
  const [newEvidenceType, setNewEvidenceType] = useState("");
  const [newEvidenceFile, setNewEvidenceFile] = useState<File | null>(null);

  const [newReqMessage, setNewReqMessage] = useState("");
  const [newReqItemCode, setNewReqItemCode] = useState("");
  const [newReqItemTitle, setNewReqItemTitle] = useState("");

  if (!selectedCase) return null;

  async function addEvidence() {
    if (!newEvidenceType || !newEvidenceFile || !selectedCase) return;
    setBusy(true);
    setLog("증거물 업로드 중...");
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await getApi().post(`/v1/partner/cases/${selectedCase.id}/evidences`, {
          type: newEvidenceType,
          filename: newEvidenceFile.name,
          contentType: newEvidenceFile.type,
          base64
        });
        setLog("증거물 업로드 완료");
        setNewEvidenceType("");
        setNewEvidenceFile(null);
        await loadCaseDetail(selectedCase.id);
      };
      reader.readAsDataURL(newEvidenceFile);
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
      setBusy(false);
    }
  }

  async function downloadEvidence(evidenceId: string) {
    if (!selectedCase) return;
    setBusy(true);
    setLog(`증거물 다운로드 링크 생성 중...`);
    try {
      const res = await getApi().get(`/v1/partner/cases/${selectedCase.id}/evidences/${evidenceId}/download`);
      window.open(res.url, "_blank");
      setLog("다운로드 창을 열었습니다.");
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1em", borderBottom: "1px solid #eee", paddingBottom: 8 }}>📁 증거물 (Evidences)</h3>
      
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={newEvidenceType} onChange={e => setNewEvidenceType(e.target.value)} style={{ padding: 6 }}>
          <option value="">-- 유형 선택 --</option>
          <option value="passport">여권 사본</option>
          <option value="bank_statement">은행 잔고 증명서</option>
          <option value="business_license">사업자 등록증</option>
        </select>
        <input 
          type="file"
          accept=".pdf,image/png,image/jpeg,image/jpg"
          onChange={e => setNewEvidenceFile(e.target.files?.[0] || null)} 
          style={{ flex: 1, padding: 6 }} 
        />
        <button onClick={addEvidence} disabled={busy || !newEvidenceType || !newEvidenceFile} style={{ padding: "6px 12px", background: "#0277bd", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>업로드</button>
      </div>

      {evidences.length === 0 ? (
        <div style={{ color: "#999", fontSize: "0.9em" }}>등록된 증거물이 없습니다.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>유형</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>파일 링크</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>상태</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>등록일</th>
            </tr>
          </thead>
          <tbody>
            {evidences.map(e => (
              <React.Fragment key={e.id}>
                <tr 
                  style={{ cursor: "pointer", background: expandedEvidenceId === e.id ? "#f5f5f5" : "transparent" }}
                  onClick={() => setExpandedEvidenceId(expandedEvidenceId === e.id ? null : e.id)}
                >
                  <td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: "bold" }}>
                    <span style={{ display: "inline-block", width: 16, fontSize: "0.8em" }}>
                      {expandedEvidenceId === e.id ? "▼" : "▶"}
                    </span>
                    {e.type}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {e.status === "pending" ? (
                      <span style={{ color: "#999" }}>업로드 중...</span>
                    ) : (
                      <button onClick={(event) => { event.stopPropagation(); downloadEvidence(e.id); }} style={{ background: "transparent", border: "none", color: "#0288d1", textDecoration: "underline", cursor: "pointer", padding: 0 }}>
                        {e.filename || "다운로드"}
                      </button>
                    )}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    <span style={{ 
                      background: e.status === "validated" || e.status === "ai_verified" ? "#e8f5e9" : e.status === "failed" || e.status === "manual_review_required" ? "#ffebee" : "#fff3e0",
                      color: e.status === "validated" || e.status === "ai_verified" ? "#2e7d32" : e.status === "failed" || e.status === "manual_review_required" ? "#c62828" : "#ef6c00",
                      padding: "2px 6px", borderRadius: 4, fontSize: "0.85em", fontWeight: "bold"
                    }}>
                      {e.status.toUpperCase()}
                    </span>
                    {e.scanStatus && <span style={{ marginLeft: 4, fontSize: "0.8em", color: "#666" }}>({e.scanStatus})</span>}
                    {e.source === "user" && <span style={{ marginLeft: 4, fontSize: "0.8em", color: "#1976d2" }}>[User Upload]</span>}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee", color: "#666" }}>{new Date(e.createdAt).toLocaleString()}</td>
                </tr>

                {expandedEvidenceId === e.id && (
                  <tr>
                    <td colSpan={4} style={{ padding: 16, background: "#fafafa", borderBottom: "2px solid #ddd" }}>
                      
                      {e.defectReasons && e.defectReasons.length > 0 && (
                        <div style={{ marginBottom: 12, padding: 12, background: "#ffebee", borderRadius: 6, border: "1px solid #ffcdd2" }}>
                          <h4 style={{ margin: "0 0 8px 0", color: "#c62828", fontSize: "0.95em" }}>🚨 문서 결함 사유 (Document AI 검증 실패)</h4>
                          <ul style={{ margin: 0, paddingLeft: 20, color: "#b71c1c", fontSize: "0.85em" }}>
                            {e.defectReasons.map((reason: string, idx: number) => (
                              <li key={idx}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {e.aiExtraction && Object.keys(e.aiExtraction).length > 0 && (
                        <div style={{ padding: 12, background: "#e8eaf6", borderRadius: 6, border: "1px solid #c5cae9" }}>
                          <h4 style={{ margin: "0 0 8px 0", color: "#283593", fontSize: "0.95em" }}>🤖 AI 자동 인식 데이터</h4>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "0.85em", color: "#303f9f", marginBottom: 12 }}>
                            {Object.entries(e.aiExtraction).map(([key, data]: [string, any]) => (
                              <div key={key} style={{ background: "#fff", padding: "4px 8px", borderRadius: 4, border: "1px solid #e8eaf6" }}>
                                <strong style={{ textTransform: "capitalize", marginRight: 8, color: "#1a237e" }}>{key}:</strong> 
                                {typeof data.value === "boolean" ? (data.value ? "Yes" : "No") : data.value}
                                {data.confidence && <span style={{ marginLeft: 4, fontSize: "0.8em", color: data.confidence < 0.8 ? "#d32f2f" : "#999" }}>({(data.confidence * 100).toFixed(0)}%)</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(!e.defectReasons || e.defectReasons.length === 0) && (!e.aiExtraction || Object.keys(e.aiExtraction).length === 0) && (
                        <div style={{ color: "#999", fontSize: "0.85em", textAlign: "center", padding: 8 }}>
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
