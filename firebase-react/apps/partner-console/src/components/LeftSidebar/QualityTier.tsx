import { useAppContext } from "../../context/AppContext";

export default function QualityTier() {
  const { partnerProfile } = useAppContext();

  if (!partnerProfile) return null;

  return (
    <div style={{ marginBottom: 20, padding: 16, background: partnerProfile.qualityTier === 'Platinum' ? 'var(--ar-paper-alt)' : partnerProfile.qualityTier === 'Gold' ? 'var(--ar-warning-soft)' : partnerProfile.qualityTier === 'Silver' ? 'var(--ar-paper-alt)' : 'var(--ar-paper-alt)', borderRadius: "var(--ar-r1)", border: `1px solid ${partnerProfile.qualityTier === 'Platinum' ? 'var(--ar-hairline)' : partnerProfile.qualityTier === 'Gold' ? 'var(--ar-warning-soft)' : partnerProfile.qualityTier === 'Silver' ? 'var(--ar-hairline)' : 'var(--ar-hairline)'}` }}>
      <h3 style={{ margin: "0 0 8px 0", color: "var(--ar-ink)", fontSize: "1.1em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        내 품질 지표 및 등급
        <span style={{ padding: "4px 10px", borderRadius: "var(--ar-r2)", fontSize: "0.8em", background: partnerProfile.qualityTier === 'Platinum' ? 'var(--ar-graphite)' : partnerProfile.qualityTier === 'Gold' ? 'var(--ar-warning)' : partnerProfile.qualityTier === 'Silver' ? 'var(--ar-fog)' : 'var(--ar-accent)', color: "var(--ar-canvas)", fontWeight: "bold" }}>
          {partnerProfile.qualityTier} Tier
        </span>
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.9em", color: "var(--ar-graphite)" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>종합 랭킹 점수 (Ranking Score)</span>
          <strong style={{ color: "var(--ar-accent)" }}>{Number(partnerProfile.rankingScore).toFixed(1)} / 100 점</strong>
        </div>
        <progress value={partnerProfile.rankingScore} max="100" style={{ width: "100%", height: 8, marginTop: 4 }}></progress>
        <div style={{ fontSize: "0.8em", color: "var(--ar-slate)", marginTop: 4 }}>
          * 점수는 평점({partnerProfile.rating}★), SLA 준수율({partnerProfile.slaComplianceRate}%), 가격 경쟁력, 처리 속도 등을 종합하여 매일 갱신됩니다.
        </div>
      </div>
    </div>
  );
}
