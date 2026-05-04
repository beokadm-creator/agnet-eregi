import { Link } from "react-router-dom";

const CARDS = [
  {
    title: "분류 기준",
    description: "파트너의 지역, 전문분야, 태그, scenarioKey 허용값을 관리합니다.",
    path: "/partner-taxonomy",
    cta: "파트너 분류 열기",
    bullets: [
      "매칭에 쓰는 공통 분류 체계를 정리합니다.",
      "운영자가 입력 실수 없이 허용값 기준을 확인할 수 있습니다.",
    ],
  },
  {
    title: "점수 규칙",
    description: "matchScore 계산에 반영되는 항목별 가중치를 조정합니다.",
    path: "/matching-weights",
    cta: "매칭 가중치 열기",
    bullets: [
      "새 추천 결과부터 즉시 반영됩니다.",
      "튜닝 전후 영향 범위를 디버그 화면에서 함께 확인하는 것이 좋습니다.",
    ],
  },
  {
    title: "결과 검증",
    description: "세션 단위로 추천 점수, 근거, taxonomy/weights 적용 결과를 점검합니다.",
    path: "/matching-debug",
    cta: "매칭 디버그 열기",
    bullets: [
      "세션 ID 기준으로 현재 추천 결과를 추적합니다.",
      "분류 기준과 점수 규칙 수정 후 검증 단계로 사용합니다.",
    ],
  },
];

export default function MatchingSettings() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 className="ops-title">매칭 설정</h1>
        <p className="ops-subtitle">매칭 엔진의 기준값, 점수 규칙, 결과 검증 도구를 한곳에서 정리합니다.</p>
      </div>

      <div className="ops-panel">
        <div className="ops-panel-body" style={{ display: "grid", gap: 16 }}>
          <div style={{ fontSize: 13, color: "var(--ops-text-muted)", lineHeight: 1.7 }}>
            현재 구조는 내부 운영 도구 단위로 나뉘어 있습니다. 일반 운영자는 아래 순서대로 접근하면 됩니다.
            <br />
            1. 분류 기준 확인 {"->"} 2. 점수 규칙 조정 {"->"} 3. 결과 검증
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {CARDS.map((card) => (
              <div key={card.path} className="ops-panel" style={{ background: "var(--ops-bg)" }}>
                <div className="ops-panel-header">
                  <h2 className="ops-panel-title">{card.title}</h2>
                  <span className="ops-badge ops-badge-brand">매칭</span>
                </div>
                <div className="ops-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 13, color: "var(--ops-text-muted)", lineHeight: 1.6 }}>
                    {card.description}
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {card.bullets.map((bullet) => (
                      <div key={bullet} style={{ fontSize: 12, color: "var(--ops-text-muted)", lineHeight: 1.5 }}>
                        - {bullet}
                      </div>
                    ))}
                  </div>
                  <Link to={card.path} className="ops-btn ops-btn-brand" style={{ width: "fit-content", textDecoration: "none" }}>
                    {card.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
