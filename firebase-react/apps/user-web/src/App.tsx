import { useMemo, useState } from "react";
import { auth } from "@rp/firebase";
import { signInAnonymously } from "firebase/auth";
import { storage } from "@rp/firebase";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import "./App.css";

function App() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");
  const [caseId, setCaseId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [cards, setCards] = useState<any[]>([]);
  const [intentText, setIntentText] = useState<string>("임원 변경 등기 하고 싶어요");
  const [resultPartners, setResultPartners] = useState<any[]>([]);
  const [quoteId, setQuoteId] = useState<string>("");
  const [paymentId, setPaymentId] = useState<string>("");
  const [refundAmount, setRefundAmount] = useState<number>(20000);
  const [refundApprovalId, setRefundApprovalId] = useState<string>("");
  const [docDocumentId, setDocDocumentId] = useState<string>("");
  const [docVersionId, setDocVersionId] = useState<string>("");
  const [docStoragePath, setDocStoragePath] = useState<string>("");
  const [fixGuide, setFixGuide] = useState<any | null>(null);
  const [caseStatus, setCaseStatus] = useState<string>("");
  const [timeline, setTimeline] = useState<any[]>([]);
  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE || "", []);

  async function ensureLogin() {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    const token = await auth.currentUser!.getIdToken();
    return token;
  }

  async function apiPost(path: string, body: any) {
    if (!apiBase) {
      setLog("VITE_API_BASE가 필요합니다. .env에 설정하세요.");
      throw new Error("VITE_API_BASE missing");
    }
    const token = await ensureLogin();
    const resp = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": crypto.randomUUID()
      },
      body: JSON.stringify(body)
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error?.messageKo || "요청 실패");
    return json.data;
  }

  async function apiGet(path: string) {
    if (!apiBase) {
      setLog("VITE_API_BASE가 필요합니다. .env에 설정하세요.");
      throw new Error("VITE_API_BASE missing");
    }
    const token = await ensureLogin();
    const resp = await fetch(`${apiBase}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error?.messageKo || "요청 실패");
    return json.data;
  }

  async function downloadBinary(path: string, fileName: string) {
    if (!apiBase) throw new Error("VITE_API_BASE missing");
    const token = await ensureLogin();
    const resp = await fetch(`${apiBase}${path}`, { method: "GET", headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      const json = await resp.json().catch(() => null);
      throw new Error(json?.error?.messageKo || "다운로드 실패");
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function loadCaseStatusAndTimeline() {
    setBusy(true);
    try {
      if (!caseId) throw new Error("caseId가 필요합니다.");
      const c = await apiGet(`/v1/cases/${caseId}`);
      const t = await apiGet(`/v1/cases/${caseId}/timeline?limit=50`);
      setCaseStatus(String(c.case?.status ?? ""));
      setTimeline(t.items || []);
      setLog("case status + timeline loaded");
    } catch (e: any) {
      setLog(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function startIntent() {
    setBusy(true);
    try {
      const data = await apiPost("/v1/intent", { sessionId: null, intentText, locale: "ko" });
      setSessionId(data.sessionId);
      setCards(data.cards || []);
      setResultPartners([]);
      setLog(`intent started: ${data.sessionId}`);
    } catch (e: any) {
      setLog(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function answer(questionId: string, value: any) {
    setBusy(true);
    try {
      const data = await apiPost("/v1/diagnosis/answer", {
        sessionId,
        answer: { questionId, value }
      });
      setCards(data.cards || []);
      setLog(`answered: ${questionId}`);
    } catch (e: any) {
      setLog(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function loadResults() {
    setBusy(true);
    try {
      const data = await apiGet(`/v1/results?sessionId=${encodeURIComponent(sessionId)}`);
      setResultPartners(data.partners || []);
      setLog(`results loaded: ${data.resultSetId}`);
    } catch (e: any) {
      setLog(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function createCaseFromResult(selectedPartnerId: string) {
    setBusy(true);
    try {
      const data = await apiPost("/v1/cases", {
        sessionId,
        selectedPartnerId,
        casePackId: "corp_officer_change_v1"
      });
      setCaseId(data.caseId);
      setLog(`case created: ${data.caseId}`);
    } catch (e: any) {
      setLog(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const firstCard = cards?.[0];

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>User App (MVP)</h1>
      <p style={{ color: "#666" }}>
        익명 로그인 → 퍼널(intent/diagnosis/results) → 케이스 생성까지 연결한 MVP입니다.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button disabled={busy} onClick={() => signInAnonymously(auth).then(() => setLog("signed in (anonymous)"))}>
          익명 로그인
        </button>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>1) Intent</h2>
        <input
          value={intentText}
          onChange={(e) => setIntentText(e.target.value)}
          style={{ width: "100%", padding: 8 }}
          placeholder="의도 입력"
        />
        <div style={{ marginTop: 8 }}>
          <button disabled={busy} onClick={startIntent}>퍼널 시작</button>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>2) Diagnosis</h2>
        {sessionId ? <div><strong>sessionId</strong>: {sessionId}</div> : <div>먼저 퍼널을 시작하세요.</div>}
        {firstCard?.type === "question" && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 600 }}>{firstCard.titleKo}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {firstCard.options?.map((opt: string) => (
                <button
                  key={opt}
                  disabled={busy}
                  onClick={() =>
                    answer(
                      firstCard.questionId,
                      firstCard.questionId === "q_company_type" ? { companyType: opt } : { officerType: opt }
                    )
                  }
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <button disabled={busy || !sessionId} onClick={loadResults}>결과 보기</button>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>3) Results</h2>
        {resultPartners.length === 0 ? (
          <div style={{ color: "#666" }}>결과를 로드하면 추천 파트너가 표시됩니다.</div>
        ) : (
          <ul>
            {resultPartners.map((p) => (
              <li key={p.partnerId} style={{ marginBottom: 8 }}>
                <div><strong>{p.profile?.nameKo ?? p.partnerId}</strong> ({p.profile?.regionKo})</div>
                <button disabled={busy} onClick={() => createCaseFromResult(p.partnerId)}>이 파트너로 케이스 생성</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>4) Quote / Payment / Refund</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            quoteId{" "}
            <input value={quoteId} onChange={(e) => setQuoteId(e.target.value)} style={{ width: 320, padding: 6 }} />
          </label>
          <button
            disabled={busy || !caseId || !quoteId}
            onClick={async () => {
              setBusy(true);
              try {
                const data = await apiPost(`/v1/cases/${caseId}/quotes/${quoteId}/accept`, {});
                setLog(`quote accepted: ${data.quoteId}`);
              } catch (e: any) {
                setLog(String(e?.message || e));
              } finally {
                setBusy(false);
              }
            }}
          >
            견적 수락
          </button>
          <button
            disabled={busy || !caseId || !quoteId}
            onClick={async () => {
              setBusy(true);
              try {
                const data = await apiPost(`/v1/cases/${caseId}/payments/create`, {
                  quoteId,
                  method: "card",
                  clientReturnUrl: "http://localhost:5173/return"
                });
                setPaymentId(data.paymentId);
                setLog(`payment created: ${data.paymentId} redirect=${data.redirectUrl}`);
              } catch (e: any) {
                setLog(String(e?.message || e));
              } finally {
                setBusy(false);
              }
            }}
          >
            결제 생성
          </button>
        </div>

        <div style={{ marginTop: 8 }}><strong>paymentId</strong>: {paymentId || "-"}</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
          <label>
            refundAmount{" "}
            <input type="number" value={refundAmount} onChange={(e) => setRefundAmount(Number(e.target.value))} />
          </label>
          <button
            disabled={busy || !caseId || !paymentId}
            onClick={async () => {
              setBusy(true);
              try {
                const token = await ensureLogin();
                const resp = await fetch(`${apiBase}/v1/cases/${caseId}/refunds/request`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    "Idempotency-Key": crypto.randomUUID()
                  },
                  body: JSON.stringify({
                    paymentId,
                    amount: { amount: refundAmount, currency: "KRW" },
                    reasonKo: "유저 테스트 환불"
                  })
                });
                const json = await resp.json();
                if (resp.status === 412) {
                  setRefundApprovalId(json.error?.details?.approvalId || "");
                  setLog(`refund approval required: approvalId=${json.error?.details?.approvalId} refundId=${json.error?.details?.refundId}`);
                  return;
                }
                if (!json.ok) throw new Error(json.error?.messageKo || "요청 실패");
                setLog("refund requested");
              } catch (e: any) {
                setLog(String(e?.message || e));
              } finally {
                setBusy(false);
              }
            }}
          >
            환불 요청(승인 생성)
          </button>
        </div>
        <div style={{ marginTop: 8 }}><strong>refundApprovalId</strong>: {refundApprovalId || "-"}</div>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>5) Documents (업로드/확정)</h2>
        <p style={{ color: "#666", marginTop: 0 }}>
          upload-intent 발급 → Firebase Storage 업로드 → complete로 서버 확정(타임라인 기록)
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            disabled={busy || !caseId}
            onClick={async () => {
              setBusy(true);
              try {
                const data = await apiPost(`/v1/cases/${caseId}/documents/upload-intent`, {
                  slotId: "slot_id_card",
                  fileName: "demo.txt",
                  mimeType: "text/plain",
                  sizeBytes: 11
                });
                setDocDocumentId(data.documentId);
                setDocVersionId(data.versionId);
                setDocStoragePath(data.storagePath);
                setLog(`upload-intent ok: ${data.documentId}/${data.versionId}`);
              } catch (e: any) {
                setLog(String(e?.message || e));
              } finally {
                setBusy(false);
              }
            }}
          >
            업로드 인텐트 발급
          </button>
          <button
            disabled={busy || !docStoragePath}
            onClick={async () => {
              setBusy(true);
              try {
                const bytes = new TextEncoder().encode("hello world");
                await uploadBytes(storageRef(storage, docStoragePath), bytes, { contentType: "text/plain" });
                setLog(`uploaded to storage: ${docStoragePath}`);
              } catch (e: any) {
                setLog(String(e?.message || e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Storage 업로드(데모)
          </button>
          <button
            disabled={busy || !docDocumentId || !docVersionId}
            onClick={async () => {
              setBusy(true);
              try {
                const data = await apiPost(
                  `/v1/cases/${caseId}/documents/${docDocumentId}/versions/${docVersionId}/complete`,
                  { sha256: "demo_sha256", sizeBytes: 11 }
                );
                setLog(`document complete: ${data.status} (caseStatus=${data.caseStatus ?? "-"})`);
              } catch (e: any) {
                setLog(String(e?.message || e));
              } finally {
                setBusy(false);
              }
            }}
          >
            서버 확정(complete)
          </button>
          <button
            disabled={busy || !caseId || !docDocumentId}
            onClick={async () => {
              setBusy(true);
              try {
                // 보완 제출: 새 버전 생성 → 업로드 → complete
                const fix = await apiPost(`/v1/cases/${caseId}/documents/${docDocumentId}/submit-fix`, {
                  fileName: "demo_fix.txt",
                  mimeType: "text/plain",
                  sizeBytes: 12
                });
                setDocVersionId(fix.versionId);
                setDocStoragePath(fix.storagePath);
                setLog(`fix version created: ${fix.versionId}`);

                const bytes = new TextEncoder().encode("hello world!");
                await uploadBytes(storageRef(storage, fix.storagePath), bytes, { contentType: "text/plain" });
                await apiPost(
                  `/v1/cases/${caseId}/documents/${docDocumentId}/versions/${fix.versionId}/complete`,
                  { sha256: "demo_fix_sha256", sizeBytes: 12 }
                );
                setLog("fix uploaded + completed (caseStatus=waiting_partner 기대)");
              } catch (e: any) {
                setLog(String(e?.message || e));
              } finally {
                setBusy(false);
              }
            }}
          >
            보완 제출(원클릭)
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <div><strong>documentId</strong>: {docDocumentId || "-"}</div>
          <div><strong>versionId</strong>: {docVersionId || "-"}</div>
          <div><strong>storagePath</strong>: {docStoragePath || "-"}</div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>6) 보완 가이드</h2>
        <button
          disabled={busy || !caseId}
          onClick={async () => {
            setBusy(true);
            try {
              const data = await apiGet(`/v1/cases/${caseId}/fix-guide`);
              setFixGuide(data);
              setLog("fix guide loaded");
            } catch (e: any) {
              setLog(String(e?.message || e));
            } finally {
              setBusy(false);
            }
          }}
        >
          보완 가이드 로드
        </button>
        {fixGuide?.items?.length > 0 && (
          <ul style={{ marginTop: 8 }}>
            {fixGuide.items.map((it: any) => (
              <li key={it.slotId}>
                <strong>{it.titleKo}</strong> ({it.status})<br />
                <pre style={{ whiteSpace: "pre-wrap", margin: "4px 0", color: "#444" }}>{it.guidanceKo}</pre>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>7) 다운로드(리포트/패키지/서류)</h2>
        <div style={{ marginBottom: 8 }}>
          <button disabled={busy || !caseId} onClick={loadCaseStatusAndTimeline}>케이스 상태/타임라인 로드</button>
          <span style={{ marginLeft: 8, color: "#666" }}>status: {caseStatus || "-"}</span>
        </div>
        {timeline.some((e) => e.type === "PACKAGE_READY") && (
          <div style={{ marginBottom: 10, padding: 10, border: "1px solid #b7eb8f", background: "#f6ffed", borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>완료됨: 제출 패키지/리포트 다운로드</div>
            <button
              disabled={busy || !caseId}
              onClick={async () => {
                setBusy(true);
                try {
                  await downloadBinary(`/v1/cases/${caseId}/packages/submission.zip`, `submission_package_${caseId}.zip`);
                  setLog("submission package downloaded");
                } catch (e: any) {
                  setLog(String(e?.message || e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              제출 패키지(ZIP)
            </button>
            <button
              disabled={busy || !caseId}
              style={{ marginLeft: 8 }}
              onClick={async () => {
                setBusy(true);
                try {
                  await downloadBinary(`/v1/cases/${caseId}/reports/closing.docx`, `closing_report_${caseId}.docx`);
                  setLog("closing report downloaded");
                } catch (e: any) {
                  setLog(String(e?.message || e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              종료 리포트(DOCX)
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            disabled={busy || !caseId}
            onClick={async () => {
              setBusy(true);
              try {
                await downloadBinary(`/v1/cases/${caseId}/reports/closing.docx`, `closing_report_${caseId}.docx`);
                setLog("closing report downloaded");
              } catch (e: any) {
                setLog(String(e?.message || e));
              } finally {
                setBusy(false);
              }
            }}
          >
            종료 리포트(DOCX)
          </button>
          <button
            disabled={busy || !caseId}
            onClick={async () => {
              setBusy(true);
              try {
                await downloadBinary(`/v1/cases/${caseId}/packages/submission.zip`, `submission_package_${caseId}.zip`);
                setLog("submission package downloaded");
              } catch (e: any) {
                setLog(String(e?.message || e));
              } finally {
                setBusy(false);
              }
            }}
          >
            제출 패키지(ZIP)
          </button>
          <button
            disabled={busy || !caseId}
            onClick={async () => {
              setBusy(true);
              try {
                await downloadBinary(`/v1/cases/${caseId}/templates/minutes/export.docx`, `minutes_${caseId}.docx`);
                setLog("minutes docx downloaded");
              } catch (e: any) {
                setLog(String(e?.message || e));
              } finally {
                setBusy(false);
              }
            }}
          >
            의사록(DOCX)
          </button>
          <button
            disabled={busy || !caseId}
            onClick={async () => {
              setBusy(true);
              try {
                await downloadBinary(`/v1/cases/${caseId}/templates/poa/export.docx`, `poa_${caseId}.docx`);
                setLog("poa docx downloaded");
              } catch (e: any) {
                setLog(String(e?.message || e));
              } finally {
                setBusy(false);
              }
            }}
          >
            위임장(DOCX)
          </button>
        </div>
        <div style={{ marginTop: 8, color: "#666" }}>템플릿은 partner-console에서 먼저 생성되어 있어야 다운로드됩니다.</div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div><strong>API Base</strong>: {apiBase || "(not set)"}</div>
        <div><strong>caseId</strong>: {caseId || "-"}</div>
      </div>

      <pre style={{ marginTop: 16, background: "#111", color: "#eee", padding: 12, borderRadius: 8, overflowX: "auto" }}>
        {log || "ready"}
      </pre>
    </div>
  );
}

export default App;
