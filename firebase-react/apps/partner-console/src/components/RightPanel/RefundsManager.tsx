import { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

export default function RefundsManager() {
  const { refunds, selectedCase, busy, setBusy, setLog, loadCaseDetail } = useAppContext();

  const [newRefundPaymentId, setNewRefundPaymentId] = useState("");
  const [newRefundAmount, setNewRefundAmount] = useState<number>(0);
  const [newRefundReason, setNewRefundReason] = useState("");

  if (!selectedCase) return null;

  async function createRefund() {
    if (!newRefundPaymentId || !newRefundAmount || !newRefundReason || !selectedCase) return;
    setBusy(true);
    setLog("환불 요청 중...");
    try {
      await getApi().post(`/v1/partner/cases/${selectedCase.id}/refunds`, {
        paymentId: newRefundPaymentId,
        amount: newRefundAmount,
        reason: newRefundReason
      });
      setLog("환불 요청 완료");
      setNewRefundPaymentId("");
      setNewRefundAmount(0);
      setNewRefundReason("");
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
          <span>💸</span> 환불 요청
        </h3>
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16, background: "var(--pc-surface)", padding: 16, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
        <input 
          placeholder="결제 ID (Payment ID)" 
          value={newRefundPaymentId} 
          onChange={e => setNewRefundPaymentId(e.target.value)} 
          className="pc-input"
        />
        <input 
          type="number"
          placeholder="환불 금액" 
          value={newRefundAmount || ""} 
          onChange={e => setNewRefundAmount(Number(e.target.value))} 
          className="pc-input"
        />
        <input 
          placeholder="환불 사유" 
          value={newRefundReason} 
          onChange={e => setNewRefundReason(e.target.value)} 
          className="pc-input"
          style={{ gridColumn: "span 2" }}
        />
        <button onClick={createRefund} disabled={busy || !newRefundPaymentId || !newRefundAmount || !newRefundReason} className="pc-btn pc-btn-brand" style={{ gridColumn: "span 2", background: "var(--pc-warning)", borderColor: "var(--pc-warning)" }}>
          환불 요청
        </button>
      </div>

      {refunds.length === 0 ? (
        <div style={{ color: "var(--pc-text-muted)", fontSize: 13, textAlign: "center", padding: 24 }}>환불 요청 내역이 없습니다.</div>
      ) : (
        <div style={{ border: "1px solid var(--pc-border)", borderRadius: "var(--pc-radius)", overflow: "hidden" }}>
          <table className="pc-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>결제 ID</th>
                <th style={{ textAlign: "right" }}>금액</th>
                <th>사유</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {refunds?.map(r => (
                <tr key={r.id}>
                  <td className="pc-mono" style={{ fontSize: 12 }}>{r.paymentId}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--pc-text)" }}>{r.amount.toLocaleString()}</td>
                  <td style={{ fontSize: 13 }}>{r.reason}</td>
                  <td>
                    <span className={`pc-badge ${r.status === "executed" ? "pc-badge-success" : r.status === "approved" ? "pc-badge-brand" : r.status === "rejected" ? "pc-badge-danger" : "pc-badge-warning"}`}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
