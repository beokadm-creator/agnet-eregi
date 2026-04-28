import { Button } from "@agentregi/ui-components";
import { useAppContext } from "../../context/AppContext";

export default function CaseHeader() {
  const { selectedCase, setSelectedCase, lastPolledAt, pollError, busy, loadCaseDetail } = useAppContext();

  if (!selectedCase) return null;

  const statusText: Record<string, string> = {
    draft: "작성중",
    collecting: "수집중",
    packaging: "패키징중",
    ready: "준비됨",
    failed: "실패",
    completed: "완료됨"
  };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div>
        <h2 style={{ margin: "0 0 4px 0", color: "var(--ar-accent)", fontSize: "1.4em" }}>{selectedCase.title}</h2>
        <div style={{ fontSize: "0.85em", color: "var(--ar-graphite)" }}>ID: {selectedCase.id}</div>
        {selectedCase.submissionId && (
          <div style={{ fontSize: "0.85em", color: "var(--ar-accent)", fontWeight: "bold", marginTop: 4 }}>
            🔗 원본 User Submission 연동됨: {selectedCase.submissionId}
          </div>
        )}
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          {lastPolledAt && (
            <span style={{ fontSize: "0.8em", color: "var(--ar-graphite)" }}>
              마지막 갱신: {lastPolledAt.toLocaleTimeString()}
            </span>
          )}
          {pollError && (
            <span style={{ fontSize: "0.8em", color: "var(--ar-danger)", background: "var(--ar-danger-soft)", padding: "2px 6px", borderRadius: "var(--ar-r1)" }}>
              ⚠️ 연결 오류
            </span>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>상태: {statusText[selectedCase.status] || selectedCase.status.toUpperCase()}</div>
        <Button 
          onClick={() => loadCaseDetail(selectedCase.id)} 
          disabled={busy} 
          style={{ background: "var(--ar-surface-muted)", border: "1px solid var(--ar-fog)", padding: "4px 8px", borderRadius: "var(--ar-r1)", cursor: "pointer", fontSize: "0.8em", marginRight: 8 }}
        >
          상세 새로고침
        </Button>
        <Button 
          onClick={() => setSelectedCase(null)} 
          style={{ background: "none", border: "1px solid var(--ar-fog)", padding: "4px 8px", borderRadius: "var(--ar-r1)", cursor: "pointer", fontSize: "0.8em" }}
        >
          뒤로가기
        </Button>
      </div>
    </div>
  );
}
