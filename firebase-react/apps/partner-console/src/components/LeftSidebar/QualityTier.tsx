import React from "react";
import { useAppContext } from "../../context/AppContext";

export default function QualityTier() {
  const { partnerProfile } = useAppContext();

  if (!partnerProfile) return null;

  return (
    <div style={{ marginBottom: 20, padding: 16, background: partnerProfile.qualityTier === 'Platinum' ? '#eceff1' : partnerProfile.qualityTier === 'Gold' ? '#fff8e1' : partnerProfile.qualityTier === 'Silver' ? '#f5f5f5' : '#efebe9', borderRadius: 8, border: `1px solid ${partnerProfile.qualityTier === 'Platinum' ? '#b0bec5' : partnerProfile.qualityTier === 'Gold' ? '#ffe082' : partnerProfile.qualityTier === 'Silver' ? '#e0e0e0' : '#d7ccc8'}` }}>
      <h3 style={{ margin: "0 0 8px 0", color: "#333", fontSize: "1.1em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        내 품질 지표 및 등급
        <span style={{ padding: "4px 10px", borderRadius: 12, fontSize: "0.8em", background: partnerProfile.qualityTier === 'Platinum' ? '#546e7a' : partnerProfile.qualityTier === 'Gold' ? '#fbc02d' : partnerProfile.qualityTier === 'Silver' ? '#bdbdbd' : '#cd7f32', color: "white", fontWeight: "bold" }}>
          {partnerProfile.qualityTier} Tier
        </span>
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.9em", color: "#555" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>종합 랭킹 점수 (Ranking Score)</span>
          <strong style={{ color: "#00695c" }}>{Number(partnerProfile.rankingScore).toFixed(1)} / 100 점</strong>
        </div>
        <progress value={partnerProfile.rankingScore} max="100" style={{ width: "100%", height: 8, marginTop: 4 }}></progress>
        <div style={{ fontSize: "0.8em", color: "#888", marginTop: 4 }}>
          * 점수는 평점({partnerProfile.rating}★), SLA 준수율({partnerProfile.slaComplianceRate}%), 가격 경쟁력, 처리 속도 등을 종합하여 매일 갱신됩니다.
        </div>
      </div>
    </div>
  );
}
