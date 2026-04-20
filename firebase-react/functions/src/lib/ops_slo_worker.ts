import * as admin from "firebase-admin";
import { logOpsEvent } from "./ops_audit";
import { defaultSloConfig, OpsSloConfig } from "./ops_slo";
import { notifyOpsAlert } from "./ops_alert";

export async function processSloBurnRateDaily(adminApp: typeof admin) {
  const db = adminApp.firestore();
  
  // 어제 날짜 기준
  const now = new Date();
  const endStr = now.toISOString().split('T')[0];

  // 전체 gateKey 조회 (ops_gate_settings)
  const gatesSnap = await db.collection("ops_gate_settings").get();
  
  for (const gateDoc of gatesSnap.docs) {
    const gateKey = gateDoc.id;
    
    // SLO Config 확인
    let config = defaultSloConfig;
    const configSnap = await db.collection("ops_slo_configs").doc(gateKey).get();
    if (configSnap.exists) {
      config = { ...defaultSloConfig, ...configSnap.data() } as OpsSloConfig;
    }
    
    // budgetDays에 해당하는 기간 계산
    const budgetDays = config.budgetDays || 7;
    const startDate = new Date(now.getTime() - budgetDays * 24 * 60 * 60 * 1000);
    const startStr = startDate.toISOString().split('T')[0];
    
    // ops_metrics_daily에서 해당 기간의 failRate(또는 auditTotal/auditFail) 가져오기
    const metricsSnap = await db.collection("ops_metrics_daily")
      .where("gateKey", "==", gateKey)
      .where("date", ">=", startStr)
      .where("date", "<=", endStr)
      .get();
      
    let totalRequests = 0;
    let totalFails = 0;
    
    for (const mDoc of metricsSnap.docs) {
      const mData = mDoc.data();
      totalRequests += (mData.auditTotal || 0);
      totalFails += (mData.auditFail || 0);
    }
    
    if (totalRequests === 0) continue; // 트래픽 없음
    
    const sliPercentage = ((totalRequests - totalFails) / totalRequests) * 100;
    
    // Error Budget 소진율 계산
    // 허용 에러 수 = (100 - SLO%) * 총요청수 / 100
    const allowedFails = totalRequests * ((100 - config.targetPercentage) / 100);
    
    // 소진율 = 발생한에러 / 허용에러
    const burnRate = allowedFails > 0 ? (totalFails / allowedFails) : (totalFails > 0 ? 100 : 0);
    
    // 저장
    const statusData = {
      gateKey,
      targetPercentage: config.targetPercentage,
      budgetDays,
      sliPercentage: Number(sliPercentage.toFixed(2)),
      totalRequests,
      totalFails,
      allowedFails: Number(allowedFails.toFixed(2)),
      burnRate: Number((burnRate * 100).toFixed(2)), // %
      calculatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection("ops_slo_status").doc(`${gateKey}__${endStr}`).set(statusData);
    
    // 경보 발생 조건 (예: 1일만에 budget의 50% 이상 소진 등, 여기서는 burnRate > 100% 이면 알림)
    if (burnRate > 1.0) { // 100% 초과 소진
      // 노이즈 컨트롤: 이미 경보를 발생시켰는지 최근 audit 조회 (24시간 내)
      const recentAlertSnap = await db.collection("ops_audit_events")
        .where("gateKey", "==", gateKey)
        .where("action", "==", "ops_slo.burn_alert")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
        
      let shouldAlert = true;
      if (!recentAlertSnap.empty) {
        const lastAlertAt = recentAlertSnap.docs[0].data().createdAt.toDate();
        if (now.getTime() - lastAlertAt.getTime() < 24 * 60 * 60 * 1000) {
          shouldAlert = false; // 24시간 내 이미 알림 (노이즈 방지)
        }
      }
      
      if (shouldAlert) {
        const msg = `[${gateKey}] Error Budget ${statusData.burnRate}% 소진! (SLO: ${config.targetPercentage}%, SLI: ${statusData.sliPercentage}%)`;
        
        await notifyOpsAlert({
          gateKey,
          action: "ops_slo.burn_alert",
          alertType: "slo_burn",
          summary: msg,
          severity: "critical",
          force: true
        });
        
        await logOpsEvent(adminApp, {
          gateKey,
          action: "ops_slo.burn_alert",
          status: "success",
          actorUid: "system",
          requestId: `slo_${Date.now()}`,
          summary: msg,
          target: statusData
        });
      }
    }
  }
}
