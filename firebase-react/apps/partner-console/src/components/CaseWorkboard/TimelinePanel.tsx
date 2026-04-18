import { useState } from "react";
import { ensureLogin, apiBase } from "../../api";
import { formatEventTime } from "../../utils/dateUtils";

interface Props {
  caseId: string;
  timeline: any[];
  onLog: (msg: string) => void;
  busy: boolean;
}

export function TimelinePanel({ caseId, timeline, onLog, busy }: Props) {
  const [filterCore, setFilterCore] = useState(true);

  const downloadFile = async (path: string, defaultName: string) => {
    try {
      const token = await ensureLogin();
      // Ensure path starts with /
      const safePath = path.startsWith("/") ? path : `/${path}`;
      const resp = await fetch(`${apiBase}${safePath}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        const json = await resp.json().catch(() => null);
        throw new Error(json?.error?.messageKo || "다운로드 실패");
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Extract filename from path or use default
      const filename = path.split("/").pop() || defaultName;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onLog(`downloaded ${filename} from timeline`);
    } catch (e: any) {
      onLog(`[오류] 다운로드 실패: ${String(e?.message || e)}`);
    }
  };

  const CORE_EVENTS = [
    "WORKFLOW_STAGE_CHANGED", 
    "DOCUMENT_REVIEWED_NEEDS_FIX", 
    "SIGNATURE_TASK_COMPLETED", 
    "PACKAGE_READY", 
    "CASE_STATUS_CHANGED"
  ];

  const filteredTimeline = filterCore 
    ? timeline.filter(e => CORE_EVENTS.includes(e.type))
    : timeline;

  const getBadgeStyle = (type: string) => {
    if (type === "PACKAGE_READY") return { bg: "#f6ffed", color: "#389e0d", border: "#b7eb8f" };
    if (type === "WORKFLOW_STAGE_CHANGED") return { bg: "#e6f7ff", color: "#096dd9", border: "#91d5ff" };
    if (type === "CASE_STATUS_CHANGED") return { bg: "#f9f0ff", color: "#531dab", border: "#d3adf7" };
    if (type === "DOCUMENT_REVIEWED_NEEDS_FIX") return { bg: "#fff2f0", color: "#cf1322", border: "#ffa39e" };
    if (type === "SIGNATURE_TASK_COMPLETED") return { bg: "#fcffe6", color: "#5b8c00", border: "#eaff8f" };
    return { bg: "#f5f5f5", color: "#595959", border: "#d9d9d9" };
  };

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, background: "#fff", marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>이력 타임라인</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
          <input 
            type="checkbox" 
            checked={filterCore} 
            onChange={(e) => setFilterCore(e.target.checked)} 
          />
          핵심 이벤트만 보기
        </label>
      </div>

      {filteredTimeline.length === 0 ? (
        <div style={{ color: "#666", fontSize: 14 }}>조건에 맞는 이벤트가 없습니다.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {filteredTimeline.slice(0, 15).map((e) => {
            const isPackageReady = e.type === "PACKAGE_READY";
            const badge = getBadgeStyle(e.type);
            
            return (
              <li key={e.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #f0f0f0", fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                  <span style={{ 
                    background: badge.bg, 
                    color: badge.color, 
                    border: `1px solid ${badge.border}`, 
                    padding: "2px 8px", 
                    borderRadius: 12, 
                    fontSize: 12, 
                    fontWeight: 600 
                  }}>
                    {e.type}
                  </span>
                  <span style={{ color: "#999", fontSize: 12 }}>
                    {formatEventTime(e)}
                  </span>
                </div>
                <div style={{ color: "#333", fontWeight: 500, marginBottom: 4 }}>{e.summaryKo}</div>
                
                {isPackageReady && (
                  <div style={{ marginTop: 10, padding: 12, background: "#fafafa", borderRadius: 6, border: "1px dashed #d9d9d9" }}>
                    <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
                      <strong>생성 사유:</strong> {e.meta?.reasonKo || "제출 완료 및 승인"}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button 
                        disabled={busy} 
                        onClick={() => downloadFile(e.meta?.submissionPackagePath || `v1/cases/${caseId}/packages/submission.zip`, `submission_package_${caseId}.zip`)}
                        style={{ padding: "6px 12px", background: "#1890ff", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: "bold" }}
                      >
                        📦 패키지 다운로드 (ZIP)
                      </button>
                      <button 
                        disabled={busy} 
                        onClick={() => downloadFile(e.meta?.closingReportPath || `v1/cases/${caseId}/reports/closing.docx`, `closing_report_${caseId}.docx`)}
                        style={{ padding: "6px 12px", background: "#fff", border: "1px solid #1890ff", color: "#1890ff", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: "bold" }}
                      >
                        📄 리포트 다운로드 (DOCX)
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
