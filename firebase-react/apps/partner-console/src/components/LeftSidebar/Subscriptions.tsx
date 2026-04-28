import { Button } from "@agentregi/ui-components";
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
    <div style={{ borderTop: "2px solid #eee", paddingTop: 16, marginTop: 16 }}>
      <h3 style={{ margin: "0 0 12px 0", color: "#6a1b9a", fontSize: "1.1em" }}>플랜 구독 및 멤버십 (EP-07-03)</h3>
      
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* 현재 구독 정보 */}
        <div style={{ flex: 1, minWidth: 300, background: "#f3e5f5", padding: 16, borderRadius: 8, border: "1px solid #ce93d8" }}>
          <h4 style={{ margin: "0 0 12px 0", color: "#4a148c" }}>내 구독 상태</h4>
          {subscription ? (
            <div>
              <div style={{ fontWeight: "bold", fontSize: "1.1em", marginBottom: 4 }}>
                플랜 ID: {subscription.planId} <span style={{ color: subscription.status === "active" ? "#2e7d32" : "#c62828", fontSize: "0.8em" }}>({subscription.status})</span>
              </div>
              <div style={{ color: "#555", fontSize: "0.9em", marginBottom: 12 }}>
                현재 주기: {new Date(subscription.currentPeriodStart).toLocaleDateString()} ~ {new Date(subscription.currentPeriodEnd).toLocaleDateString()}<br/>
                해지 예약: {subscription.cancelAtPeriodEnd ? "예약됨 (이번 주기 후 만료)" : "자동 갱신 예정"}
              </div>
              {!subscription.cancelAtPeriodEnd && subscription.status === "active" && (
                <Button onClick={cancelSubscription} disabled={busy} style={{ background: "#d32f2f", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: "0.85em" }}>
                  구독 해지 예약
                </Button>
              )}
            </div>
          ) : (
            <div style={{ color: "#666", fontSize: "0.9em" }}>
              현재 가입된 구독 플랜이 없습니다. <br/>아래에서 플랜을 선택하여 혜택을 받아보세요.
            </div>
          )}
        </div>

        {/* 플랜 목록 */}
        <div style={{ flex: 2, minWidth: 300 }}>
          <h4 style={{ margin: "0 0 12px 0", color: "#333" }}>이용 가능한 플랜</h4>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {subscriptionPlans.map(plan => (
              <div key={plan.id} style={{ background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #ddd", flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: "bold", fontSize: "1.1em", marginBottom: 4 }}>{plan.name}</div>
                <div style={{ color: "#d84315", fontWeight: "bold", marginBottom: 8 }}>{plan.price.toLocaleString()}원 / {plan.interval === "month" ? "월" : "년"}</div>
                <ul style={{ margin: "0 0 12px 0", paddingLeft: 20, fontSize: "0.85em", color: "#555" }}>
                  {plan.features?.map((f: string, idx: number) => <li key={idx}>{f}</li>)}
                </ul>
                <Button 
                  onClick={() => subscribePlan(plan.id)} 
                  disabled={busy || (subscription && subscription.planId === plan.id && !subscription.cancelAtPeriodEnd)}
                  style={{ width: "100%", padding: 8, background: (subscription && subscription.planId === plan.id) ? "#9e9e9e" : "#0288d1", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}
                >
                  {(subscription && subscription.planId === plan.id) ? "현재 이용 중" : "가입 / 변경하기"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
