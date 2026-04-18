import { useState, useEffect } from "react";
import { apiPost } from "../../api";
import { DocumentUploadWidget } from "./DocumentUploadWidget";
import { InlineError } from "./InlineError";

interface Props {
  caseId: string;
  documents: any[];
  form: any;
  requiredSlots: string[];
  onLog: (msg: string) => void;
  onRefresh: () => void;
  busy: boolean;
}

export function DraftFilingPanel({ caseId, documents, form, requiredSlots, onLog, onRefresh, busy }: Props) {
  const [localForm, setLocalForm] = useState<any>({
    companyName: "",
    meetingDate: "2026-01-01",
    resolutionKo: "임원 변경의 건",
    principalName: "",
    agentName: "",
    scopeKo: "임원 변경 등기 신청 관련 일체",
    officers: []
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (form) {
      setLocalForm({
        companyName: form.companyName || "",
        meetingDate: form.meetingDate || "2026-01-01",
        resolutionKo: form.resolutionKo || "임원 변경의 건",
        principalName: form.principalName || "",
        agentName: form.agentName || "",
        scopeKo: form.scopeKo || "임원 변경 등기 신청 관련 일체",
        officers: form.officers || []
      });
    }
  }, [form]);

  const saveForm = async () => {
    setErrorMsg(null);
    try {
      await apiPost(`/v1/cases/${caseId}/forms/officer-change`, localForm);
      onLog("서류 입력 정보 저장 완료");
      onRefresh();
    } catch (e: any) {
      const msg = String(e?.message || e);
      onLog(`[오류] 폼 저장 실패: ${msg}`);
      setErrorMsg(`정보 저장 실패: ${msg}`);
    }
  };

  const generateTemplate = async (template: "minutes" | "poa" | "application" | "acceptance" | "resignation" | "rep_change") => {
    setErrorMsg(null);
    try {
      await apiPost(`/v1/cases/${caseId}/templates/generate`, { template, input: localForm });
      onLog(`template generated: ${template}`);
      onRefresh();
    } catch (e: any) {
      const msg = String(e?.message || e);
      onLog(`[오류] 템플릿 생성 실패(${template}): ${msg}`);
      setErrorMsg(`템플릿 생성 실패: ${msg}`);
    }
  };

  const requiredSignedSlots = requiredSlots.filter(s => s.endsWith("_signed"));
  const missingDocs = requiredSignedSlots.filter(slot => !documents.find(d => d.slotId === slot && d.status === "ok"));

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}>
      <h3 style={{ margin: "0 0 12px 0" }}>초안 작성 및 서명 확보 (draft_filing)</h3>
      <div style={{ color: "#666", marginBottom: 12, fontSize: 14 }}>
        회사 정보와 임원 변경 내역을 입력하여 문서를 자동 생성하고, 날인된 서명본을 업로드합니다.
      </div>
      
      {errorMsg && (
        <InlineError message={errorMsg} onClose={() => setErrorMsg(null)} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Form Panel */}
        <div>
          <h4 style={{ margin: "0 0 8px 0" }}>입력 정보 (임원변경)</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
            <label style={{ display: "flex", gap: 8 }}>
              <span style={{ width: 80 }}>회사명</span>
              <input value={localForm.companyName} onChange={e => setLocalForm({...localForm, companyName: e.target.value})} style={{ flex: 1 }} />
            </label>
            <label style={{ display: "flex", gap: 8 }}>
              <span style={{ width: 80 }}>회의일</span>
              <input value={localForm.meetingDate} onChange={e => setLocalForm({...localForm, meetingDate: e.target.value})} style={{ flex: 1 }} />
            </label>
            <label style={{ display: "flex", gap: 8 }}>
              <span style={{ width: 80 }}>결의/안건</span>
              <input value={localForm.resolutionKo} onChange={e => setLocalForm({...localForm, resolutionKo: e.target.value})} style={{ flex: 1 }} />
            </label>
            <button onClick={saveForm} disabled={busy} style={{ marginTop: 8, padding: 6 }}>정보 저장</button>

            <h5 style={{ margin: "12px 0 4px 0" }}>서류 자동 생성</h5>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button onClick={() => generateTemplate("minutes")} disabled={busy} style={{ padding: 4 }}>의사록</button>
              <button onClick={() => generateTemplate("poa")} disabled={busy} style={{ padding: 4 }}>위임장</button>
              <button onClick={() => generateTemplate("application")} disabled={busy} style={{ padding: 4 }}>신청서</button>
              <button onClick={() => generateTemplate("acceptance")} disabled={busy} style={{ padding: 4 }}>승낙서</button>
              <button onClick={() => generateTemplate("resignation")} disabled={busy} style={{ padding: 4 }}>사임서</button>
            </div>
          </div>
        </div>

        {/* Upload Panel */}
        <div style={{ background: "#fafafa", padding: 12, borderRadius: 6 }}>
          <h4 style={{ margin: "0 0 8px 0" }}>서명본 업로드</h4>
          
          <div style={{ fontSize: 13, marginBottom: 12, color: missingDocs.length === 0 ? "green" : "red" }}>
            {missingDocs.length === 0 ? "✅ 모든 필수 서명본이 확보되었습니다." : `누락 서명본: ${missingDocs.join(", ")}`}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {requiredSignedSlots.map(slot => {
              const isOk = documents.some(d => d.slotId === slot && d.status === "ok");
              if (isOk) {
                return (
                  <div key={slot} style={{ padding: 8, border: "1px solid #b7eb8f", background: "#f6ffed", borderRadius: 4, fontSize: 13 }}>
                    ✅ {slot} (확보 완료)
                  </div>
                );
              }
              return (
                <DocumentUploadWidget 
                  key={slot}
                  caseId={caseId}
                  slotId={slot}
                  label={slot}
                  autoReviewDecision="manual"
                  onSuccess={onRefresh}
                  onLog={onLog}
                  disabled={busy}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
