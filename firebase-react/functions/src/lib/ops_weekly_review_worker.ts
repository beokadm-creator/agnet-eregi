import * as admin from "firebase-admin";
import { logOpsEvent } from "./ops_audit";

export async function processWeeklyOpsReview(adminApp: typeof admin) {
  const db = adminApp.firestore();
  
  // 지난 7일 계산
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // 주차 포맷 (예: 2026-W16)
  const year = now.getFullYear();
  const weekNum = Math.ceil(Math.floor((now.getTime() - new Date(year, 0, 1).getTime()) / (24 * 60 * 60 * 1000)) / 7);
  const weekStr = `${year}-W${weekNum.toString().padStart(2, "0")}`;

  const startStr = sevenDaysAgo.toISOString().split('T')[0];
  const endStr = now.toISOString().split('T')[0];

  // 1. 최근 7일간의 Metrics와 Quality 가져오기
  const metricsSnap = await db.collection("ops_metrics_daily")
    .where("date", ">=", startStr)
    .where("date", "<=", endStr)
    .get();

  const qualitySnap = await db.collection("ops_alert_quality_daily")
    .where("date", ">=", startStr)
    .where("date", "<=", endStr)
    .get();

  const gateStats: Record<string, any> = {};
  
  const getGate = (gk: string) => {
    if (!gateStats[gk]) {
      gateStats[gk] = {
        gateKey: gk,
        totalFails: 0,
        totalTotal: 0,
        deadJobs: 0,
        incidentsOpened: 0,
        playbookRuns: 0,
        qualityScores: [] as number[]
      };
    }
    return gateStats[gk];
  };

  for (const doc of metricsSnap.docs) {
    const data = doc.data();
    const gk = data.gateKey;
    const g = getGate(gk);
    g.totalFails += data.auditFail || 0;
    g.totalTotal += data.auditTotal || 0;
    g.deadJobs += data.deadJobsCount || 0;
    g.incidentsOpened += data.incidentsOpened || 0;
    g.playbookRuns += data.playbookRuns || 0;
  }

  for (const doc of qualitySnap.docs) {
    const data = doc.data();
    const gk = data.gateKey;
    const g = getGate(gk);
    if (typeof data.score === 'number') {
      g.qualityScores.push(data.score);
    }
  }

  const gateList = Object.values(gateStats).map(g => {
    g.failRate = g.totalTotal > 0 ? g.totalFails / g.totalTotal : 0;
    g.avgQuality = g.qualityScores.length > 0 ? g.qualityScores.reduce((a: number, b: number) => a + b, 0) / g.qualityScores.length : 100;
    
    // 위험도 점수 산정 (간단 휴리스틱)
    g.riskScore = (g.failRate * 100) + (g.deadJobs * 2) + (g.incidentsOpened * 5) + ((100 - g.avgQuality) * 0.5);
    return g;
  });

  gateList.sort((a, b) => b.riskScore - a.riskScore);
  const topRisks = gateList.slice(0, 3);

  // Markdown 문서 생성
  let md = `# Ops Weekly Review (${weekStr})\n\n`;
  md += `**리뷰 기간**: ${startStr} ~ ${endStr}\n\n`;

  md += `## ⚠️ Top 3 Risk Gates\n`;
  if (topRisks.length === 0) {
    md += `이번 주 발생한 운영 이슈가 없습니다. 훌륭합니다!\n\n`;
  } else {
    for (let i = 0; i < topRisks.length; i++) {
      const g = topRisks[i];
      md += `### ${i+1}. ${g.gateKey} (위험 점수: ${g.riskScore.toFixed(1)})\n`;
      md += `- **Fail Rate**: ${(g.failRate * 100).toFixed(2)}%\n`;
      md += `- **Dead Jobs**: ${g.deadJobs}건\n`;
      md += `- **Incidents**: ${g.incidentsOpened}건 발생\n`;
      md += `- **Playbook Runs**: ${g.playbookRuns}회 실행\n`;
      md += `- **Avg Alert Quality**: ${g.avgQuality.toFixed(1)}점\n\n`;
    }
  }

  md += `## 🎯 Alert Quality Summary\n`;
  const sortedByQuality = [...gateList].sort((a, b) => a.avgQuality - b.avgQuality);
  if (sortedByQuality.length > 0) {
    const worst = sortedByQuality[0];
    const best = sortedByQuality[sortedByQuality.length - 1];
    md += `- **Worst Quality**: ${worst.gateKey} (${worst.avgQuality.toFixed(1)}점) - 알림 튜닝(Suppress/Rule 수정) 권장\n`;
    md += `- **Best Quality**: ${best.gateKey} (${best.avgQuality.toFixed(1)}점)\n\n`;
  } else {
    md += `알림 발송 이력이 없습니다.\n\n`;
  }

  md += `## 💡 Action Items (Recommendation)\n`;
  let hasActions = false;
  for (const g of gateList) {
    if (g.deadJobs > 10) {
      md += `- **[${g.gateKey}]** Dead Job이 ${g.deadJobs}건 발생했습니다. Retry 정책 또는 원인 분석이 시급합니다.\n`;
      hasActions = true;
    }
    if (g.avgQuality < 60) {
      md += `- **[${g.gateKey}]** Alert Quality가 낮습니다(${g.avgQuality.toFixed(1)}). \`ops_gate_settings\`에서 Alert Policy를 조정하여 피로도를 낮추세요.\n`;
      hasActions = true;
    }
    if (g.playbookRuns > 5) {
      md += `- **[${g.gateKey}]** Playbook 수동 실행이 ${g.playbookRuns}회 발생했습니다. 해당 조치의 자동화를 검토하세요.\n`;
      hasActions = true;
    }
  }
  if (!hasActions) {
    md += `- 이번 주는 권장 Action Item이 없습니다.\n`;
  }

  // Firestore에 저장 (ops_incident_summaries 와 비슷한 별도 컬렉션)
  const reviewRef = db.collection("ops_weekly_reviews").doc(`review_${weekStr}`);
  await reviewRef.set({
    week: weekStr,
    startDate: startStr,
    endDate: endStr,
    markdown: md,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await logOpsEvent(adminApp, {
    gateKey: "system",
    action: "ops_review.weekly",
    status: "success",
    actorUid: "system",
    requestId: `review_${Date.now()}`,
    summary: `Weekly Ops Review generated for ${weekStr}`,
    target: { week: weekStr }
  });
}
