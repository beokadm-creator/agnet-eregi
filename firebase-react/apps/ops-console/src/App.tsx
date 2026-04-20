import { useMemo, useState } from "react";
import { auth } from "@rp/firebase";
import { signInAnonymously } from "firebase/auth";
import "./App.css";

function App() {
  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE || "", []);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");
  const [errorBox, setErrorBox] = useState<{message: string, reqId?: string} | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [gate, setGate] = useState<string>("refund_approve");
  const [status, setStatus] = useState<string>("pending");
  const [caseId, setCaseId] = useState<string>("");
  const [caseDetail, setCaseDetail] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [gateEvidences, setGateEvidences] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [settlementPartnerId, setSettlementPartnerId] = useState<string>("p_demo_01");
  const [periodFrom, setPeriodFrom] = useState<string>("2026-01-01");
  const [periodTo, setPeriodTo] = useState<string>("2026-01-31");
  const [settlementIdForItems, setSettlementIdForItems] = useState<string>("");
  const [settlementItems, setSettlementItems] = useState<any[]>([]);
  const [gateKey, setGateKey] = useState<string>("pilot-gate");
  const [summaryDate, setSummaryDate] = useState<string>(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()));
  const [gateReportText, setGateReportText] = useState<string>("");
  const [ssotData, setSsotData] = useState<any | null>(null);
  const [backlogItems, setBacklogItems] = useState<any[]>([]);
  const [issueCreationResult, setIssueCreationResult] = useState<any | null>(null);
  const [projectAddResult, setProjectAddResult] = useState<any | null>(null);
  const [projectConfigResult, setProjectConfigResult] = useState<any | null>(null);
  const [aliasJsonText, setAliasJsonText] = useState<string>("");
  const [githubOwner, setGithubOwner] = useState<string>("beokadm-creator");
  const [githubRepo, setGithubRepo] = useState<string>("agnet-eregi");
  const [githubProjectId, setGithubProjectId] = useState<string>("");
  const [githubTokenRef, setGithubTokenRef] = useState<string>("GITHUB_TOKEN_BACKLOG_BOT");
  const [githubTokenRefActions, setGithubTokenRefActions] = useState<string>("");
  const [recentFails, setRecentFails] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [auditNextCursor, setAuditNextCursor] = useState<string | null>(null);
  const [auditFilterGateKey, setAuditFilterGateKey] = useState<string>("");
  const [auditFilterAction, setAuditFilterAction] = useState<string>("");
  const [auditFilterStatus, setAuditFilterStatus] = useState<string>("");
  const [auditFilterActorUid, setAuditFilterActorUid] = useState<string>("");
  const [auditFilterFrom, setAuditFilterFrom] = useState<string>("");
  const [auditFilterTo, setAuditFilterTo] = useState<string>("");
  const [auditSelectedEvent, setAuditSelectedEvent] = useState<any | null>(null);

  const [retryJobs, setRetryJobs] = useState<any[]>([]);
  const [cbState, setCbState] = useState<any | null>(null);
  const [testAlertMsg, setTestAlertMsg] = useState<string>("");
  const [sev1Log, setSev1Log] = useState<{regenerateOk?: boolean; validateData?: any; reqId?: string}>({});

  async function ensureLogin() {
    if (!auth.currentUser) await signInAnonymously(auth);
    return await auth.currentUser!.getIdToken(true);
  }

  function handleError(e: any, defaultReqId?: string) {
    const msg = String(e?.message || e);
    const reqId = e?.reqId || defaultReqId;
    setErrorBox({ message: msg, reqId });
    setLog(`Error: ${msg}`);
  }

  function clearError() {
    setErrorBox(null);
  }

  async function apiPatch(path: string, body: any) {
    const res = await fetch(API_BASE + path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error?.message || "PATCH Failed");
    return data.data;
  }

  async function apiGet(path: string) {
    clearError();
    const token = await ensureLogin();
    const resp = await fetch(`${apiBase}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const reqId = resp.headers.get("X-Request-Id") || "unknown";
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.ok) {
      const err = new Error(json.error?.messageKo || "요청 실패") as any;
      err.reqId = json.error?.requestId || reqId;
      throw err;
    }
    return json.data;
  }

  async function apiPost(path: string, body: any) {
    clearError();
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
    const reqId = resp.headers.get("X-Request-Id") || "unknown";
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.ok) {
      const err = new Error(json.error?.messageKo || "요청 실패") as any;
      err.reqId = json.error?.requestId || reqId;
      throw err;
    }
    return json.data;
  }

  async function loadSummary() {
    setBusy(true);
    setGateReportText("");
    setSsotData(null);
    setBacklogItems([]);
    setIssueCreationResult(null);
    setProjectAddResult(null);
    setProjectConfigResult(null);
    setRecentFails([]);
    setAuditEvents([]);
    setRetryJobs([]);
    try {
      const gateData = await apiGet(`/v1/ops/reports/${gateKey}/daily?date=${summaryDate}`);
      setGateReportText(gateData.copyText || "");
      
      const backlogData = await apiPost(`/v1/ops/reports/${gateKey}/backlog`, { date: summaryDate, topN: 3 });
      setBacklogItems(backlogData.items || []);
      
      // 최근 실패 케이스 같이 로드 (7일)
      const recentData = await apiGet(`/v1/ops/reports/${gateKey}/recent?days=7&onlyFail=1&limit=50`);
      setRecentFails(recentData.evidences || []);
      
      // 자동화 로그(감사 이벤트) 및 재시도 큐 로드
      await loadAuditEvents();
      await loadRetryJobs();
      await loadCircuitBreakerState();
      
      setLog(`오늘 운영 요약 로드 성공: 집계 완료, 백로그 후보 ${backlogData.items?.length ?? 0}건, 최근 실패 ${recentData.evidences?.length ?? 0}건`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function loadAuditEvents(resetCursor = true) {
    try {
      let url = `/v1/ops/audit-events?limit=50`;
      if (auditFilterGateKey) url += `&gateKey=${encodeURIComponent(auditFilterGateKey)}`;
      if (auditFilterAction) url += `&action=${encodeURIComponent(auditFilterAction)}`;
      if (auditFilterStatus) url += `&status=${encodeURIComponent(auditFilterStatus)}`;
      if (auditFilterActorUid) url += `&actorUid=${encodeURIComponent(auditFilterActorUid)}`;
      if (auditFilterFrom) url += `&from=${encodeURIComponent(auditFilterFrom)}`;
      if (auditFilterTo) url += `&to=${encodeURIComponent(auditFilterTo)}`;
      
      let finalUrl = url;
      if (!resetCursor && auditNextCursor) {
        finalUrl += `&cursor=${encodeURIComponent(auditNextCursor)}`;
      }

      const data = await apiGet(finalUrl);
      if (resetCursor) {
        setAuditEvents(data.items || []);
      } else {
        setAuditEvents(prev => [...prev, ...(data.items || [])]);
      }
      setAuditNextCursor(data.nextCursor || null);
    } catch (e: any) {
      console.warn("Audit events load failed:", e);
      handleError(e);
    }
  }

  async function loadRetryJobs() {
    try {
      const data = await apiGet(`/v1/ops/retry/recent?gateKey=${gateKey}&limit=50`);
      setRetryJobs(data.items || []);
    } catch (e: any) {
      console.warn("Retry jobs load failed:", e);
    }
  }

  async function loadCircuitBreakerState() {
    try {
      const data = await apiGet(`/v1/ops/reports/${gateKey}/circuit-breaker`);
      setCbState(data);
    } catch (e: any) {
      console.warn("CB state load failed:", e);
    }
  }

  async function resetCircuitBreakerState() {
    setBusy(true);
    clearError();
    try {
      const data = await apiPost(`/v1/ops/reports/${gateKey}/circuit-breaker/reset`, {});
      setCbState(data);
      setLog("Circuit Breaker 강제 초기화 완료");
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function sendTestAlert() {
    setBusy(true);
    clearError();
    try {
      await apiPost(`/v1/ops/alerts/test`, { gateKey, message: testAlertMsg || "This is a test alert." });
      setLog("테스트 알림 발송 완료");
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function retryDeadLetterIssue(jobId: string) {
    setBusy(true);
    clearError();
    try {
      const data = await apiPost(`/v1/ops/retry/${jobId}/deadletter/issue`, {});
      if (data.skipped) {
        setLog(`Dead-letter 이슈 생성 건너뜀: ${data.reason}`);
      } else {
        setLog(`Dead-letter 이슈 생성 성공: ${data.issueUrl}`);
      }
      await loadRetryJobs();
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function requestRetry(eventId: string) {
    setBusy(true);
    clearError();
    try {
      const data = await apiPost(`/v1/ops/reports/${gateKey}/audit/retry`, { eventId });
      setLog(`재시도 요청 성공 (Job ID: ${data.jobId}, 상태: ${data.status})`);
      await loadAuditEvents();
      await loadRetryJobs();
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function copyDailyLogMd() {
    setBusy(true);
    clearError();
    try {
      const token = await ensureLogin();
      const resp = await fetch(`${apiBase}/v1/ops/reports/${gateKey}/daily.md?date=${summaryDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        const reqId = resp.headers.get("X-Request-Id") || "unknown";
        const json = await resp.json().catch(() => ({}));
        const err = new Error(json?.error?.messageKo || "일일 로그를 불러올 수 없습니다.") as any;
        err.reqId = json?.error?.requestId || reqId;
        throw err;
      }
      const text = await resp.text();
      await navigator.clipboard.writeText(text);
      setLog("일일 로그(.md)가 클립보드에 복사되었습니다.");
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function downloadDailyLogMd() {
    setBusy(true);
    clearError();
    try {
      const token = await ensureLogin();
      const resp = await fetch(`${apiBase}/v1/ops/reports/${gateKey}/daily.md?date=${summaryDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        const reqId = resp.headers.get("X-Request-Id") || json?.error?.requestId || "N/A";
        const err = new Error(json?.error?.messageKo || "일일 로그를 다운로드할 수 없습니다.") as any;
        err.reqId = reqId;
        throw err;
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `daily_log_${summaryDate}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setLog("일일 로그(.md)가 다운로드되었습니다.");
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function appendDailyLogSsot() {
    setBusy(true);
    clearError();
    try {
      const respData = await apiPost(`/v1/ops/reports/${gateKey}/daily/append`, { date: summaryDate });
      setLog(`SSOT(Firestore)에 기록되었습니다 (linesAdded: ${respData.linesAdded}, reqId: ${respData.requestId})`);
      await loadDailyLogSsot(); // 저장 후 즉시 조회해서 반영
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function loadDailyLogSsot() {
    setBusy(true);
    clearError();
    try {
      const data = await apiGet(`/v1/ops/reports/${gateKey}/daily/ssot?date=${summaryDate}`);
      setSsotData(data);
      setLog("SSOT 데이터를 성공적으로 불러왔습니다.");
    } catch (e: any) {
      if (e.message?.includes("NOT_FOUND") || e.message?.includes("없습니다")) {
        setSsotData(null);
        setLog("아직 SSOT가 없습니다. 저장 버튼을 눌러 생성하세요.");
      } else {
        handleError(e);
      }
    } finally {
      setBusy(false);
    }
  }

  function copyGateReport() {
    if (!gateReportText) return;
    navigator.clipboard.writeText(gateReportText)
      .then(() => setLog("복사 완료 (운영 로그용)"))
      .catch((e) => setLog(`복사 실패: ${e}`));
  }

  async function createBacklogIssues() {
    setBusy(true);
    clearError();
    setIssueCreationResult(null);
    try {
      const data = await apiPost(`/v1/ops/reports/${gateKey}/backlog/issues/create`, { date: summaryDate });
      setIssueCreationResult(data);
      setLog(`이슈 생성 완료: created ${data.created?.length}건, skipped ${data.skipped?.length}건`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function addIssuesToProject() {
    setBusy(true);
    clearError();
    setProjectAddResult(null);
    try {
      const data = await apiPost(`/v1/ops/reports/${gateKey}/backlog/issues/project/add`, { date: summaryDate });
      setProjectAddResult(data);
      setLog(`프로젝트 투입 완료: added ${data.added?.length}건, skipped ${data.skipped?.length}건, failed ${data.failed?.length}건`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function discoverProjectConfig() {
    setBusy(true);
    clearError();
    setProjectConfigResult(null);
    try {
      const data = await apiPost(`/v1/ops/reports/${gateKey}/backlog/project/discover`, {});
      setProjectConfigResult(data);
      setAliasJsonText(JSON.stringify(data.customAliases || { fieldAliases: {}, optionAliases: {} }, null, 2));
      if (data.github) {
        setGithubOwner(data.github.owner || "beokadm-creator");
        setGithubRepo(data.github.repo || "agnet-eregi");
        setGithubProjectId(data.github.projectId || "");
        setGithubTokenRef(data.github.tokenRef || "GITHUB_TOKEN_BACKLOG_BOT");
        setGithubTokenRefActions(data.github.tokenRefActions || "");
      }
      setLog(`Project 설정 갱신 완료: Status 옵션 ${Object.keys(data.resolved?.statusOptionIds || {}).length}개 로드됨`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function updateGithubConfig() {
    setBusy(true);
    clearError();
    try {
      const data = await apiPatch(`/v1/ops/reports/${gateKey}/backlog/project/config/github`, {
        owner: githubOwner,
        repo: githubRepo,
        projectId: githubProjectId,
        tokenRef: githubTokenRef,
        tokenRefActions: githubTokenRefActions
      });
      setLog(`GitHub 설정 저장 완료 (owner: ${data.github?.owner}, repo: ${data.github?.repo})`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function updateAliasesAndResolve() {
    setBusy(true);
    clearError();
    try {
      const customAliases = JSON.parse(aliasJsonText);
      const data = await apiPatch(`/v1/ops/reports/${gateKey}/backlog/project/config/aliases`, { customAliases });
      setProjectConfigResult(data);
      setLog(`Alias 갱신 및 재매칭 완료 (missing: ${data.missingMappings?.length}개)`);
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        handleError(new Error("JSON 형식이 잘못되었습니다."));
      } else {
        handleError(e);
      }
    } finally {
      setBusy(false);
    }
  }

  async function reResolveProjectConfig() {
    setBusy(true);
    clearError();
    try {
      const data = await apiPost(`/v1/ops/reports/${gateKey}/backlog/project/resolve`, {});
      setProjectConfigResult((prev: any) => ({ ...prev, resolved: data.resolved, missingMappings: data.missingMappings }));
      setLog(`재매칭 완료 (missing: ${data.missingMappings?.length}개)`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  function copyBacklog() {
    if (!backlogItems.length) return;
    
    const lines = backlogItems.map(item => {
      const reproLines = item.reproSteps.split("\n").map((l: string) => "  " + l).join("\n");
      const acLines = item.acceptanceCriteria.split("\n").map((l: string) => "  " + l).join("\n");
      return `### ${item.title}
- **Sev**: ${item.severity}
- **영향도**: ${item.impactCount}건 발생
- **샘플 케이스**: ${item.sampleCaseIds.join(", ") || "없음"}
- **재현 단계**:
${reproLines}
- **AC (Acceptance Criteria)**:
${acLines}
- **Owner**: 
- **ETA**: `;
    });

    const markdown = lines.join("\n\n");
    navigator.clipboard.writeText(markdown)
      .then(() => setLog("백로그 복사 완료 (스프린트 백로그용)"))
      .catch((e) => setLog(`백로그 복사 실패: ${e}`));
  }

  const [downloadLink, setDownloadLink] = useState<{ url: string; expiresAt: string; objectPath: string } | null>(null);

  const [monthlyReport, setMonthlyReport] = useState<any | null>(null);
  const [monthlyPrInfo, setMonthlyPrInfo] = useState<any | null>(null);
  const [monthlyRunInfo, setMonthlyRunInfo] = useState<any | null>(null);

  async function loadMonthlyReport() {
    setBusy(true);
    clearError();
    setMonthlyReport(null);
    try {
      const month = summaryDate.substring(0, 7);
      const data = await apiGet(`/v1/ops/reports/${gateKey}/monthly?month=${month}`);
      setMonthlyReport(data);
      setLog(`월간 트렌드 요약 로드 성공 (${month})`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function generateMonthlyReport() {
    setBusy(true);
    clearError();
    try {
      const month = summaryDate.substring(0, 7);
      const data = await apiPost(`/v1/ops/reports/${gateKey}/monthly/generate`, { month });
      setMonthlyReport(data);
      setLog(`월간 트렌드 요약 생성 완료 (${month})`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function checkMonthlyPr() {
    setBusy(true);
    clearError();
    setMonthlyPrInfo(null);
    setMonthlyRunInfo(null);
    try {
      const month = summaryDate.substring(0, 7);
      const data = await apiGet(`/v1/ops/reports/${gateKey}/monthly/pr?month=${month}`);
      setMonthlyPrInfo(data);
      if (data.exists) {
        setLog(`월간 요약 PR 조회 성공: #${data.prNumber}`);
      } else {
        setLog(`월간 요약 PR이 아직 없습니다. 워크플로우 상태를 조회합니다...`);
        const runData = await apiGet(`/v1/ops/reports/${gateKey}/monthly/workflow-run?month=${month}`);
        setMonthlyRunInfo(runData);
      }
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function dispatchMonthlyWorkflow() {
    setBusy(true);
    clearError();
    try {
      const month = summaryDate.substring(0, 7);
      setLog(`월간 요약 워크플로우 실행 요청 중... (${month})`);
      const data = await apiPost(`/v1/ops/reports/${gateKey}/monthly/workflow-run/dispatch`, { month });
      setLog(`워크플로우 실행 요청 성공! 잠시 후 상태를 확인합니다...`);
      
      // 1초, 2초, 3초 폴링
      let found = false;
      for (const delay of [1000, 2000, 3000]) {
        await new Promise(r => setTimeout(r, delay));
        try {
          const runData = await apiGet(`/v1/ops/reports/${gateKey}/monthly/workflow-run?month=${month}`);
          if (runData.exists) {
            setMonthlyRunInfo(runData);
            setLog(`워크플로우가 성공적으로 시작되었습니다. (Run ID: ${runData.runId})`);
            found = true;
            break;
          }
        } catch (e) {
          // ignore polling error
        }
      }
      
      if (!found) {
        setLog(`실행 요청은 보냈습니다. 잠시 후 [월간 요약 PR 보기]를 눌러 Run 상태를 확인하세요.`);
      }
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function fetchMonthlyDownloadUrl() {
    setBusy(true);
    clearError();
    setDownloadLink(null);
    try {
      const month = summaryDate.substring(0, 7); // YYYY-MM
      const data = await apiGet(`/v1/ops/reports/${gateKey}/ops-log/monthly/download-url?month=${month}`);
      setDownloadLink(data);
      setLog(`월별 로그 다운로드 URL 생성 완료 (만료: ${new Date(data.expiresAt).toLocaleTimeString()})`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function downloadWeeklyBacklog() {
    setBusy(true);
    clearError();
    try {
      const token = await ensureLogin();
      const resp = await fetch(`${apiBase}/v1/ops/reports/${gateKey}/backlog.md`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        const reqId = resp.headers.get("X-Request-Id") || "unknown";
        const json = await resp.json().catch(() => ({}));
        const err = new Error(json?.error?.messageKo || `주간 백로그 다운로드 실패: ${resp.status}`) as any;
        err.reqId = json?.error?.requestId || reqId;
        throw err;
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const contentDisposition = resp.headers.get("Content-Disposition") || "";
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : "weekly_backlog.md";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setLog("주간 백로그 다운로드 완료");
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function becomeOpsApprover() {
    setBusy(true);
    try {
      await apiPost("/v1/dev/set-claims", { claims: { role: "ops_approver" } });
      setLog("dev: set claims role=ops_approver (token refresh 필요)");
      await ensureLogin();
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function loadApprovals() {
    setBusy(true);
    try {
      const data = await apiGet(`/v1/ops/approvals?status=${encodeURIComponent(status)}&gate=${encodeURIComponent(gate)}`);
      setItems(data.items || []);
      setLog(`loaded approvals: ${data.items?.length ?? 0}`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function decide(approvalId: string, decision: "approve" | "reject") {
    setBusy(true);
    try {
      const data = await apiPost(`/v1/ops/approvals/${approvalId}/decision`, { decision, reasonKo: "ops-console 테스트" });
      setLog(`decision ok: ${approvalId} -> ${data.status}`);
      await loadApprovals();
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function executeRefund(it: any) {
    setBusy(true);
    clearError();
    try {
      const token = await ensureLogin();
      const t = it.target;
      const resp = await fetch(`${apiBase}/v1/cases/${t.caseId}/refunds/${t.refundId}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": crypto.randomUUID()
        },
        body: JSON.stringify({ approvalId: it.id })
      });
      const reqId = resp.headers.get("X-Request-Id") || "unknown";
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) {
        const err = new Error(json?.error?.messageKo || "요청 실패") as any;
        err.reqId = json?.error?.requestId || reqId;
        throw err;
      }
      setLog(`refund executed: ${t.refundId}`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function loadCaseDetail() {
    if (!caseId) {
      handleError("caseId가 필요합니다.");
      return;
    }
    await loadCaseDetailWithId(caseId);
  }

  async function loadCaseDetailWithId(cid: string) {
    setBusy(true);
    setSev1Log({});
    try {
      const c = await apiGet(`/v1/cases/${cid}`);
      const t = await apiGet(`/v1/cases/${cid}/timeline?limit=50`);
      const d = await apiGet(`/v1/cases/${cid}/documents`);
      
      let g = { evidences: [] };
      try {
        g = await apiGet(`/v1/ops/reports/${gateKey}/by-case?caseId=${cid}&limit=10`);
      } catch (ge) {
        console.warn("gate evidence 로드 실패:", ge);
      }

      setCaseDetail(c.case);
      setTimeline(t.items || []);
      setDocuments(d.items || []);
      setGateEvidences(g.evidences || []);
      setLog("case detail loaded");
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function doSev1HotfixFull() {
    setBusy(true);
    setSev1Log({});
    clearError();
    try {
      // 1. 패키지 재생성
      setLog("Sev1 핫픽스: 패키지 재생성 시작...");
      await apiPost(`/v1/ops/cases/${caseId}/packages/regenerate`, {});
      setSev1Log(prev => ({ ...prev, regenerateOk: true }));

      // 2. Gate 재검증
      setLog("Sev1 핫픽스: 패키지 재생성 완료. Gate 재검증 시작...");
      const token = await ensureLogin();
      const resp = await fetch(`${apiBase}/v1/cases/${caseId}/packages/validate`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const reqId = resp.headers.get("X-Request-Id") || "unknown";
      const json = await resp.json().catch(() => ({}));
      
      if (!resp.ok || !json.ok) {
         setSev1Log(prev => ({ ...prev, validateData: null, reqId: json.error?.requestId || reqId }));
         const err = new Error(json.error?.messageKo || "검증 요청 실패") as any;
         err.reqId = json.error?.requestId || reqId;
         throw err;
      }
      
      setSev1Log(prev => ({ ...prev, validateData: json.data, reqId }));
      
      // 3. 복사 텍스트 생성
      const text = `[Sev1 Hotfix] caseId=${caseId}, requestId=${reqId}
regenerate=ok, validate=ok, evidenceId=${json.data?.evidenceId}
next=재검증 재시도/파트너 문의/수동 확인`;
      await navigator.clipboard.writeText(text);
      
      setLog(`Sev1 핫픽스 완료! 재검증 성공 (evidenceId: ${json.data?.evidenceId}). 클립보드에 결과가 복사되었습니다.`);
      await loadCaseDetailWithId(caseId);
    } catch (e: any) {
      handleError(e);
      
      // 실패 시에도 복사 텍스트 생성 시도 (현재 상태 기반)
      setSev1Log(prev => {
        const text = `[Sev1 Hotfix] caseId=${caseId}, requestId=${prev.reqId || e?.reqId || "N/A"}
regenerate=${prev.regenerateOk ? "ok" : "fail"}, validate=fail, evidenceId=N/A
next=재검증 재시도/파트너 문의/수동 확인`;
        navigator.clipboard.writeText(text).catch(() => {});
        return prev;
      });
    } finally {
      setBusy(false);
    }
  }

  function handleLoadCaseFromBacklog(cid: string) {
    setCaseId(cid);
    loadCaseDetailWithId(cid);
  }

  async function doRegenerate() {
    setBusy(true);
    try {
      await apiPost(`/v1/ops/cases/${caseId}/packages/regenerate`, {});
      setSev1Log(prev => ({ ...prev, regenerateOk: true }));
      setLog("패키지 재생성 성공");
    } catch (e: any) {
      setSev1Log(prev => ({ ...prev, regenerateOk: false }));
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function doValidate() {
    setBusy(true);
    clearError();
    try {
      const token = await ensureLogin();
      const resp = await fetch(`${apiBase}/v1/cases/${caseId}/packages/validate`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const reqId = resp.headers.get("X-Request-Id") || "unknown";
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) {
         setSev1Log(prev => ({ ...prev, validateData: null, reqId: json.error?.requestId || reqId }));
         const err = new Error(json.error?.messageKo || "요청 실패") as any;
         err.reqId = json.error?.requestId || reqId;
         throw err;
      }
      setSev1Log(prev => ({ ...prev, validateData: json.data, reqId }));
      setLog(`재검증 성공 (evidenceId: ${json.data?.evidenceId})`);
      await loadCaseDetailWithId(caseId);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  function copySev1Log() {
    const text = `[Sev1 Hotfix] caseId=${caseId}, requestId=${sev1Log.reqId || "N/A"}
regenerate=${sev1Log.regenerateOk ? "ok" : "fail"}, validate=${sev1Log.validateData ? "ok" : "fail"}, evidenceId=${sev1Log.validateData?.evidenceId || "N/A"}
next=재검증 재시도/파트너 문의/수동 확인`;
    navigator.clipboard.writeText(text).then(() => setLog("운영 로그용 3줄 복사 완료")).catch(e => setLog("복사 실패: " + e));
  }

  async function loadSettlements() {
    setBusy(true);
    try {
      const data = await apiGet("/v1/ops/settlements");
      setSettlements(data.items || []);
      setLog(`loaded settlements: ${data.items?.length ?? 0}`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function generateSettlement() {
    setBusy(true);
    try {
      const data = await apiPost("/v1/ops/settlements/generate", {
        partnerId: settlementPartnerId,
        periodFrom,
        periodTo
      });
      setLog(`settlement generated: ${data.settlementId}`);
      await loadSettlements();
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function paySettlement(settlementId: string) {
    setBusy(true);
    try {
      const data = await apiPost(`/v1/ops/settlements/${settlementId}/pay`, {});
      setLog(`settlement paid: ${data.settlementId}`);
      await loadSettlements();
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function loadSettlementItems() {
    setBusy(true);
    try {
      if (!settlementIdForItems) {
        handleError("settlementId가 필요합니다.");
        return;
      }
      const data = await apiGet(`/v1/ops/settlements/${settlementIdForItems}/items`);
      setSettlementItems(data.items || []);
      setLog(`loaded settlement items: ${data.items?.length ?? 0}`);
    } catch (e: any) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Ops Console (MVP UI)</h1>
      <p style={{ color: "#666" }}>승인 큐 조회/결정까지 연결한 최소 운영 화면입니다.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button disabled={busy} onClick={() => signInAnonymously(auth).then(() => setLog("signed in (anonymous)"))}>
          익명 로그인
        </button>
        <button disabled={busy} onClick={becomeOpsApprover}>
          dev: ops_approver 전환
        </button>
        <select value={gate} onChange={(e) => setGate(e.target.value)} disabled={busy}>
          <option value="refund_approve">refund_approve</option>
          <option value="quote_finalize">quote_finalize</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={busy}>
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
        <button disabled={busy} onClick={loadApprovals}>
          승인 큐 로드
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <div><strong>API Base</strong>: {apiBase || "(not set)"}</div>
      </div>

      {errorBox && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #f44336", borderRadius: 8, background: "#ffebee", color: "#d32f2f" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>에러 발생:</strong> {errorBox.message}
            </div>
            {errorBox.reqId && errorBox.reqId !== "unknown" && (
              <button 
                onClick={() => navigator.clipboard.writeText(errorBox.reqId || "")}
                style={{ background: "#d32f2f", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer" }}
              >
                Request ID 복사
              </button>
            )}
          </div>
          {errorBox.reqId && errorBox.reqId !== "unknown" && (
            <div style={{ marginTop: 4, fontSize: "0.85em" }}>Request ID: {errorBox.reqId}</div>
          )}
        </div>
      )}

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8, background: "#f9f9f9" }}>
        <h2 style={{ margin: "0 0 8px 0", color: "#333" }}>오늘 운영 요약</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <label>
            대상 Gate:{" "}
            <select 
              value={gateKey} 
              onChange={(e) => setGateKey(e.target.value)}
              disabled={busy}
              style={{ padding: 6, fontWeight: "bold", color: "#00695c" }}
            >
              <option value="pilot-gate">pilot-gate (Legacy)</option>
              <option value="partner-gate">partner-gate</option>
              <option value="billing-gate">billing-gate</option>
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            대상 일자:{" "}
            <input
              type="date"
              value={summaryDate}
              onChange={(e) => setSummaryDate(e.target.value)}
              disabled={busy}
              style={{ padding: 6 }}
            />
          </label>
          <button disabled={busy || !summaryDate} onClick={loadSummary}>
            오늘 요약 가져오기
          </button>
          <button disabled={busy} onClick={downloadWeeklyBacklog} style={{ background: "#9c27b0", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", marginLeft: "auto" }}>
            주간 리뷰용 다운로드 (최근 7일 .md)
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12, padding: 8, background: "#e8eaf6", borderRadius: 4 }}>
          <strong style={{ fontSize: "0.85em", color: "#33691e" }}>[월간 운영 보고]</strong>
          <button disabled={busy} onClick={loadMonthlyReport} style={{ background: "#4caf50", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer" }}>
            월간 요약 조회 ({summaryDate.substring(0, 7)})
          </button>
          <button disabled={busy} onClick={generateMonthlyReport} style={{ background: "#e65100", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
            월간 요약 생성/갱신
          </button>
          <button disabled={busy} onClick={dispatchMonthlyWorkflow} style={{ background: "#7b1fa2", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
            월간 요약 워크플로우 실행
          </button>
          <span style={{ margin: "0 8px", color: "#ccc" }}>|</span>
          <button disabled={busy} onClick={checkMonthlyPr} style={{ background: "#1976d2", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer" }}>
            월간 요약 PR 보기
          </button>
          {monthlyPrInfo && monthlyPrInfo.exists && (
            <a href={monthlyPrInfo.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.85em", color: "#1976d2", fontWeight: "bold", textDecoration: "underline" }}>
              ↗️ PR #{monthlyPrInfo.prNumber} 열기
            </a>
          )}
          {monthlyPrInfo && !monthlyPrInfo.exists && (
            <span style={{ fontSize: "0.85em", color: "#d32f2f", fontWeight: "bold" }}>
              ⚠️ PR 없음
            </span>
          )}
          {monthlyRunInfo && monthlyRunInfo.exists && (
            <a href={monthlyRunInfo.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.85em", marginLeft: 8, padding: "2px 6px", borderRadius: 4, textDecoration: "none", color: "white", background: monthlyRunInfo.status === "in_progress" ? "#fbc02d" : (monthlyRunInfo.conclusion === "success" ? "#388e3c" : "#d32f2f") }}>
              {monthlyRunInfo.status === "in_progress" ? "🔄 런타임: 진행중" : `런타임: ${monthlyRunInfo.conclusion}`}
            </a>
          )}
          {monthlyRunInfo && !monthlyRunInfo.exists && (
            <span style={{ fontSize: "0.85em", color: "#757575", marginLeft: 8 }}>
              (실행 기록 없음)
            </span>
          )}
          <span style={{ margin: "0 8px", color: "#ccc" }}>|</span>
          <button disabled={busy} onClick={fetchMonthlyDownloadUrl} style={{ background: "#558b2f", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer" }}>
            Storage 백업 다운로드
          </button>
          {downloadLink && (
            <a href={downloadLink.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.85em", color: "#d84315", fontWeight: "bold", textDecoration: "underline" }}>
              ⬇️ 링크 열기 ({summaryDate.substring(0, 7)} / {gateKey})
            </a>
          )}
        </div>

        {monthlyReport && (
          <div style={{ marginTop: 16, padding: 16, background: "#fff", border: "1px solid #90caf9", borderRadius: 6 }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#1565c0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              📊 {monthlyReport.month} 월간 트렌드 요약 ({monthlyReport.gateKey})
              <span style={{ fontSize: "0.7em", color: "#999", fontWeight: "normal" }}>
                생성일: {new Date(monthlyReport.generatedAt).toLocaleString()}
              </span>
            </h3>
            
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1, padding: 12, background: "#f1f8e9", borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: "0.85em", color: "#558b2f" }}>가동 일수</div>
                <div style={{ fontSize: "1.5em", fontWeight: "bold", color: "#33691e" }}>{monthlyReport.totals?.daysWithLogs}일</div>
              </div>
              <div style={{ flex: 1, padding: 12, background: "#e3f2fd", borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: "0.85em", color: "#1565c0" }}>총 Gate 처리</div>
                <div style={{ fontSize: "1.5em", fontWeight: "bold", color: "#0d47a1" }}>{monthlyReport.totals?.totalGate}건</div>
              </div>
              <div style={{ flex: 1, padding: 12, background: "#ffebee", borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: "0.85em", color: "#c62828" }}>성공 / 실패</div>
                <div style={{ fontSize: "1.5em", fontWeight: "bold", color: "#b71c1c" }}>{monthlyReport.totals?.ok} / {monthlyReport.totals?.fail}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em" }}>🔥 Top 누락 Slot</h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85em" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                      <th style={{ padding: 6, borderBottom: "1px solid #ddd" }}>Slot ID</th>
                      <th style={{ padding: 6, borderBottom: "1px solid #ddd" }}>Sev</th>
                      <th style={{ padding: 6, borderBottom: "1px solid #ddd", textAlign: "right" }}>Impact</th>
                      <th style={{ padding: 6, borderBottom: "1px solid #ddd", textAlign: "right" }}>등장 일수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(monthlyReport.topSlots || []).map((slot: any) => (
                      <tr key={slot.slotId}>
                        <td style={{ padding: 6, borderBottom: "1px solid #eee", fontWeight: "bold" }}>{slot.slotId}</td>
                        <td style={{ padding: 6, borderBottom: "1px solid #eee", color: slot.severity === 1 ? "#d32f2f" : "#ed6c02" }}>Sev{slot.severity}</td>
                        <td style={{ padding: 6, borderBottom: "1px solid #eee", textAlign: "right" }}>{slot.impactCount}</td>
                        <td style={{ padding: 6, borderBottom: "1px solid #eee", textAlign: "right" }}>{slot.daysAppeared}일</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em" }}>📝 마크다운 프리뷰</h4>
                <pre style={{ margin: 0, padding: 8, background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 4, whiteSpace: "pre-wrap", wordWrap: "break-word", fontSize: "0.8em" }}>
                  {monthlyReport.markdownSummary}
                </pre>
              </div>
            </div>
          </div>
        )}
        
        <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          {/* 운영 제어 영역 */}
          <div style={{ flex: "1 1 100%", background: "#fff", padding: 12, border: "1px solid #ffcc80", borderRadius: 6 }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1em", color: "#e65100" }}>🛡 운영 제어 (Circuit Breaker & Alert)</h3>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, padding: 12, background: "#fff3e0", borderRadius: 6 }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em", color: "#e65100" }}>Circuit Breaker ({gateKey})</h4>
                <div style={{ marginBottom: 8, fontSize: "0.9em" }}>
                  <strong>상태: </strong> 
                  <span style={{ 
                    background: cbState?.state === "open" ? "#d32f2f" : cbState?.state === "half_open" ? "#f57c00" : "#388e3c", 
                    color: "white", padding: "2px 6px", borderRadius: 4, fontWeight: "bold" 
                  }}>
                    {cbState?.state?.toUpperCase() || "CLOSED"}
                  </span>
                  <span style={{ marginLeft: 8, color: "#666" }}>(실패: {cbState?.failCount || 0}회)</span>
                  {cbState?.state === "open" && cbState?.openUntil && (
                    <div style={{ marginTop: 4, color: "#d32f2f", fontSize: "0.9em" }}>
                      차단 해제 예정: {new Date(cbState.openUntil.seconds ? cbState.openUntil.seconds * 1000 : cbState.openUntil).toLocaleString()}
                    </div>
                  )}
                  {cbState?.lastCategory && (
                    <div style={{ marginTop: 4, color: "#757575", fontSize: "0.9em" }}>마지막 오류: {cbState.lastCategory}</div>
                  )}
                </div>
                <button disabled={busy} onClick={resetCircuitBreakerState} style={{ background: "#d32f2f", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                  [상태 초기화 (Reset)]
                </button>
                <button disabled={busy} onClick={loadCircuitBreakerState} style={{ background: "#f57c00", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", marginLeft: 8 }}>
                  [조회]
                </button>
              </div>
              <div style={{ flex: 1, padding: 12, background: "#e8eaf6", borderRadius: 6 }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em", color: "#3f51b5" }}>알림 발송 테스트</h4>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input 
                    value={testAlertMsg} 
                    onChange={(e) => setTestAlertMsg(e.target.value)} 
                    placeholder="테스트 메시지 입력..." 
                    style={{ flex: 1, padding: 6 }} 
                    disabled={busy}
                  />
                  <button disabled={busy} onClick={sendTestAlert} style={{ background: "#3f51b5", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                    [테스트 알림 발송]
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: "0.8em", color: "#666" }}>
                  현재 {gateKey}의 Webhook URL로 메시지가 발송됩니다.
                </div>
              </div>
            </div>
          </div>

          {/* 일일 Gate 집계 영역 */}
          <div style={{ flex: "1 1 300px", background: "#fff", padding: 12, border: "1px solid #eee", borderRadius: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: "1.1em" }}>A. 일일 Gate 집계</h3>
              {gateReportText && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={copyGateReport} style={{ background: "#4caf50", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer" }}>
                    [단순 요약 복사]
                  </button>
                  <button onClick={copyDailyLogMd} style={{ background: "#1976d2", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                    [일일 로그(복붙용) 복사]
                  </button>
                  <button onClick={downloadDailyLogMd} style={{ background: "#f57c00", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                    [일일 로그 다운로드]
                  </button>
                  <button onClick={loadDailyLogSsot} style={{ background: "#2196f3", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                    [SSOT 조회(DB)]
                  </button>
                  <button onClick={appendDailyLogSsot} style={{ background: "#8e24aa", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                    [SSOT 저장(DB)]
                  </button>
                </div>
              )}
            </div>
            {gateReportText ? (
              <>
                <pre style={{ margin: 0, padding: 8, background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 4, whiteSpace: "pre-wrap", wordWrap: "break-word", fontSize: "0.9em" }}>
                  {gateReportText}
                </pre>
                {ssotData && (
                  <div style={{ marginTop: 12, padding: 12, background: "#e8f5e9", border: "1px solid #c8e6c9", borderRadius: 4 }}>
                    <div style={{ fontSize: "0.85em", color: "#2e7d32", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                      <strong>✅ SSOT 저장됨</strong>
                      <span>{new Date(ssotData.createdAt).toLocaleString()} (Req: {ssotData.requestId})</span>
                    </div>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordWrap: "break-word", fontSize: "0.9em", color: "#333" }}>
                      {ssotData.markdown}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: "#999", fontSize: "0.9em" }}>요약을 가져오면 표시됩니다.</div>
            )}
          </div>

          {/* 백로그 후보 영역 */}
          <div style={{ flex: "2 1 400px", background: "#fff", padding: 12, border: "1px solid #eee", borderRadius: 6 }}>
            <div style={{ marginBottom: 12, padding: 12, border: "1px solid #ccc", borderRadius: 6, background: "#f0f4c3" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>⚙️ GitHub 연동 설정 (GateKey: {gateKey})</span>
              </h4>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: "0.85em", color: "#33691e" }}>
                <label style={{ display: "flex", flexDirection: "column" }}>
                  <strong>Owner</strong>
                  <input value={githubOwner} onChange={(e) => setGithubOwner(e.target.value)} style={{ padding: 4, width: 120 }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column" }}>
                  <strong>Repo</strong>
                  <input value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} style={{ padding: 4, width: 120 }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column" }}>
                  <strong>Project Node ID</strong>
                  <input value={githubProjectId} onChange={(e) => setGithubProjectId(e.target.value)} placeholder="PVT_..." style={{ padding: 4, width: 200 }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column" }}>
                  <strong>Token Ref (Issues)</strong>
                  <input value={githubTokenRef} onChange={(e) => setGithubTokenRef(e.target.value)} style={{ padding: 4, width: 220 }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column" }}>
                  <strong>Token Ref (Actions)</strong>
                  <input value={githubTokenRefActions} onChange={(e) => setGithubTokenRefActions(e.target.value)} placeholder="비우면 Issues 토큰 공용" style={{ padding: 4, width: 220 }} />
                </label>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button onClick={updateGithubConfig} disabled={busy} style={{ background: "#33691e", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                    [설정 저장]
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: "1.1em" }}>B. 백로그 후보</h3>
              {backlogItems.length > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={copyBacklog} style={{ background: "#2196f3", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer" }}>
                    [스프린트 백로그용 복사]
                  </button>
                  <button onClick={createBacklogIssues} disabled={busy || !ssotData} style={{ background: "#e91e63", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                    [백로그 이슈 생성(GitHub)]
                  </button>
                  <button onClick={addIssuesToProject} disabled={busy || !ssotData} style={{ background: "#673ab7", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                    [프로젝트 투입(Project)]
                  </button>
                  <button onClick={discoverProjectConfig} disabled={busy} style={{ background: "#00796b", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer" }}>
                    [Project 설정 갱신(Discover)]
                  </button>
                </div>
              )}
            </div>
            {projectConfigResult && (
              <div style={{ marginBottom: 12, padding: 12, border: "1px solid #ccc", borderRadius: 6, background: "#e0f2f1" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>✅ GitHub Project 설정 갱신 완료</span>
                  {projectConfigResult.missingMappings?.length === 0 && (
                    <span style={{ fontSize: "0.85em", color: "white", background: "#388e3c", padding: "2px 6px", borderRadius: 4 }}>설정 완벽함</span>
                  )}
                </h4>
                <div style={{ fontSize: "0.85em", color: "#004d40" }}>
                  <strong>Project ID:</strong> {projectConfigResult.projectId}<br />
                  <strong>Status Options:</strong> {Object.keys(projectConfigResult.resolved?.statusOptionIds || {}).join(", ")}<br />
                  <strong>Priority Options:</strong> {Object.keys(projectConfigResult.resolved?.priorityOptionIds || {}).join(", ")}
                </div>
                {projectConfigResult.missingMappings && projectConfigResult.missingMappings.length > 0 && (
                  <div style={{ marginTop: 8, padding: 8, background: "#fff3e0", border: "1px solid #ffe0b2", borderRadius: 4, color: "#e65100", fontSize: "0.85em" }}>
                    <strong>⚠️ 매핑 누락 경고:</strong> 아래 항목들을 찾지 못했습니다. Custom Alias를 추가하세요.<br />
                    {projectConfigResult.missingMappings.join(", ")}
                  </div>
                )}
                
                {/* Custom Alias 에디터 */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #b2dfdb" }}>
                  <strong style={{ fontSize: "0.85em", color: "#004d40", display: "block", marginBottom: 4 }}>🔧 Custom Alias 편집 (JSON)</strong>
                  <textarea 
                    value={aliasJsonText}
                    onChange={(e) => setAliasJsonText(e.target.value)}
                    style={{ width: "100%", height: "100px", fontFamily: "monospace", fontSize: "0.8em", padding: 8, boxSizing: "border-box", border: "1px solid #b2dfdb", borderRadius: 4 }}
                    placeholder='{"fieldAliases": {"status": ["진행상태"]}, "optionAliases": {"status.todo": ["대기"]}}'
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={updateAliasesAndResolve} disabled={busy} style={{ background: "#00897b", color: "white", border: "none", padding: "4px 8px", fontSize: "0.8em", borderRadius: 4, cursor: "pointer" }}>
                      [Alias 저장 + Resolve]
                    </button>
                    <button onClick={reResolveProjectConfig} disabled={busy} style={{ background: "#4db6ac", color: "white", border: "none", padding: "4px 8px", fontSize: "0.8em", borderRadius: 4, cursor: "pointer" }}>
                      [Resolve만 재시도]
                    </button>
                  </div>
                </div>
              </div>
            )}
            {issueCreationResult && (
              <div style={{ marginBottom: 12, padding: 12, border: "1px solid #ccc", borderRadius: 6, background: "#fafafa" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em" }}>✅ GitHub 이슈 생성 결과</h4>
                {issueCreationResult.created?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: "#2e7d32", fontSize: "0.9em" }}>새로 생성됨 ({issueCreationResult.created.length}건):</strong>
                    <ul style={{ margin: "4px 0 0 0", paddingLeft: 20, fontSize: "0.85em" }}>
                      {issueCreationResult.created.map((c: any, i: number) => (
                        <li key={i}>
                          <a href={c.issueUrl} target="_blank" rel="noreferrer" style={{ color: "#1976d2" }}>#{c.issueNumber}</a> ({c.dedupeKey})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {issueCreationResult.skipped?.length > 0 && (
                  <div>
                    <strong style={{ color: "#757575", fontSize: "0.9em" }}>건너뜀 (이미 존재 등, {issueCreationResult.skipped.length}건):</strong>
                    <ul style={{ margin: "4px 0 0 0", paddingLeft: 20, fontSize: "0.85em", color: "#9e9e9e" }}>
                      {issueCreationResult.skipped.map((s: any, i: number) => (
                        <li key={i}>{s.dedupeKey} - {s.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {projectAddResult && (
              <div style={{ marginBottom: 12, padding: 12, border: "1px solid #ccc", borderRadius: 6, background: "#f3e5f5" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95em" }}>✅ GitHub Project 투입 결과</h4>
                {projectAddResult.added?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: "#2e7d32", fontSize: "0.9em" }}>투입 완료 ({projectAddResult.added.length}건):</strong>
                    <ul style={{ margin: "4px 0 0 0", paddingLeft: 20, fontSize: "0.85em" }}>
                      {projectAddResult.added.map((a: any, i: number) => (
                        <li key={i}>
                          <a href={a.issueUrl} target="_blank" rel="noreferrer" style={{ color: "#1976d2" }}>이슈 확인</a> (Project Item: {a.projectItemId})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {projectAddResult.skipped?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: "#757575", fontSize: "0.9em" }}>건너뜀 ({projectAddResult.skipped.length}건):</strong>
                    <ul style={{ margin: "4px 0 0 0", paddingLeft: 20, fontSize: "0.85em", color: "#9e9e9e" }}>
                      {projectAddResult.skipped.map((s: any, i: number) => (
                        <li key={i}>{s.projectDedupeKey} - {s.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {projectAddResult.failed?.length > 0 && (
                  <div>
                    <strong style={{ color: "#d32f2f", fontSize: "0.9em" }}>실패 ({projectAddResult.failed.length}건):</strong>
                    <ul style={{ margin: "4px 0 0 0", paddingLeft: 20, fontSize: "0.85em", color: "#d32f2f" }}>
                      {projectAddResult.failed.map((f: any, i: number) => (
                        <li key={i}>
                          {f.issueUrl && <a href={f.issueUrl} target="_blank" rel="noreferrer" style={{ color: "#d32f2f", textDecoration: "underline", marginRight: 4 }}>이슈</a>}
                          {f.projectDedupeKey} - {f.reason}
                          {f.reason === "MISSING_MAPPING" && (
                            <span style={{ display: "block", marginTop: 4, color: "#b71c1c" }}>
                              <strong>누락:</strong> {f.missing?.join(", ")} <br/>
                              <em>{f.hint}</em>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {backlogItems.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>Sev</th>
                    <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>제목</th>
                    <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>영향도</th>
                    <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>샘플케이스</th>
                  </tr>
                </thead>
                <tbody>
                  {backlogItems.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                        <span style={{ 
                          background: item.severity === 1 ? "#ffebee" : item.severity === 2 ? "#fff3e0" : "#f5f5f5", 
                          color: item.severity === 1 ? "#d32f2f" : item.severity === 2 ? "#e64a19" : "#616161",
                          padding: "2px 6px", borderRadius: 4, fontWeight: "bold" 
                        }}>
                          Sev{item.severity}
                        </span>
                      </td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>{item.title}</td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>{item.impactCount}건</td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 6, fontSize: "0.9em", color: "#666" }}>
                        {item.sampleCaseIds.map((cid: string) => (
                          <span key={cid} style={{ cursor: "pointer", textDecoration: "underline", marginRight: 8, color: "#1890ff" }} onClick={() => handleLoadCaseFromBacklog(cid)}>
                            {cid}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: "#999", fontSize: "0.9em" }}>백로그 후보가 없거나 요약을 가져오지 않았습니다.</div>
            )}
          </div>
          {/* 최근 실패 케이스 영역 */}
          <div style={{ flex: "1 1 100%", background: "#fff", padding: 12, border: "1px solid #eee", borderRadius: 6, marginTop: 16 }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1em", color: "#d32f2f" }}>C. 최근 7일 실패 케이스 (최신 50건)</h3>
            {recentFails.length > 0 ? (
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                  <thead style={{ position: "sticky", top: 0, background: "#fff" }}>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>validatedAt</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>caseId</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>누락 서류</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>evidenceId</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentFails.map((fail, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? "#fafafa" : "#fff" }}>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6, color: "#666" }}>
                          {new Date(fail.validatedAt).toLocaleString()}
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                          <span 
                            style={{ cursor: "pointer", textDecoration: "underline", color: "#1890ff", fontWeight: "bold" }} 
                            onClick={() => handleLoadCaseFromBacklog(fail.caseId)}
                          >
                            {fail.caseId}
                          </span>
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6, color: "#d32f2f" }}>
                          {fail.missingTop3.join(", ")} {fail.missingCount > 3 ? `(+${fail.missingCount - 3})` : ""}
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6, color: "#999", fontSize: "0.85em" }}>
                          {fail.evidenceId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: "#999", fontSize: "0.9em" }}>최근 7일간 실패 케이스가 없거나 조회 전입니다.</div>
            )}
          </div>
          
          {/* 통합 감사 로그 (Audit Log) 영역 */}
          <div style={{ flex: "1 1 100%", background: "#fff", padding: 12, border: "1px solid #eee", borderRadius: 6, marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: "1.1em", color: "#4527a0" }}>🧾 통합 감사 로그 (Audit Log)</h3>
            </div>
            
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, fontSize: "0.85em" }}>
              <label style={{ display: "flex", flexDirection: "column" }}>
                GateKey
                <input value={auditFilterGateKey} onChange={e => setAuditFilterGateKey(e.target.value)} placeholder="all" style={{ padding: 4, width: 100 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                Action
                <input value={auditFilterAction} onChange={e => setAuditFilterAction(e.target.value)} placeholder="all" style={{ padding: 4, width: 120 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                Status
                <select value={auditFilterStatus} onChange={e => setAuditFilterStatus(e.target.value)} style={{ padding: 4 }}>
                  <option value="">all</option>
                  <option value="success">success</option>
                  <option value="fail">fail</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                Actor UID
                <input value={auditFilterActorUid} onChange={e => setAuditFilterActorUid(e.target.value)} placeholder="all" style={{ padding: 4, width: 120 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                From
                <input type="date" value={auditFilterFrom} onChange={e => setAuditFilterFrom(e.target.value)} style={{ padding: 4 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column" }}>
                To
                <input type="date" value={auditFilterTo} onChange={e => setAuditFilterTo(e.target.value)} style={{ padding: 4 }} />
              </label>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button onClick={() => { setBusy(true); loadAuditEvents(true).finally(() => setBusy(false)); }} disabled={busy} style={{ background: "#673ab7", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                  조회
                </button>
              </div>
            </div>

            {auditEvents.length > 0 ? (
              <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid #ddd" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85em" }}>
                  <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6, width: "120px" }}>시간</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6, width: "120px" }}>Gate / Action</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6, width: "80px" }}>Status</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6, width: "100px" }}>Actor</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>Summary</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6, width: "160px" }}>Req/Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEvents.map((evt) => (
                      <tr key={evt.id} style={{ background: evt.status === "fail" ? "#ffebee" : "transparent" }}>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6, color: "#666" }}>
                          {evt.createdAt ? new Date(evt.createdAt).toLocaleString() : "-"}
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6, fontWeight: "bold", color: "#37474f" }}>
                          <div style={{ color: "#78909c", fontSize: "0.8em" }}>{evt.gateKey}</div>
                          {evt.action}
                          {evt.error?.category && (
                            <span style={{ 
                              display: "inline-block", 
                              marginLeft: 6, 
                              padding: "2px 6px", 
                              fontSize: "0.75em", 
                              background: evt.error.category === "AUTH" ? "#fce4ec" : evt.error.category === "NETWORK" ? "#e8eaf6" : "#fff3e0", 
                              color: evt.error.category === "AUTH" ? "#c2185b" : evt.error.category === "NETWORK" ? "#3949ab" : "#e65100", 
                              borderRadius: 4,
                              cursor: "help"
                            }} title={evt.error.hint || evt.error.category}>
                              {evt.error.category}
                            </span>
                          )}
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                          <span style={{ 
                            background: evt.status === "success" ? "#e8f5e9" : "#ffcdd2", 
                            color: evt.status === "success" ? "#2e7d32" : "#c62828",
                            padding: "2px 6px", borderRadius: 4, fontWeight: "bold",
                            cursor: "pointer"
                          }} onClick={() => setAuditSelectedEvent(evt)} title="상세 보기">
                            {evt.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6, fontSize: "0.9em", color: "#555" }}>
                          {evt.actorUid?.substring(0, 8)}...
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                          <div style={{ cursor: "pointer", color: "#1976d2" }} onClick={() => setAuditSelectedEvent(evt)}>
                            {evt.summary}
                          </div>
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span title={evt.requestId} style={{ cursor: "pointer", color: "#1976d2", textDecoration: "underline" }} onClick={() => navigator.clipboard.writeText(evt.requestId || "")}>
                              {evt.requestId?.substring(0, 8)}...
                            </span>
                            {evt.error && (
                              <span style={{ color: "#d32f2f", marginLeft: 4 }} title={evt.error.message}>
                                ⚠️ {evt.error.code || "Error"}
                              </span>
                            )}
                            {evt.status === "fail" && ["monthly.generate", "project.discover", "project.resolve", "project.add", "workflow.dispatch", "issue.create"].includes(evt.action) && (!evt.error?.category || ["NETWORK", "GITHUB_RATE_LIMIT", "UNKNOWN"].includes(evt.error.category)) && (
                              <button 
                                onClick={() => requestRetry(evt.id)} 
                                disabled={busy}
                                style={{ marginLeft: 8, padding: "2px 6px", fontSize: "0.8em", background: "#f57c00", color: "white", border: "none", borderRadius: 3, cursor: "pointer" }}
                              >
                                [재시도]
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {auditNextCursor && (
                  <div style={{ padding: 12, textAlign: "center", borderTop: "1px solid #ddd", background: "#f9f9f9" }}>
                    <button onClick={() => { setBusy(true); loadAuditEvents(false).finally(() => setBusy(false)); }} disabled={busy} style={{ background: "#fff", border: "1px solid #ccc", padding: "6px 16px", borderRadius: 4, cursor: "pointer" }}>
                      더 보기 (Next)
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: "#999", fontSize: "0.9em", padding: 12, textAlign: "center", border: "1px solid #eee", borderRadius: 4 }}>조건에 맞는 감사 로그가 없습니다.</div>
            )}
          </div>
          
          {/* 재시도 작업 현황 영역 */}
          <div style={{ flex: "1 1 100%", background: "#fff", padding: 12, border: "1px solid #eee", borderRadius: 6, marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: "1.1em", color: "#f57c00" }}>🔄 재시도 작업 현황 (최근 50건)</h3>
              <button onClick={() => { setBusy(true); loadRetryJobs().finally(() => setBusy(false)); }} disabled={busy} style={{ background: "#f57c00", color: "white", border: "none", padding: "4px 8px", fontSize: "0.85em", borderRadius: 4, cursor: "pointer" }}>
                [새로고침]
              </button>
            </div>
            {retryJobs.length > 0 ? (
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85em" }}>
                  <thead style={{ position: "sticky", top: 0, background: "#fff" }}>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6, width: "120px" }}>생성일</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6, width: "100px" }}>Action</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6, width: "80px" }}>Status</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6, width: "100px" }}>시도 횟수</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>다음 실행 예정</th>
                      <th style={{ textAlign: "left", borderBottom: "2px solid #ddd", padding: 6 }}>오류 내역</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retryJobs.map((job) => (
                      <tr key={job.id} style={{ background: job.status === "dead" ? "#ffebee" : job.status === "queued" ? "#fff8e1" : "transparent" }}>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6, color: "#666" }}>
                          {job.createdAt ? new Date(job.createdAt).toLocaleString() : "-"}
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6, fontWeight: "bold", color: "#37474f" }}>
                          {job.action}
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                          <span style={{ 
                            background: job.status === "success" ? "#e8f5e9" : job.status === "dead" ? "#ffcdd2" : job.status === "queued" ? "#ffecb3" : "#e3f2fd", 
                            color: job.status === "success" ? "#2e7d32" : job.status === "dead" ? "#c62828" : job.status === "queued" ? "#f57c00" : "#1565c0",
                            padding: "2px 6px", borderRadius: 4, fontWeight: "bold" 
                          }}>
                            {job.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                          {job.attempts} / {job.maxAttempts}
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                          {job.nextRunAt && job.status === "queued" ? new Date(job.nextRunAt).toLocaleString() : "-"}
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {job.lastError && (
                              <span style={{ color: "#d32f2f" }} title={job.lastError.message}>
                                ⚠️ {job.lastError.message?.substring(0, 30)}...
                              </span>
                            )}
                            {job.status === "dead" && (
                              <button disabled={busy} onClick={() => retryDeadLetterIssue(job.id)} style={{ background: "#c62828", color: "white", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.8em", alignSelf: "flex-start" }}>
                                [이슈 수동 생성]
                              </button>
                            )}
                            {job.deadIssue && (
                              <a href={job.deadIssue.issueUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.8em", color: "#1976d2", textDecoration: "underline" }}>
                                ↗️ 이슈 #{job.deadIssue.issueNumber}
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: "#999", fontSize: "0.9em" }}>최근 재시도 작업이 없습니다.</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>케이스 조회</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            caseId{" "}
            <input value={caseId} onChange={(e) => setCaseId(e.target.value)} style={{ width: 360, padding: 6 }} />
          </label>
          <button disabled={busy} onClick={loadCaseDetail}>조회</button>
        </div>
        {caseDetail && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* A. Case 요약 */}
            <div style={{ padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
              <h3 style={{ margin: "0 0 8px 0" }}>A. Case 요약</h3>
              <div><strong>status</strong>: {caseDetail.status}</div>
              <div><strong>stage</strong>: {caseDetail.stage || "-"}</div>
              <div><strong>updatedAt</strong>: {new Date(caseDetail.updatedAt).toLocaleString()}</div>
              <div><strong>partnerId</strong>: {caseDetail.partnerId}</div>
            </div>

            {/* B. Documents 요약 */}
            <div style={{ padding: 12, background: "#fff3e0", borderRadius: 6 }}>
              <h3 style={{ margin: "0 0 8px 0" }}>B. Documents (최근 10개)</h3>
              {documents.length === 0 ? (
                <div style={{ color: "#666" }}>없음</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>slotId</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>status</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>fileName</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>updatedAt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.slice(0, 10).map((d) => {
                      const v = d.latestVersionId ? d.versions?.[d.latestVersionId] : null;
                      return (
                        <tr key={d.id}>
                          <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{d.slotId}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: 4, color: d.status !== "ok" ? "red" : "inherit" }}>{d.status}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{v?.fileName || "-"}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{new Date(d.updatedAt).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* C. Timeline 최근 20개 */}
            <div style={{ padding: 12, background: "#e3f2fd", borderRadius: 6 }}>
              <h3 style={{ margin: "0 0 8px 0" }}>C. Timeline (최근 20개)</h3>
              {timeline.length === 0 ? (
                <div style={{ color: "#666" }}>없음</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.9em" }}>
                  {timeline.slice(0, 20).map((e) => (
                    <li key={e.id}>
                      [{new Date(e.occurredAt).toLocaleString()}] {e.type} / {e.summaryKo}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* D. Gate evidence 최근 10개 */}
            <div style={{ padding: 12, background: "#e8f5e9", borderRadius: 6 }}>
              <h3 style={{ margin: "0 0 8px 0" }}>D. Gate Evidence (최근 10개)</h3>
              {/* @ts-ignore */}
              {typeof gateEvidences === 'undefined' || !gateEvidences || gateEvidences.length === 0 ? (
                <div style={{ color: "#666" }}>없음</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>validatedAt</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>ok</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>missingCount</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>missing[]</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* @ts-ignore */}
                    {gateEvidences.map((g) => (
                      <tr key={g.evidenceId}>
                        <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{g.validatedAt}</td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 4, color: g.ok ? "green" : "red", fontWeight: "bold" }}>
                          {g.ok ? "true" : "false"}
                        </td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{g.missingCount}</td>
                        <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{g.missing?.join(", ") || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* E. Sev1 핫픽스 대응 (접수증 누락 등) */}
            {gateEvidences?.[0]?.missing?.includes("slot_filing_receipt") && (
              <div style={{ padding: 12, background: "#ffebee", borderRadius: 6, border: "1px solid #ffcdd2" }}>
                <h3 style={{ margin: "0 0 8px 0", color: "#d32f2f" }}>E. Sev1 핫픽스 (접수증 누락 대응)</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                  <button disabled={busy} onClick={doSev1HotfixFull} style={{ background: "#4caf50", color: "white", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>⚡️ 원클릭 자동 핫픽스 (재생성 + 재검증 + 복사)</button>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button disabled={busy} onClick={doRegenerate} style={{ background: "#d32f2f", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}>1. 패키지 재생성</button>
                  <button disabled={busy} onClick={doValidate} style={{ background: "#d32f2f", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}>2. Gate 재검증</button>
                  <button disabled={!sev1Log.reqId} onClick={copySev1Log} style={{ background: "#424242", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}>[운영 로그용 3줄 복사]</button>
                </div>
                {sev1Log.reqId && (
                  <div style={{ marginTop: 8, fontSize: "0.9em", color: "#d32f2f" }}>
                    <div>재생성: {sev1Log.regenerateOk ? "✅ 성공" : "-"}</div>
                    <div>재검증: {sev1Log.validateData ? `✅ evidenceId: ${sev1Log.validateData.evidenceId} (ok: ${sev1Log.validateData.ok})` : "❌ 실패"}</div>
                    <div>Req ID: {sev1Log.reqId}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>정산(ops)</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>partnerId <input value={settlementPartnerId} onChange={(e) => setSettlementPartnerId(e.target.value)} style={{ width: 160, padding: 6 }} /></label>
          <label>from <input value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} style={{ width: 120, padding: 6 }} /></label>
          <label>to <input value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} style={{ width: 120, padding: 6 }} /></label>
          <button disabled={busy} onClick={generateSettlement}>정산 생성</button>
          <button disabled={busy} onClick={loadSettlements}>정산 목록 로드</button>
        </div>
        {settlements.length === 0 ? (
          <div style={{ marginTop: 8, color: "#666" }}>정산이 없습니다.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>id</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>partnerId</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>period</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>status</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>actions</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{s.id}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{s.partnerId}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{s.period?.from} ~ {s.period?.to}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{s.status}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <div style={{ color: "#666", marginBottom: 6, fontSize: 12 }}>
                      gross {s.amountGross?.amount} / refunds {s.amountRefunds?.amount} / offset {s.amountOffset?.amount} / payout {s.amountPayout?.amount} {s.currency}
                    </div>
                    <button disabled={busy || s.status === "paid"} onClick={() => paySettlement(s.id)}>지급 처리</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 12 }}>
          <strong>정산 아이템(대사)</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
            <input
              value={settlementIdForItems}
              onChange={(e) => setSettlementIdForItems(e.target.value)}
              placeholder="settlementId 입력"
              style={{ width: 280, padding: 6 }}
            />
            <button disabled={busy} onClick={loadSettlementItems}>아이템 로드</button>
          </div>
          {settlementItems.length > 0 && (
            <ul style={{ marginTop: 8 }}>
              {settlementItems.slice(0, 10).map((it) => (
                <li key={it.id}>{it.type} / {it.amount?.amount}{it.amount?.currency}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {items.length === 0 ? (
          <div style={{ color: "#666" }}>pending approvals가 없습니다.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>approvalId</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>gate</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>summaryKo</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{it.id}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{it.gate}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{it.summaryKo}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <button disabled={busy} onClick={() => decide(it.id, "approve")}>승인</button>{" "}
                    <button disabled={busy} onClick={() => decide(it.id, "reject")}>반려</button>
                    {gate === "refund_approve" && status === "approved" && it.target?.type === "refund" && (
                      <>
                        {" "}
                        <button disabled={busy} onClick={() => executeRefund(it)}>집행</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 감사 로그 상세 모달 */}
      {auditSelectedEvent && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", padding: 24, borderRadius: 8, width: 600, maxWidth: "90%", maxHeight: "90%", overflowY: "auto", position: "relative" }}>
            <button onClick={() => setAuditSelectedEvent(null)} style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", fontSize: "1.5em", cursor: "pointer", color: "#666" }}>×</button>
            <h2 style={{ margin: "0 0 16px 0", color: "#4527a0", fontSize: "1.3em" }}>감사 로그 상세</h2>
            
            <div style={{ marginBottom: 16 }}>
              <strong>ID:</strong> {auditSelectedEvent.id} <br/>
              <strong>시간:</strong> {new Date(auditSelectedEvent.createdAt).toLocaleString()} <br/>
              <strong>Gate:</strong> {auditSelectedEvent.gateKey} <br/>
              <strong>Action:</strong> <span style={{ fontWeight: "bold", color: "#00695c" }}>{auditSelectedEvent.action}</span> <br/>
              <strong>Status:</strong> <span style={{ color: auditSelectedEvent.status === "success" ? "green" : "red", fontWeight: "bold" }}>{auditSelectedEvent.status}</span> <br/>
              <strong>Actor UID:</strong> {auditSelectedEvent.actorUid} <br/>
              <strong>Req ID:</strong> {auditSelectedEvent.requestId || "N/A"} <br/>
              <strong>Summary:</strong> {auditSelectedEvent.summary}
            </div>

            {auditSelectedEvent.error && (
              <div style={{ marginBottom: 16, padding: 12, background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: 4 }}>
                <h4 style={{ margin: "0 0 8px 0", color: "#c62828" }}>오류 정보</h4>
                <strong>Category:</strong> {auditSelectedEvent.error.category || "UNKNOWN"} <br/>
                <strong>Code:</strong> {auditSelectedEvent.error.code || "N/A"} <br/>
                <strong>Message:</strong> <pre style={{ margin: "4px 0", whiteSpace: "pre-wrap", color: "#c62828", fontSize: "0.9em" }}>{auditSelectedEvent.error.message}</pre>
                {auditSelectedEvent.error.hint && <div><strong>Hint:</strong> {auditSelectedEvent.error.hint}</div>}
              </div>
            )}

            {auditSelectedEvent.target && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h4 style={{ margin: 0, color: "#1565c0" }}>Target / Meta</h4>
                  <button onClick={() => navigator.clipboard.writeText(JSON.stringify(auditSelectedEvent.target, null, 2))} style={{ background: "#1976d2", color: "white", border: "none", padding: "4px 8px", fontSize: "0.8em", borderRadius: 4, cursor: "pointer" }}>
                    JSON 복사
                  </button>
                </div>
                <pre style={{ margin: 0, padding: 12, background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 4, whiteSpace: "pre-wrap", wordWrap: "break-word", fontSize: "0.85em" }}>
                  {JSON.stringify(auditSelectedEvent.target, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      <pre style={{ marginTop: 16, background: "#111", color: "#eee", padding: 12, borderRadius: 8, overflowX: "auto" }}>
        {log || "ready"}
      </pre>
    </div>
  );
}

export default App;
