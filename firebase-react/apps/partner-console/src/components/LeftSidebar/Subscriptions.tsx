import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

export default function Subscriptions() {
  const { subscription, subscriptionPlans, busy, setBusy, setLog, loadCases } = useAppContext();

  async function subscribePlan(planId: string) {
    setBusy(true);
    setLog(`플랜(${planId}) 구독 진행 중...`);
    try {
      const res = await getApi().post("/v1/partner/subscription/subscribe", { planId });
      setLog(`구독 완료: ${res.subscription.id}`);
      await loadCases();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function cancelSubscription() {
    if (!subscription) return;
    setBusy(true);
    setLog(`구독(${subscription.id}) 해지 예약 중...`);
    try {
      await getApi().post("/v1/partner/subscription/cancel", {});
      setLog(`구독 해지 예약 완료 (주기 만료 후 해지됨)`);
      await loadCases();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* 현재 구독 정보 */}
      <div style={{ flex: 1, minWidth: 300, background: "var(--pc-surface-active)", padding: 24, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
        <h4 style={{ margin: "0 0 16px 0", color: "var(--pc-text)", fontSize: 16 }}>내 구독 상태</h4>
        {subscription ? (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              플랜 ID: {subscription.planId} 
              <span className={`pc-badge ${subscription.status === "active" ? "pc-badge-success" : "pc-badge-danger"}`}>
                {subscription.status}
              </span>
            </div>
            <div className="pc-mono" style={{ color: "var(--pc-text-muted)", fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
              현재 주기: {new Date(subscription.currentPeriodStart).toLocaleDateString()} ~ {new Date(subscription.currentPeriodEnd).toLocaleDateString()}<br/>
              해지 예약: {subscription.cancelAtPeriodEnd ? "예약됨 (이번 주기 후 만료)" : "자동 갱신 예정"}
            </div>
            {!subscription.cancelAtPeriodEnd && subscription.status === "active" && (
              <button onClick={cancelSubscription} disabled={busy} className="pc-btn pc-btn-danger" style={{ width: "100%" }}>
                구독 해지 예약
              </button>
            )}
          </div>
        ) : (
          <div style={{ color: "var(--pc-text-muted)", fontSize: 14, lineHeight: 1.6 }}>
            현재 가입된 구독 플랜이 없습니다. <br/>우측에서 플랜을 선택하여 혜택을 받아보세요.
          </div>
        )}
      </div>

      {/* 플랜 목록 */}
      <div style={{ flex: 2, minWidth: 300 }}>
        <h4 style={{ margin: "0 0 16px 0", color: "var(--pc-text)", fontSize: 16 }}>이용 가능한 플랜</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {subscriptionPlans?.map(plan => (
            <div key={plan.id} style={{ background: "var(--pc-bg)", padding: 24, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)", display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{plan.name}</div>
              <div style={{ color: "var(--pc-brand)", fontWeight: 800, fontSize: 20, marginBottom: 16 }}>
                {plan.price.toLocaleString()}원 <span style={{ fontSize: 14, fontWeight: 500, color: "var(--pc-text-muted)" }}>/ {plan.interval === "month" ? "월" : "년"}</span>
              </div>
              <ul style={{ margin: "0 0 24px 0", paddingLeft: 20, fontSize: 13, color: "var(--pc-text-muted)", lineHeight: 1.6, flex: 1 }}>
                {plan.features?.map((f: string, idx: number) => <li key={idx} style={{ marginBottom: 4 }}>{f}</li>)}
              </ul>
              <button 
                onClick={() => subscribePlan(plan.id)} 
                disabled={busy || (subscription && subscription.planId === plan.id && !subscription.cancelAtPeriodEnd)}
                className={`pc-btn ${subscription && subscription.planId === plan.id ? "" : "pc-btn-brand"}`}
                style={{ width: "100%" }}
              >
                {(subscription && subscription.planId === plan.id) ? "현재 이용 중" : "가입 / 변경하기"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
