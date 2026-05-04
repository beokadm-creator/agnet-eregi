import { useAppContext } from "../../context/AppContext";

export default function QualityTier() {
  const { partnerProfile } = useAppContext();

  if (!partnerProfile) return null;

  const isPlatinum = partnerProfile.qualityTier === 'Platinum';
  const isGold = partnerProfile.qualityTier === 'Gold';
  const isSilver = partnerProfile.qualityTier === 'Silver';

  return (
    <div style={{ 
      background: isPlatinum ? 'linear-gradient(135deg, #f0f4f8, #d9e2ec)' : isGold ? 'var(--pc-warning-soft)' : 'var(--pc-surface)', 
      borderRadius: "var(--pc-radius)", 
      border: `1px solid ${isPlatinum ? '#bcccdc' : isGold ? 'var(--pc-warning)' : 'var(--pc-border)'}`,
      padding: 24
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: "var(--pc-text)", fontSize: 16, fontWeight: 700 }}>
          내 품질 지표 및 등급
        </h3>
        <span className={`pc-badge ${isPlatinum ? 'pc-badge-neutral' : isGold ? 'pc-badge-warning' : isSilver ? 'pc-badge-neutral' : 'pc-badge-brand'}`} style={{ fontWeight: 800 }}>
          {partnerProfile.qualityTier} Tier
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
          <span style={{ color: "var(--pc-text-muted)" }}>종합 랭킹 점수 (Ranking Score)</span>
          <strong style={{ color: "var(--pc-brand)" }}>{Number(partnerProfile.rankingScore).toFixed(1)} / 100 점</strong>
        </div>
        <progress value={partnerProfile.rankingScore} max="100" style={{ width: "100%", height: 8, marginTop: 4, borderRadius: 4, overflow: "hidden" }}></progress>
        <div style={{ fontSize: 12, color: "var(--pc-text-muted)", marginTop: 8, lineHeight: 1.5 }}>
          * 점수는 평점({partnerProfile.rating}★), SLA 준수율({partnerProfile.slaComplianceRate}%), 가격 경쟁력, 처리 속도 등을 종합하여 매일 갱신됩니다.
        </div>
      </div>
    </div>
  );
}
