import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
import { auth } from "@rp/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getApiBaseUrl } from "./apiBase";
import "./App.css";
import AuthScreen from "./components/AuthScreen";

function OpsShell() {
  const apiBase = useMemo(() => getApiBaseUrl(), []);
  const tokenRef = useRef("");
  const [token, setToken] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setAuthReady(true);
      if (!u) {
        tokenRef.current = "";
        setToken("");
        setAccessDenied(false);
        return;
      }
      const nextToken = await u.getIdToken(true);
      tokenRef.current = nextToken;
      setToken(nextToken);
      const tokenResult = await u.getIdTokenResult();
      const opsRole = tokenResult.claims?.opsRole ? String(tokenResult.claims.opsRole) : "";
      setAccessDenied(!["ops_admin", "ops_operator", "ops_viewer"].includes(opsRole));
    });
    return () => unsubscribe();
  }, []);

  async function logout() {
    await signOut(auth);
  }

  async function callApi(path: string, init: RequestInit = {}) {
    setBusy(true);
    try {
      const idToken = tokenRef.current || token;
      if (!idToken) throw new Error("인증이 필요합니다.");
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
    <div className="im-shell selection:bg-[var(--brand)]/10 selection:text-[var(--brand)]">
      <div className="im-container">
        <header className="im-header">
          <h1 className="im-title">Ops Console</h1>
          {authReady && auth.currentUser && (
            <div className="im-lang">
              <button type="button" className="im-link" onClick={logout}>
                로그아웃
              </button>
            </div>
          )}
        </header>

        {!authReady && <div className="im-log">loading…</div>}

        {authReady && !auth.currentUser && <AuthScreen />}

        {authReady && auth.currentUser && accessDenied && (
          <div className="im-log" style={{ background: "var(--error-light)", color: "var(--error)" }}>
            권한이 없습니다. opsRole 커스텀 클레임이 필요합니다.
          </div>
        )}

        {authReady && auth.currentUser && !accessDenied && (
          <>
            <p className="im-lede">
              파일럿 운영 체크리스트의 핵심 루프인 인증, 일일 Gate 요약, 케이스 상세 조회, 패키지 재생성/재검증을 바로 실행할 수 있는 운영 쉘입니다.
            </p>

            <section className="im-panel">
              <h2 className="im-panel-title">Gate</h2>
              <Input label="Gate Key" value={gateKey} onChange={(event) => setGateKey(event.target.value)} />
              <Input type="date" label="Summary Date" value={summaryDate} onChange={(event) => setSummaryDate(event.target.value)} />
              <Input label="Case ID" value={caseId} onChange={(event) => setCaseId(event.target.value)} placeholder="case id for troubleshooting" />
            </section>

            <section className="im-actions">
              <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/reports/${gateKey}/daily?date=${summaryDate}`)}>
                일일 Gate 요약
              </Button>
              <Button disabled={busy || !caseId} variant="secondary" onClick={() => callApi(`/v1/ops/cases/${caseId}/detail`)}>
                케이스 상세
              </Button>
              <Button
                disabled={busy || !caseId}
                variant="secondary"
                onClick={() => callApi(`/v1/ops/cases/${caseId}/packages/regenerate`, { method: "POST", body: "{}" })}
              >
                패키지 재생성
              </Button>
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() => callApi(`/v1/ops/settlements/batch`, { method: "POST", body: JSON.stringify({ periodEnd: new Date().toISOString() }) })}
              >
                정산 배치 실행
              </Button>
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() => callApi(`/v1/ops/ads/batch`, { method: "POST", body: JSON.stringify({ targetDate: summaryDate }) })}
              >
                광고 과금 배치 실행
              </Button>
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() => callApi(`/v1/ops/subscriptions/batch`, { method: "POST", body: JSON.stringify({ targetDate: summaryDate }) })}
              >
                구독 결제 배치 실행
              </Button>
              <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/risk/summary?gateKey=${gateKey}`)}>
                리스크 지표 확인
              </Button>
              <Button
                disabled={busy}
                variant="danger"
                onClick={() => callApi(`/v1/ops/risk/${gateKey}/mitigate`, { method: "POST", body: JSON.stringify({ actionKey: "circuit_breaker_reset" }) })}
              >
                리스크 완화 실행
              </Button>
            </section>

        <section className="im-panel">
          <h2 className="im-panel-title">Case Pack</h2>
          <Input label="Case Pack ID" value={casePackId} onChange={(event) => setCasePackId(event.target.value)} placeholder="ex: real_estate_transfer_v1" />
          <Input label="사건명" value={casePackName} onChange={(event) => setCasePackName(event.target.value)} placeholder="ex: 부동산 소유권 이전" />
          <div>
            <label className="block text-[0.75rem] font-medium tracking-[0.12em] uppercase text-[var(--text-tertiary)] mb-2">
              입력 폼 스키마
            </label>
            <textarea
              value={casePackSchema}
              onChange={(event) => setCasePackSchema(event.target.value)}
              className="block w-full px-3 py-2.5 border rounded-[2px] text-sm bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] h-28 font-mono"
            />
          </div>
          <div className="im-actions">
            <Button
              disabled={busy || !casePackId || !casePackName}
              onClick={() => {
                let parsedSchema = { type: "object", properties: {} };
                try {
                  parsedSchema = JSON.parse(casePackSchema);
                } catch (e) {}
                callApi(`/v1/ops/case-packs`, {
                  method: "POST",
                  body: JSON.stringify({
                    id: casePackId,
                    nameKo: casePackName,
                    active: true,
                    formSchema: parsedSchema,
                    workflow: { stages: ["draft_filing", "review", "completed"], requiredSlots: ["id_card"] },
                  }),
                });
              }}
            >
              생성
            </Button>
            <Button
              disabled={busy || !casePackId}
              variant="secondary"
              onClick={() => {
                let parsedSchema = { type: "object", properties: {} };
                try {
                  parsedSchema = JSON.parse(casePackSchema);
                } catch (e) {}
                callApi(`/v1/ops/case-packs/${casePackId}`, {
                  method: "PUT",
                  body: JSON.stringify({
                    nameKo: casePackName || undefined,
                    formSchema: parsedSchema,
                  }),
                });
              }}
            >
              수정
            </Button>
          </div>
        </section>

        <section className="im-panel">
          <h2 className="im-panel-title">Refund</h2>
          <Input label="Case ID" value={refundCaseId} onChange={(event) => setRefundCaseId(event.target.value)} placeholder="ex: case_xxx" />
          <Input label="Refund ID" value={refundId} onChange={(event) => setRefundId(event.target.value)} placeholder="ex: refund_xxx" />
          <div className="im-actions">
            <Button
              disabled={busy || !refundCaseId || !refundId}
              variant="danger"
              onClick={() => {
                callApi(`/v1/ops/cases/${refundCaseId}/refunds/${refundId}/execute`, {
                  method: "POST",
                  body: JSON.stringify({}),
                });
              }}
            >
              환불 실행
            </Button>
          </div>
        </section>

        <section className="im-panel">
          <h2 className="im-panel-title">Access</h2>
          <div className="im-actions">
            <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/access/users`)}>
              권한 현황 조회
            </Button>
            <Button
              disabled={busy || !accessReason}
              variant="danger"
              onClick={() => callApi(`/v1/ops/access/breakglass`, { method: "POST", body: JSON.stringify({ reason: accessReason }) })}
            >
              Break-glass (30분)
            </Button>
          </div>

          <Input label="대상 UID" value={accessTargetUid} onChange={(event) => setAccessTargetUid(event.target.value)} placeholder="ex: uid_xxxx" />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <label className="block text-[0.75rem] font-medium tracking-[0.12em] uppercase text-[var(--text-tertiary)] mb-2">
                권한
              </label>
              <select
                value={accessRole}
                onChange={(event) => setAccessRole(event.target.value)}
                className="block w-full px-3 py-2.5 border rounded-[2px] text-sm bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
              >
                <option value="ops_viewer">ops_viewer</option>
                <option value="ops_operator">ops_operator</option>
                <option value="ops_admin">ops_admin</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <Input
                label="사유"
                value={accessReason}
                onChange={(event) => setAccessReason(event.target.value)}
                placeholder="권한 부여/회수 또는 긴급권한 사유 입력"
              />
            </div>
          </div>

          <div className="im-actions">
            <Button
              disabled={busy || !accessTargetUid || !accessRole || !accessReason}
              onClick={() =>
                callApi(`/v1/ops/access/grant`, { method: "POST", body: JSON.stringify({ targetUid: accessTargetUid, role: accessRole, reason: accessReason }) })
              }
            >
              권한 부여
            </Button>
            <Button
              disabled={busy || !accessTargetUid || !accessReason}
              variant="secondary"
              onClick={() => callApi(`/v1/ops/access/revoke`, { method: "POST", body: JSON.stringify({ targetUid: accessTargetUid, reason: accessReason }) })}
            >
              권한 회수
            </Button>
          </div>
        </section>

        <section className="im-panel">
          <h2 className="im-panel-title">Observability</h2>
          <div className="im-actions">
            <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/webhooks/dlq`)}>
              Webhook DLQ
            </Button>
            <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/errors`)}>
              API Errors
            </Button>
            <Button disabled={busy} variant="secondary" onClick={() => callApi(`/v1/ops/ocr/stats`)}>
              OCR Failure Rate
            </Button>
          </div>
        </section>

            <pre className="im-log">{log}</pre>
          </>
        )}
      </div>
    </div>
  );
}

export default OpsShell;
