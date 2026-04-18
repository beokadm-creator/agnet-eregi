import { useEffect } from "react";
import { useCaseDetail } from "../../hooks/useCaseDetail";
import { StageHeader } from "./StageHeader";
import { DocsReviewPanel } from "./DocsReviewPanel";
import { DraftFilingPanel } from "./DraftFilingPanel";
import { FilingSubmittedPanel } from "./FilingSubmittedPanel";
import { CompletionPanel } from "./CompletionPanel";
import { TimelinePanel } from "./TimelinePanel";

interface Props {
  caseId: string;
  onLog: (msg: string) => void;
}

export function CaseWorkboardPage({ caseId, onLog }: Props) {
  const {
    busy,
    error,
    caseDetail,
    timeline,
    documents,
    workflow,
    casePack,
    filing,
    form,
    requiredSlots,
    load,
    advanceStage
  } = useCaseDetail(caseId);

  useEffect(() => {
    if (error) onLog(`Error: ${error}`);
  }, [error, onLog]);

  if (!caseId) return <div>선택된 케이스가 없습니다.</div>;
  if (!caseDetail && busy) return <div>로딩 중...</div>;
  if (!caseDetail && !busy) return <div>케이스 정보를 불러올 수 없습니다.</div>;

  const stage = workflow?.stage || "unknown";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div style={{ padding: 12, background: "#fff2f0", border: "1px solid #ffccc7", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#cf1322", fontSize: 14 }}>
            <strong>네트워크 오류:</strong> {error}
          </div>
          <button 
            onClick={load} 
            disabled={busy}
            style={{ padding: "6px 12px", background: "#ff4d4f", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
          >
            다시 시도
          </button>
        </div>
      )}

      <StageHeader 
        caseDetail={caseDetail}
        workflow={workflow}
        casePack={casePack}
        onAdvance={advanceStage}
        busy={busy}
      />

      {/* Docs Review Panel */}
      {stage === "docs_review" && (
        <DocsReviewPanel 
          caseId={caseId}
          documents={documents}
          onLog={onLog}
          onRefresh={load}
          busy={busy}
        />
      )}

      {/* Draft Filing Panel */}
      {stage === "draft_filing" && (
        <DraftFilingPanel 
          caseId={caseId}
          documents={documents}
          form={form}
          requiredSlots={requiredSlots}
          onLog={onLog}
          onRefresh={load}
          busy={busy}
        />
      )}

      {/* Filing Submitted Panel */}
      {stage === "filing_submitted" && (
        <FilingSubmittedPanel 
          caseId={caseId}
          filing={filing}
          documents={documents}
          onLog={onLog}
          onRefresh={load}
          busy={busy}
        />
      )}

      {/* Completion Panel */}
      {stage === "completed" && (
        <CompletionPanel 
          caseId={caseId}
          onLog={onLog}
          busy={busy}
        />
      )}

      {/* Timeline Panel */}
      <TimelinePanel 
        caseId={caseId}
        timeline={timeline}
        onLog={onLog}
        busy={busy}
      />
    </div>
  );
}
