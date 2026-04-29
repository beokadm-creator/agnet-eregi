import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../apiBase";
import { useAuth } from "../context/AuthContext";

type ApplicationStatus = "pending" | "approved" | "rejected" | "";

export default function PartnerApply() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [status, setStatus] = useState<ApplicationStatus>("");

  const [bizName, setBizName] = useState("");
  const [bizRegNo, setBizRegNo] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [note, setNote] = useState("");

  async function apiCall(path: string, init: RequestInit = {}) {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.ok === false) throw new Error(json?.error?.messageKo || json?.error?.code || `HTTP ${res.status}`);
    return json?.data ?? json;
  }

  async function load() {
    setBusy(true);
    setLog("");
    try {
      const data = await apiCall("/v1/partners/applications/me");
      const app = data?.application;
      if (!app) {
        setStatus("");
        return;
      }
      setStatus(String(app.status || "") as ApplicationStatus);
      setBizName(String(app.bizName || ""));
      setBizRegNo(String(app.bizRegNo || ""));
      setContactName(String(app.contactName || ""));
      setContactPhone(String(app.contactPhone || ""));
      setNote(String(app.note || ""));
    } catch (e: any) {
      setLog(`[Error] ${e?.message || "불러오기 실패"}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (token) load();
  }, [token]);

  async function submit() {
    setBusy(true);
    setLog("");
    try {
      await apiCall("/v1/partners/applications", {
        method: "POST",
        body: JSON.stringify({ bizName, bizRegNo, contactName, contactPhone, note }),
      });
      setStatus("pending");
      setLog("신청이 접수되었습니다. 운영 검토 후 승인됩니다.");
    } catch (e: any) {
      setLog(`[Error] ${e?.message || "신청 실패"}`);
    } finally {
      setBusy(false);
    }
  }

  const isReadOnly = status === "pending" || status === "approved";

  return (
    <div className="uw-container" style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 40, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="ar-eyebrow" style={{ color: "var(--uw-brand)", marginBottom: 8 }}>파트너스</div>
          <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>법무사 파트너 지원</h2>
        </div>
        <button className="uw-btn uw-btn-outline uw-btn-sm" onClick={() => navigate("/")}>대시보드로</button>
      </div>

      <div className="uw-card" style={{ padding: '40px' }}>
        <p style={{ color: "var(--uw-slate)", fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          AgentRegi 파트너로 합류하여 전국 고객들의 등기 사건을 쉽고 빠르게 처리하세요.<br/>
          제출된 신청서는 운영팀의 검토를 거쳐 1~2일 내에 승인됩니다.
        </p>

        {status && (
          <div style={{ marginBottom: 32, padding: "20px", borderRadius: 16, background: status === "approved" ? "var(--uw-success-soft)" : status === "pending" ? "var(--uw-surface-hover)" : "var(--uw-danger-soft)", border: "1px solid", borderColor: status === "approved" ? "var(--uw-success)" : status === "pending" ? "var(--uw-border-strong)" : "var(--uw-danger)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: status === "approved" ? "var(--uw-success)" : status === "pending" ? "var(--uw-ink)" : "var(--uw-danger)" }}>
              {status === "pending" ? "검토 진행 중입니다" : status === "approved" ? "승인 완료!" : "승인 거부"}
            </div>
            <div style={{ marginTop: 8, color: status === "approved" ? "#065F46" : "var(--uw-slate)", fontSize: 14 }}>
              {status === "approved" && "아래 파트너 콘솔로 이동하여 서비스를 시작하세요:\nhttps://agentregi-partner-console.web.app"}
              {status === "pending" && "접수된 정보에 문제가 없다면 1~2일 내에 승인 처리됩니다."}
              {status === "rejected" && "내용을 보완하여 다시 제출해주시면 재검토하겠습니다."}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 24 }}>
          <Field label="법무사 / 법무법인 명" value={bizName} onChange={setBizName} disabled={busy || isReadOnly} placeholder="예) 해담 법무사 사무소" />
          <Field label="사업자등록번호 (선택)" value={bizRegNo} onChange={setBizRegNo} disabled={busy || isReadOnly} placeholder="예) 123-45-67890" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Field label="담당자 성함" value={contactName} onChange={setContactName} disabled={busy || isReadOnly} placeholder="예) 홍길동 법무사" />
            <Field label="연락처 (선택)" value={contactPhone} onChange={setContactPhone} disabled={busy || isReadOnly} placeholder="예) 010-1234-5678" />
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--uw-ink)" }}>추가 전달사항 (선택)</div>
            <textarea
              className="uw-input"
              value={note}
              disabled={busy || isReadOnly}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              style={{ height: 'auto', paddingTop: 14, paddingBottom: 14, resize: 'vertical' }}
              placeholder="특화된 등기 분야가 있다면 적어주세요."
            />
          </div>
        </div>

        <div style={{ marginTop: 40, display: "flex", gap: 12 }}>
          <button
            onClick={submit}
            disabled={busy || isReadOnly || !bizName.trim() || !contactName.trim()}
            className="uw-btn uw-btn-brand"
            style={{ flex: 1 }}
          >
            {status === "rejected" ? "다시 제출하기" : "파트너 신청하기"}
          </button>
          <button onClick={load} disabled={busy} className="uw-btn uw-btn-outline" style={{ padding: "0 20px" }}>
            ↻
          </button>
        </div>

        {log && (
          <div style={{ marginTop: 16, textAlign: 'center', color: log.startsWith("[Error]") ? "var(--uw-danger)" : "var(--uw-slate)", fontSize: 14 }}>
            {log}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--uw-ink)" }}>{label}</div>
      <input
        className="uw-input"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
