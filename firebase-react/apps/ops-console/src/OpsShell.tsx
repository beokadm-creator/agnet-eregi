import { useMemo, useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
import { auth } from "@rp/firebase";
import { signInAnonymously } from "firebase/auth";
import "./App.css";

function OpsShell() {
  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE || "", []);
  const [token, setToken] = useState("");
  const [gateKey, setGateKey] = useState("pilot-gate");
  const [caseId, setCaseId] = useState("");
  const [summaryDate, setSummaryDate] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()));
  const [casePackId, setCasePackId] = useState("");
  const [casePackName, setCasePackName] = useState("");
  const [casePackSchema, setCasePackSchema] = useState('{\n  "type": "object",\n  "properties": {}\n}');
  const [refundCaseId, setRefundCaseId] = useState("");
  const [refundId, setRefundId] = useState("");
  const [accessTargetUid, setAccessTargetUid] = useState("");
  const [accessRole, setAccessRole] = useState("ops_operator");
  const [accessReason, setAccessReason] = useState("");
  const [log, setLog] = useState("ready");
  const [busy, setBusy] = useState(false);

  async function ensureToken(): Promise<string> {
    if (!auth.currentUser) await signInAnonymously(auth);
    const idToken = await auth.currentUser?.getIdToken(true);
    if (!idToken) throw new Error("Firebase auth token could not be issued.");
    setToken(idToken);
    return idToken;
  }

  async function callApi(path: string, init: RequestInit = {}) {
    setBusy(true);
    try {
      const idToken = token || await ensureToken();
      const res = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
          ...(init.headers || {}),
        },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.messageKo || json?.error?.code || `HTTP ${res.status}`);
      }
      setLog(JSON.stringify(json?.data || json, null, 2));
    } catch (error) {
      setLog(error instanceof Error ? `[Error] ${error.message}` : "[Error] Unknown failure");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "40px auto", padding: 24 }}>
      <h1>Ops Console</h1>
      <p style={{ color: "#475569" }}>
        파일럿 운영 체크리스트의 핵심 루프인 인증, 일일 Gate 요약, 케이스 상세 조회, Sev1 패키지 재생성/재검증을 바로 실행할 수 있는 빌드 가능한 운영 쉘입니다.
      </p>

      <section style={{ display: "grid", gap: 12, padding: 16, background: "white", border: "1px solid #e2e8f0", borderRadius: 12 }}>
        <label>
          Gate Key
          <Input value={gateKey} onChange={(event) => setGateKey(event.target.value)} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <label>
          Summary Date
          <Input type="date" value={summaryDate} onChange={(event) => setSummaryDate(event.target.value)} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <label>
          Case ID
          <Input value={caseId} onChange={(event) => setCaseId(event.target.value)} placeholder="case id for troubleshooting" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
      </section>

      <section style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        <Button disabled={busy} onClick={() => ensureToken().then(() => setLog("signed in"))}>익명 로그인</Button>
        <Button disabled={busy} onClick={() => callApi(`/v1/ops/reports/${gateKey}/daily?date=${summaryDate}`)}>일일 Gate 요약</Button>
        <Button disabled={busy || !caseId} onClick={() => callApi(`/v1/ops/cases/${caseId}/detail`)}>케이스 상세</Button>
        <Button disabled={busy || !caseId} onClick={() => callApi(`/v1/ops/cases/${caseId}/packages/regenerate`, { method: "POST", body: "{}" })}>패키지 재생성</Button>
        
        {/* 정산 / 광고 배치 */}
        <Button disabled={busy} onClick={() => callApi(`/v1/ops/settlements/batch`, { method: "POST", body: JSON.stringify({ periodEnd: new Date().toISOString() }) })} style={{ background: "#4caf50", color: "white" }}>
          정산 배치 강제실행
        </Button>
        <Button disabled={busy} onClick={() => callApi(`/v1/ops/ads/batch`, { method: "POST", body: JSON.stringify({ targetDate: summaryDate }) })} style={{ background: "#2196f3", color: "white" }}>
          광고 과금 배치 강제실행
        </Button>
        <Button disabled={busy} onClick={() => callApi(`/v1/ops/subscriptions/batch`, { method: "POST", body: JSON.stringify({ targetDate: summaryDate }) })} style={{ background: "#9c27b0", color: "white" }}>
          구독 결제 배치 강제실행
        </Button>
        <Button disabled={busy} onClick={() => callApi(`/v1/ops/risk/summary?gateKey=${gateKey}`)} style={{ background: "#e53935", color: "white" }}>
          리스크 지표 확인
        </Button>
        <Button disabled={busy} onClick={() => callApi(`/v1/ops/risk/${gateKey}/mitigate`, { method: "POST", body: JSON.stringify({ actionKey: "circuit_breaker_reset" }) })} style={{ background: "#b71c1c", color: "white" }}>
          리스크 완화(Mitigate) 실행
        </Button>
      </section>

      <section style={{ display: "grid", gap: 12, padding: 16, background: "white", border: "1px solid #e2e8f0", borderRadius: 12, marginTop: 16 }}>
        <h3 style={{ margin: 0 }}>📦 사건팩(Case Pack) 관리</h3>
        <label>
          Case Pack ID (영문/숫자)
          <Input value={casePackId} onChange={(event) => setCasePackId(event.target.value)} placeholder="ex: real_estate_transfer_v1" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <label>
          사건명 (Korean)
          <Input value={casePackName} onChange={(event) => setCasePackName(event.target.value)} placeholder="ex: 부동산 소유권 이전" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <label>
          입력 폼 스키마 (JSON Schema)
          <textarea 
            value={casePackSchema} 
            onChange={(event) => setCasePackSchema(event.target.value)} 
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4, height: 100, fontFamily: "monospace" }} 
          />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <Button 
            disabled={busy || !casePackId || !casePackName} 
            onClick={() => {
              let parsedSchema = { type: "object", properties: {} };
              try { parsedSchema = JSON.parse(casePackSchema); } catch(e) {}
              callApi(`/v1/ops/case-packs`, { 
                method: "POST", 
                body: JSON.stringify({
                  id: casePackId,
                  nameKo: casePackName,
                  active: true,
                  formSchema: parsedSchema,
                  workflow: { stages: ["draft_filing", "review", "completed"], requiredSlots: ["id_card"] }
                }) 
              });
            }}
            style={{ background: "#ff9800", color: "white", padding: "8px 16px" }}
          >
            사건팩 생성 (Create)
          </Button>
          
          <Button 
            disabled={busy || !casePackId} 
            onClick={() => {
              let parsedSchema = { type: "object", properties: {} };
              try { parsedSchema = JSON.parse(casePackSchema); } catch(e) {}
              callApi(`/v1/ops/case-packs/${casePackId}`, { 
                method: "PUT", 
                body: JSON.stringify({
                  nameKo: casePackName || undefined,
                  formSchema: parsedSchema
                }) 
              });
            }}
            style={{ background: "#ff5722", color: "white", padding: "8px 16px" }}
          >
            사건팩 수정 (Update)
          </Button>
        </div>
      </section>

      <section style={{ display: "grid", gap: 12, padding: 16, background: "white", border: "1px solid #e2e8f0", borderRadius: 12, marginTop: 16 }}>
        <h3 style={{ margin: 0, color: "#d32f2f" }}>💸 결제 취소 및 환불 실행 (Refund Execution)</h3>
        <label>
          Case ID
          <Input value={refundCaseId} onChange={(event) => setRefundCaseId(event.target.value)} placeholder="ex: case_xxx" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <label>
          Refund ID
          <Input value={refundId} onChange={(event) => setRefundId(event.target.value)} placeholder="ex: refund_xxx" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <Button 
            disabled={busy || !refundCaseId || !refundId} 
            onClick={() => {
              callApi(`/v1/ops/cases/${refundCaseId}/refunds/${refundId}/execute`, { 
                method: "POST", 
                body: JSON.stringify({}) 
              });
            }}
            style={{ background: "#d32f2f", color: "white", padding: "8px 16px" }}
          >
            환불 실행 (Stripe / TossPayments)
          </Button>
        </div>
      </section>

      <section style={{ display: "grid", gap: 12, padding: 16, background: "white", border: "1px solid #e2e8f0", borderRadius: 12, marginTop: 16 }}>
        <h3 style={{ margin: 0, color: "#1976d2" }}>🔐 Access Management (Ops 권한 관리)</h3>
        
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <Button 
            disabled={busy} 
            onClick={() => callApi(`/v1/ops/access/users`)}
            style={{ background: "#1976d2", color: "white", padding: "6px 12px" }}
          >
            권한 현황 조회
          </Button>
          <Button 
            disabled={busy || !accessReason} 
            onClick={() => callApi(`/v1/ops/access/breakglass`, { method: "POST", body: JSON.stringify({ reason: accessReason }) })}
            style={{ background: "#e53935", color: "white", padding: "6px 12px" }}
          >
            Break-glass 긴급 권한 (30분)
          </Button>
        </div>

        <label>
          대상 UID (Target UID)
          <Input value={accessTargetUid} onChange={(event) => setAccessTargetUid(event.target.value)} placeholder="ex: uid_xxxx" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        
        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ flex: 1 }}>
            권한 (Role)
            <select value={accessRole} onChange={(event) => setAccessRole(event.target.value)} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
              <option value="ops_viewer">ops_viewer (조회 전용)</option>
              <option value="ops_operator">ops_operator (수동 액션 가능)</option>
              <option value="ops_admin">ops_admin (전체 제어)</option>
            </select>
          </label>
          <label style={{ flex: 2 }}>
            사유 (Reason)
            <Input value={accessReason} onChange={(event) => setAccessReason(event.target.value)} placeholder="권한 부여/회수 또는 긴급권한 사유 입력" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Button 
            disabled={busy || !accessTargetUid || !accessRole || !accessReason} 
            onClick={() => callApi(`/v1/ops/access/grant`, { method: "POST", body: JSON.stringify({ targetUid: accessTargetUid, role: accessRole, reason: accessReason }) })}
            style={{ background: "#43a047", color: "white", padding: "6px 12px" }}
          >
            권한 부여 (Grant)
          </Button>
          <Button 
            disabled={busy || !accessTargetUid || !accessReason} 
            onClick={() => callApi(`/v1/ops/access/revoke`, { method: "POST", body: JSON.stringify({ targetUid: accessTargetUid, reason: accessReason }) })}
            style={{ background: "#f57c00", color: "white", padding: "6px 12px" }}
          >
            권한 회수 (Revoke)
          </Button>
        </div>
      </section>

      <section style={{ display: "grid", gap: 12, padding: 16, background: "white", border: "1px solid #e2e8f0", borderRadius: 12, marginTop: 16 }}>
        <h3 style={{ margin: 0, color: "#9c27b0" }}>📊 Observability & Monitoring</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button 
            disabled={busy} 
            onClick={() => callApi(`/v1/ops/webhooks/dlq`)}
            style={{ background: "#9c27b0", color: "white", padding: "6px 12px" }}
          >
            Webhook DLQ 조회
          </Button>
          <Button 
            disabled={busy} 
            onClick={() => callApi(`/v1/ops/errors`)}
            style={{ background: "#e91e63", color: "white", padding: "6px 12px" }}
          >
            API Errors 조회
          </Button>
          <Button 
            disabled={busy} 
            onClick={() => callApi(`/v1/ops/ocr/stats`)}
            style={{ background: "#673ab7", color: "white", padding: "6px 12px" }}
          >
            OCR Failure Rate 조회
          </Button>
        </div>
      </section>

      <pre style={{ marginTop: 16, padding: 16, background: "#0f172a", color: "#e2e8f0", borderRadius: 12, overflowX: "auto" }}>{log}</pre>
    </main>
  );
}

export default OpsShell;
