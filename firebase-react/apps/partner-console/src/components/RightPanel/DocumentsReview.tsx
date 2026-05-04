import React, { useState, useEffect, useCallback } from "react";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

interface Document {
  id: string;
  caseId: string;
  docType: string;
  fileName: string;
  filePath: string;
  status: string;
  uploadedBy: string;
  uploadedAt: string;
  updatedAt: string;
  rejectReason?: string;
}

const STATUS_LABELS: Record<string, string> = {
  uploaded: "검토대기",
  approved: "승인",
  rejected: "반려",
};

export default function DocumentsReview() {
  const { selectedCase, busy, setBusy, setLog, actingPartnerId, claims } = useAppContext();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const partnerId = actingPartnerId || (claims?.partnerId ? String(claims.partnerId) : "");

  const loadDocuments = useCallback(async () => {
    if (!selectedCase) return;
    try {
      const api = getApi();
      api.actingPartnerId = partnerId;
      const res = await api.get(`/v1/cases/${selectedCase.id}/documents`);
      setDocuments(res.documents || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "문서 목록 로드 실패";
      setLog(`[Error] ${msg}`);
    }
  }, [selectedCase, partnerId, setLog]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  if (!selectedCase) return null;

  async function approveDocument(docId: string) {
    setBusy(true);
    setLog("문서 승인 중...");
    try {
      const api = getApi();
      api.actingPartnerId = partnerId;
      await api.patch(`/v1/cases/${selectedCase.id}/documents/${docId}/status`, {
        status: "approved",
      });
      setLog("문서가 승인되었습니다.");
      await loadDocuments();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "승인 실패";
      setLog(`[Error] ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  async function rejectDocument(docId: string) {
    if (!rejectReason.trim()) {
      setLog("반려 사유를 입력해주세요.");
      return;
    }
    setBusy(true);
    setLog("문서 반려 중...");
    try {
      const api = getApi();
      api.actingPartnerId = partnerId;
      await api.patch(`/v1/cases/${selectedCase.id}/documents/${docId}/status`, {
        status: "rejected",
        rejectReason: rejectReason.trim(),
      });
      setLog("문서가 반려되었습니다.");
      setRejectingDocId(null);
      setRejectReason("");
      await loadDocuments();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "반려 실패";
      setLog(`[Error] ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  const statusBadge = (status: string) => {
    const badgeClass = status === 'approved' ? 'pc-badge-success' : status === 'rejected' ? 'pc-badge-danger' : 'pc-badge-warning';
    return (
      <span className={`pc-badge ${badgeClass}`}>
        {STATUS_LABELS[status] || status}
      </span>
    );
  };

  return (
    <div className="pc-card">
      <div className="pc-card-header" style={{ borderBottom: "1px solid var(--pc-border)", paddingBottom: 16, marginBottom: 16 }}>
        <h3 className="pc-card-title" style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📄</span> 서류 검토
        </h3>
      </div>

      {documents.length === 0 ? (
        <div style={{ color: "var(--pc-text-muted)", fontSize: 13, textAlign: "center", padding: 24 }}>제출된 서류가 없습니다.</div>
      ) : (
        <div style={{ border: "1px solid var(--pc-border)", borderRadius: "var(--pc-radius)", overflow: "hidden", overflowX: "auto" }}>
          <table className="pc-table" style={{ margin: 0, whiteSpace: "nowrap" }}>
            <thead>
              <tr>
                <th>파일명</th>
                <th>유형</th>
                <th>상태</th>
                <th>업로드일</th>
                <th>검토</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <React.Fragment key={doc.id}>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{doc.fileName}</td>
                    <td>{doc.docType}</td>
                    <td>{statusBadge(doc.status)}</td>
                    <td className="pc-mono" style={{ fontSize: 12, color: "var(--pc-text-muted)" }}>
                      {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : "-"}
                    </td>
                    <td>
                      {doc.status === "uploaded" && (
                        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button
                            onClick={() => approveDocument(doc.id)}
                            disabled={busy}
                            className="pc-btn"
                            style={{ padding: "4px 10px", background: "var(--pc-success)", color: "#fff", borderColor: "var(--pc-success)", fontSize: 12, height: 28 }}
                          >
                            승인
                          </button>
                          {rejectingDocId === doc.id ? (
                            <span style={{ display: "flex", gap: 8, alignItems: "center", background: "var(--pc-surface)", padding: 4, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
                              <input
                                type="text"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="반려 사유 입력"
                                className="pc-input"
                                style={{ padding: "4px 8px", fontSize: 12, width: 150, height: 28, minHeight: 28 }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") rejectDocument(doc.id);
                                  if (e.key === "Escape") { setRejectingDocId(null); setRejectReason(""); }
                                }}
                              />
                              <button
                                onClick={() => rejectDocument(doc.id)}
                                disabled={busy || !rejectReason.trim()}
                                className="pc-btn"
                                style={{ padding: "4px 10px", background: "var(--pc-danger)", color: "#fff", borderColor: "var(--pc-danger)", fontSize: 12, height: 28 }}
                              >
                                확인
                              </button>
                              <button
                                onClick={() => { setRejectingDocId(null); setRejectReason(""); }}
                                className="pc-btn"
                                style={{ padding: "4px 10px", fontSize: 12, height: 28 }}
                              >
                                취소
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setRejectingDocId(doc.id)}
                              disabled={busy}
                              className="pc-btn"
                              style={{ padding: "4px 10px", background: "var(--pc-danger)", color: "#fff", borderColor: "var(--pc-danger)", fontSize: 12, height: 28 }}
                            >
                              반려
                            </button>
                          )}
                        </span>
                      )}
                      {doc.status === "rejected" && doc.rejectReason && (
                        <span style={{ fontSize: 12, color: "var(--pc-danger)", display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontWeight: 600 }}>사유:</span> {doc.rejectReason}
                        </span>
                      )}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
