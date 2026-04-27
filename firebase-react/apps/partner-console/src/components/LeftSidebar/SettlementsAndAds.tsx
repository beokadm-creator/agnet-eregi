import React from "react";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

export default function SettlementsAndAds() {
  const { settlements, adCampaigns, busy, setBusy, setLog, loadCases } = useAppContext();

  async function createAdCampaign() {
    setBusy(true);
    setLog("새 광고 캠페인 (CPC) 생성 중...");
    try {
      const res = await getApi().post("/v1/partner/ads/campaigns", {
        type: "CPC",
        bidAmount: 500,
        dailyBudget: 10000
      });
      setLog(`캠페인 생성 완료: ${res.campaign.id}`);
      await loadCases();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderTop: "2px solid #eee", paddingTop: 16, marginTop: 16 }}>
      <h3 style={{ margin: "0 0 12px 0", color: "#2e7d32", fontSize: "1.1em" }}>정산 및 광고 과금 (EP-06-03, EP-02-03)</h3>
      
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em", color: "#388e3c" }}>내 정산 원장</h4>
        {settlements.length === 0 ? (
          <div style={{ color: "#999", fontSize: "0.85em" }}>정산 내역이 없습니다. (배치 실행 후 생성됨)</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {settlements.map(st => (
              <div key={st.id} style={{ background: "#f1f8e9", padding: 8, borderRadius: 4, fontSize: "0.85em", border: "1px solid #c8e6c9" }}>
                <div style={{ fontWeight: "bold", marginBottom: 4 }}>ID: {st.id} ({st.status.toUpperCase()})</div>
                <div style={{ color: "#555" }}>
                  총 결제: {st.totalPaymentAmount.toLocaleString()}원 | 환불: {st.totalRefundAmount.toLocaleString()}원<br/>
                  플랫폼 수수료: -{st.platformFee.toLocaleString()}원 | 광고비 차감: -{st.adDeductionAmount.toLocaleString()}원<br/>
                  <strong style={{ color: "#d84315", fontSize: "1.1em" }}>최종 지급액: {st.netSettlementAmount.toLocaleString()}원</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em", color: "#1565c0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          광고 캠페인
          <button onClick={createAdCampaign} disabled={busy} style={{ background: "#0288d1", color: "white", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.85em" }}>
            + 새 캠페인 (CPC)
          </button>
        </h4>
        {adCampaigns.length === 0 ? (
          <div style={{ color: "#999", fontSize: "0.85em" }}>활성 캠페인이 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {adCampaigns.map(camp => (
              <div key={camp.id} style={{ background: "#e3f2fd", padding: 8, borderRadius: 4, fontSize: "0.85em", border: "1px solid #bbdefb" }}>
                <div style={{ fontWeight: "bold", marginBottom: 4 }}>
                  ID: {camp.id} <span style={{ color: camp.status === "active" ? "#2e7d32" : "#c62828" }}>({camp.status})</span>
                </div>
                <div style={{ color: "#555" }}>
                  유형: {camp.type} | 입찰가: {camp.bidAmount}원 | 일일 예산: {camp.dailyBudget.toLocaleString()}원
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
