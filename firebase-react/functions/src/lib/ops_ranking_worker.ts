import * as admin from "firebase-admin";

/**
 * [EP-02-02] 품질지표 및 랭킹 고도화 워커
 * - 주기적으로 활성 파트너들의 지표(평점, SLA, 가격, 속도, 리뷰 수)를 수집하여 랭킹 점수를 계산합니다.
 */
export async function processPartnerRankings(adminApp: typeof admin) {
  const db = adminApp.firestore();
  
  // 1. 활성 파트너 조회 (limit to prevent unbounded reads)
  const snapshot = await db.collection("partners").where("status", "==", "active").limit(500).get();
  
  if (snapshot.empty) return;

  const partners = snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, data: doc.data() }));

  // 2. Batch-fetch active case counts (avoids N+1 query pattern)
  const activeStatuses = ["draft", "collecting", "packaging"];
  const activeCaseCounts = new Map<string, number>();
  const partnerIds = partners.map(p => p.id);
  for (let i = 0; i < partnerIds.length; i += 30) {
    const batch = partnerIds.slice(i, i + 30);
    const snap = await db.collection("cases")
      .where("partnerId", "in", batch)
      .where("status", "in", activeStatuses)
      .get();
    for (const doc of snap.docs) {
      const pid = doc.data().partnerId;
      activeCaseCounts.set(pid, (activeCaseCounts.get(pid) || 0) + 1);
    }
  }

  // 3. 상대 평가를 위한 최대값 도출 (가격, 처리시간, 리뷰 수)
  const maxPrice = Math.max(...partners.map(p => p.data.price || 1), 1);
  const maxEta = Math.max(...partners.map(p => p.data.etaHours || 1), 1);
  const maxReviews = Math.max(...partners.map(p => p.data.reviewCount || 1), 1);

  // 3. Firestore Batch 업데이트 (Limit: 500)
  const batches: admin.firestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let operationCount = 0;

  for (const partner of partners) {
    const p = partner.data;

    const rating = p.rating || 0;
    const slaComplianceRate = p.slaComplianceRate || 0;
    const price = p.price || 0;
    const etaHours = p.etaHours || 24;
    const reviewCount = p.reviewCount || 0;
    const maxCapacity = p.maxCapacity || 50; // 기본 최대 수용량

    const activeCaseCount = activeCaseCounts.get(partner.id) || 0;

    // [EP-12-02] 파트너 실시간 업무 부하(Capacity) 기반 동적 매칭 최적화
    // 가용량 대비 현재 부하 비율 (0 ~ 1)
    const loadRatio = Math.min(activeCaseCount / maxCapacity, 1);
    
    // 랭킹 가중치 고도화 로직 (총점 100점 만점)
    const scoreRating = (rating / 5) * 35;                 // 평점 (35%)
    const scoreSla = (slaComplianceRate / 100) * 20;       // SLA 준수율 (20%로 하향)
    const scorePrice = (1 - (price / maxPrice)) * 15;      // 가격 경쟁력 (15%)
    const scoreEta = (1 - (etaHours / maxEta)) * 10;       // 처리 속도 (10%)
    const scoreReview = (reviewCount / maxReviews) * 10;   // 경험치/리뷰 수 (10%)
    
    // 부하가 적을수록 높은 점수 부여 (10%)
    const scoreCapacity = (1 - loadRatio) * 10;            // 가용성 (10%)

    // 최종 랭킹 스코어 계산
    const rankingScore = scoreRating + scoreSla + scorePrice + scoreEta + scoreReview + scoreCapacity;

    // 부하가 100%에 도달하면 신규 매칭에서 불이익을 주거나 일시적으로 숨김 처리 가능
    const isOverloaded = loadRatio >= 1;

    // 품질 등급(Tier) 산정
    let qualityTier = "Bronze";
    if (rankingScore >= 90) qualityTier = "Platinum";
    else if (rankingScore >= 80) qualityTier = "Gold";
    else if (rankingScore >= 70) qualityTier = "Silver";

    currentBatch.update(partner.ref, {
      rankingScore,
      qualityTier,
      activeCaseCount,
      isOverloaded,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    operationCount++;

    // 500개 도달 시 새로운 배치 생성
    if (operationCount === 490) { // Firestore limit is 500, keeping it safe
      batches.push(currentBatch);
      currentBatch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    batches.push(currentBatch);
  }

  // 병렬로 전체 배치 커밋
  await Promise.all(batches.map(batch => batch.commit()));
}
