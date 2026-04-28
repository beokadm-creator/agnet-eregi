import { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
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
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1em", borderBottom: "1px solid #eee", paddingBottom: 8 }}>💸 환불 요청 (Refunds)</h3>
      
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Input 
          placeholder="결제 ID (Payment ID)" 
          value={newRefundPaymentId} 
          onChange={e => setNewRefundPaymentId(e.target.value)} 
          style={{ flex: 1, padding: 6, minWidth: 150 }} 
        />
        <Input 
          type="number"
          placeholder="환불 금액" 
          value={newRefundAmount || ""} 
          onChange={e => setNewRefundAmount(Number(e.target.value))} 
          style={{ width: 100, padding: 6 }} 
        />
        <Input 
          placeholder="환불 사유" 
          value={newRefundReason} 
          onChange={e => setNewRefundReason(e.target.value)} 
          style={{ flex: 2, padding: 6, minWidth: 200 }} 
        />
        <Button onClick={createRefund} disabled={busy || !newRefundPaymentId || !newRefundAmount || !newRefundReason} style={{ padding: "6px 12px", background: "#d84315", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
          환불 요청
        </Button>
      </div>

      {refunds.length === 0 ? (
        <div style={{ color: "#999", fontSize: "0.9em" }}>환불 요청 내역이 없습니다.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>결제 ID</th>
              <th style={{ textAlign: "right", padding: 8, borderBottom: "2px solid #ddd" }}>금액</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>사유</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map(r => (
              <tr key={r.id}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", fontFamily: "monospace" }}>{r.paymentId}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right", fontWeight: "bold" }}>{r.amount.toLocaleString()}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{r.reason}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  <span style={{ 
                    padding: "2px 6px", 
                    borderRadius: 4, 
                    fontSize: "0.85em", 
                    fontWeight: "bold",
                    background: r.status === "executed" ? "#e8f5e9" : r.status === "approved" ? "#e3f2fd" : r.status === "rejected" ? "#ffebee" : "#fff3e0",
                    color: r.status === "executed" ? "#2e7d32" : r.status === "approved" ? "#1565c0" : r.status === "rejected" ? "#c62828" : "#ef6c00"
                  }}>
                    {r.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
