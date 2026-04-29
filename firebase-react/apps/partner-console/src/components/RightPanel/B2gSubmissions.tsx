import { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

const STATUS_LABELS: Record<string, string> = {
  queued: "대기중",
  submitted: "제출됨",
  completed: "완료",
  failed: "실패",
};

const FEE_LABELS: Record<string, string> = {
  pending: "미납",
  processing: "처리중",
  paid: "납부완료",
  pay_failed: "납부실패",
};

export default function B2gSubmissions() {
  const {
    b2gSubmissions, b2gFees, packages, b2gCredentials,
    selectedCase, busy, setBusy, setLog, loadCaseDetail,
    actingPartnerId, claims,
  } = useAppContext();

  const partnerId = actingPartnerId || (claims?.partnerId ? String(claims.partnerId) : "");

  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedAgency, setSelectedAgency] = useState("");
  const [showFilingForm, setShowFilingForm] = useState(false);
  const [filingReceiptNumber, setFilingReceiptNumber] = useState("");
  const [filingFileUrl, setFilingFileUrl] = useState("");

  if (!selectedCase) return null;

  async function submitToB2g() {
    if (!selectedPackageId || !selectedAgency) return;
    setBusy(true);
    setLog("공공기관 제출 중...");
    try {
      const api = getApi();
      api.actingPartnerId = partnerId;
      await api.post("/v1/b2g/submissions", {
        caseId: selectedCase.id,
        packageId: selectedPackageId,
        agency: selectedAgency,
      });
      setLog("공공기관 제출 완료");
      setSelectedPackageId("");
      setSelectedAgency("");
      await loadCaseDetail(selectedCase.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "제출 실패";
      setLog(`[Error] ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  async function payFee(feeId: string) {
    setBusy(true);
    setLog("공과금 납부 중...");
    try {
      const api = getApi();
      api.actingPartnerId = partnerId;
      await api.post(`/v1/b2g/fees/${feeId}/pay`, {});
      setLog("공과금 납부 완료");
      await loadCaseDetail(selectedCase.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "납부 실패";
      setLog(`[Error] ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  async function submitFilingEvidence() {
    if (!filingReceiptNumber.trim()) {
      setLog("접수번호를 입력해주세요.");
      return;
    }
    setBusy(true);
    setLog("접수증 등록 중...");
    try {
      const api = getApi();
      api.actingPartnerId = partnerId;
      await api.post(`/v1/cases/${selectedCase.id}/filing`, {
        evidenceType: "receipt",
        receiptNumber: filingReceiptNumber.trim(),
        fileUrl: filingFileUrl.trim(),
      });
      setLog("접수증 등록 완료");
      setFilingReceiptNumber("");
      setFilingFileUrl("");
      setShowFilingForm(false);
      await loadCaseDetail(selectedCase.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "접수증 등록 실패";
      setLog(`[Error] ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  const statusBadge = (status: string) => {
    const badgeClass = status === 'completed' ? 'pc-badge-success' : status === 'failed' ? 'pc-badge-danger' : status === 'submitted' ? 'pc-badge-brand' : 'pc-badge-warning';
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
          <span>🏛️</span> 공공기관 제출 내역 (B2G)
        </h3>
      </div>

      {packages.length > 0 && b2gCredentials.length > 0 && (
        <div style={{ marginBottom: 16, padding: 16, background: "var(--pc-surface)", borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--pc-text)" }}>
            전자신청 제출
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={selectedPackageId}
              onChange={(e) => setSelectedPackageId(e.target.value)}
              className="pc-input"
              style={{ flex: 1, minWidth: 120 }}
            >
              <option value="">-- 패키지 선택 --</option>
              {packages.map((pkg: any) => (
                <option key={pkg.id} value={pkg.id}>
                  패키지 {pkg.id.substring(0, 8)}... ({new Date(pkg.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
            <select
              value={selectedAgency}
              onChange={(e) => setSelectedAgency(e.target.value)}
              className="pc-input"
              style={{ flex: 1, minWidth: 120 }}
            >
              <option value="">-- 기관 선택 --</option>
              {b2gCredentials.map((cred: any) => (
                <option key={cred.id} value={cred.agencyType}>
                  {cred.agencyType}
                </option>
              ))}
            </select>
            <button
              onClick={submitToB2g}
              disabled={busy || !selectedPackageId || !selectedAgency}
              className="pc-btn pc-btn-brand"
            >
              제출하기
            </button>
          </div>
        </div>
      )}

      {b2gSubmissions.length === 0 ? (
        <div style={{ color: "var(--pc-text-muted)", fontSize: 13, textAlign: "center", padding: 24, background: "var(--pc-bg)", borderRadius: "var(--pc-radius)", marginBottom: 16, border: "1px dashed var(--pc-border)" }}>제출 내역이 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {b2gSubmissions.map((s: any) => {
            const fees = b2gFees[s.id] || [];
            return (
              <div key={s.id} style={{ border: "1px solid var(--pc-border)", borderRadius: "var(--pc-radius)", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--pc-surface)", borderBottom: fees.length > 0 ? "1px solid var(--pc-border)" : "none" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontWeight: 700, color: "var(--pc-text)" }}>{s.agency || s.agencyType || "-"}</span>
                    <span style={{ fontSize: 13, color: "var(--pc-text-muted)" }}>
                      접수번호: {s.receiptNumber || "-"}
                    </span>
                  </div>
                  {statusBadge(s.status)}
                </div>

                {fees.length > 0 && (
                  <div style={{ padding: "12px 16px", background: "var(--pc-bg)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--pc-text-muted)", textTransform: "uppercase" }}>
                      공과금 내역
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {fees.map((fee: any) => (
                        <div
                          key={fee.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 12px",
                            background: "var(--pc-surface)",
                            borderRadius: "var(--pc-radius)",
                            border: "1px solid var(--pc-border)"
                          }}
                        >
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <span style={{ fontWeight: 700, color: "var(--pc-text)" }}>
                              {fee.amount ? `${Number(fee.amount).toLocaleString()}원` : "-"}
                            </span>
                            <span style={{ color: "var(--pc-text-muted)", fontSize: 13 }}>{fee.agency || fee.agencyType || "-"}</span>
                          </div>
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: fee.status === "paid" ? "var(--pc-success)" : fee.status === "pay_failed" ? "var(--pc-danger)" : "var(--pc-warning)",
                              }}
                            >
                              {FEE_LABELS[fee.status] || fee.status}
                            </span>
                            {(fee.status === "pending" || fee.status === "pay_failed") && (
                              <button
                                onClick={() => payFee(fee.id)}
                                disabled={busy}
                                className="pc-btn pc-btn-brand"
                                style={{ padding: "4px 8px", fontSize: 12, height: 28 }}
                              >
                                납부
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ borderTop: "1px dashed var(--pc-border)", paddingTop: 16 }}>
        <button
          onClick={() => setShowFilingForm(!showFilingForm)}
          className="pc-btn"
          style={{ width: "100%", background: showFilingForm ? "var(--pc-surface)" : "var(--pc-brand)", color: showFilingForm ? "var(--pc-text)" : "#fff", borderColor: showFilingForm ? "var(--pc-border)" : "var(--pc-brand)" }}
        >
          {showFilingForm ? "접수증 등록 취소" : "접수증 등록"}
        </button>

        {showFilingForm && (
          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", background: "var(--pc-surface)", padding: 16, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
            <input
              type="text"
              placeholder="접수번호"
              value={filingReceiptNumber}
              onChange={(e) => setFilingReceiptNumber(e.target.value)}
              className="pc-input"
              style={{ flex: 1, minWidth: 120 }}
            />
            <input
              type="text"
              placeholder="파일 URL (선택)"
              value={filingFileUrl}
              onChange={(e) => setFilingFileUrl(e.target.value)}
              className="pc-input"
              style={{ flex: 2, minWidth: 160 }}
            />
            <button
              onClick={submitFilingEvidence}
              disabled={busy || !filingReceiptNumber.trim()}
              className="pc-btn pc-btn-brand"
            >
              등록
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
