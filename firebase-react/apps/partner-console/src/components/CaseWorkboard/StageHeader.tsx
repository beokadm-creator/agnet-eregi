interface Props {
  caseDetail: any;
  workflow: any;
  casePack: any;
  onAdvance: () => void;
  busy: boolean;
}

export function StageHeader({ caseDetail, workflow, casePack, onAdvance, busy }: Props) {
  const stage = workflow?.stage ?? "없음";
  const canAdvance = workflow?._advance?.canAdvance ?? false;
  const reasonKo = workflow?._advance?.reasonKo ?? "";
  const nextStage = workflow?._advance?.nextStage ?? "-";

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <h2 style={{ margin: "0 0 8px 0", fontSize: 20 }}>
          {casePack?.nameKo ?? caseDetail.casePackId}
          <span style={{ fontSize: 14, color: "#666", marginLeft: 12 }}>#{caseDetail.id}</span>
        </h2>
        <div style={{ fontSize: 14, color: "#444" }}>
          현재 단계: <strong style={{ color: "#1890ff" }}>{stage}</strong> 
          <span style={{ margin: "0 8px" }}>|</span> 
          상태: <strong>{caseDetail.status}</strong>
        </div>
        
        {workflow?._advance && (
          <div style={{ fontSize: 13, marginTop: 6, color: canAdvance ? "green" : "#d4380d" }}>
            다음 단계 ({nextStage}) 진행 {canAdvance ? "가능" : "불가"}
            {!canAdvance && reasonKo && ` - 사유: ${reasonKo}`}
          </div>
        )}
      </div>

      <div>
        <button 
          onClick={onAdvance} 
          disabled={busy || !canAdvance}
          style={{ 
            padding: "8px 16px", 
            background: canAdvance ? "#1890ff" : "#f5f5f5", 
            color: canAdvance ? "#fff" : "#b8b8b8",
            border: "1px solid #d9d9d9",
            borderRadius: 6,
            cursor: canAdvance ? "pointer" : "not-allowed",
            fontWeight: "bold"
          }}
          title={canAdvance ? "다음 단계로 넘어갑니다." : reasonKo}
        >
          다음 단계로
        </button>
      </div>
    </div>
  );
}
