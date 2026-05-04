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
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h4 style={{ margin: "0 0 12px 0", fontSize: 16, color: "var(--pc-text)", fontWeight: 700 }}>내 정산 원장</h4>
        {settlements.length === 0 ? (
          <div style={{ color: "var(--pc-text-muted)", fontSize: 14, background: "var(--pc-surface)", padding: 24, borderRadius: "var(--pc-radius)", textAlign: "center", border: "1px solid var(--pc-border)" }}>
            정산 내역이 없습니다. (배치 실행 후 생성됨)
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {settlements?.map(st => (
              <div key={st.id} style={{ background: "var(--pc-success-soft)", padding: 16, borderRadius: "var(--pc-radius)", fontSize: 14, border: "1px solid var(--pc-success)" }}>
                <div style={{ fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  ID: {st.id}
                  <span className="pc-badge pc-badge-success">{st.status.toUpperCase()}</span>
                </div>
                <div style={{ color: "var(--pc-text-muted)", lineHeight: 1.6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>총 결제:</span> <span>{st.totalPaymentAmount.toLocaleString()}원</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>환불:</span> <span>{st.totalRefundAmount.toLocaleString()}원</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>플랫폼 수수료:</span> <span>-{st.platformFee.toLocaleString()}원</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>광고비 차감:</span> <span>-{st.adDeductionAmount.toLocaleString()}원</span></div>
                  <div style={{ borderTop: "1px dashed var(--pc-border)", margin: "8px 0" }}></div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--pc-text)", fontWeight: 700, fontSize: 16 }}>
                    <span>최종 지급액:</span> <span>{st.netSettlementAmount.toLocaleString()}원</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 style={{ margin: "0 0 12px 0", fontSize: 16, color: "var(--pc-text)", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          광고 캠페인
          <button onClick={createAdCampaign} disabled={busy} className="pc-btn pc-btn-brand">
            + 새 캠페인 (CPC)
          </button>
        </h4>
        {adCampaigns.length === 0 ? (
          <div style={{ color: "var(--pc-text-muted)", fontSize: 14, background: "var(--pc-surface)", padding: 24, borderRadius: "var(--pc-radius)", textAlign: "center", border: "1px solid var(--pc-border)" }}>
            활성 캠페인이 없습니다.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {adCampaigns?.map(camp => (
              <div key={camp.id} style={{ background: "var(--pc-brand-soft)", padding: 16, borderRadius: "var(--pc-radius)", fontSize: 14, border: "1px solid var(--pc-brand)" }}>
                <div style={{ fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  ID: {camp.id} 
                  <span className={`pc-badge ${camp.status === "active" ? "pc-badge-success" : "pc-badge-danger"}`}>
                    {camp.status}
                  </span>
                </div>
                <div style={{ color: "var(--pc-text-muted)", lineHeight: 1.6 }}>
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
