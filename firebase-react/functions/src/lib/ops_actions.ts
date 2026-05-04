import * as admin from "firebase-admin";
import { checkCircuitBreaker, recordCircuitBreakerSuccess, recordCircuitBreakerFail } from "./ops_circuit_breaker";
import { categorizeError } from "./ops_audit";

export interface ProjectConfigResult {
  projectId: string;
  rawFields: any[];
  resolved: any;
  missingMappings: string[];
  customAliases: any;
  updatedAt: admin.firestore.FieldValue;
  updatedBy: string;
  source: string;
  github?: any;
}

export function doResolve(rawFields: any[], customAliases: any) {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, "");

  const fieldAliases = {
    status: ["status", "state", "workflow", "상태", "진행상태", "워크플로우"],
    priority: ["priority", "prio", "우선순위", "중요도"],
    severity: ["severity", "sev", "등급", "심각도"]
  };

  const optionAliases = {
    "status.todo": ["todo", "to do", "할일", "할 일", "대기", "new"],
    "status.in_progress": ["in progress", "doing", "진행중", "진행 중"],
    "status.done": ["done", "complete", "완료"],
    "priority.p0": ["p0", "highest", "긴급", "최우선"],
    "priority.p1": ["p1", "high", "높음"],
    "priority.p2": ["p2", "medium", "보통"]
  };

  if (customAliases.fieldAliases) {
    for (const [k, v] of Object.entries(customAliases.fieldAliases)) {
      if (Array.isArray(v) && fieldAliases[k as keyof typeof fieldAliases]) {
        fieldAliases[k as keyof typeof fieldAliases].push(...(v as string[]));
      }
    }
  }
  if (customAliases.optionAliases) {
    for (const [k, v] of Object.entries(customAliases.optionAliases)) {
      if (Array.isArray(v) && optionAliases[k as keyof typeof optionAliases]) {
        optionAliases[k as keyof typeof optionAliases].push(...(v as string[]));
      }
    }
  }

  const resolved: Record<string, any> = {};
  const missingMappings: string[] = [];

  for (const [fKey, fAliases] of Object.entries(fieldAliases)) {
    const normAliases = fAliases.map(norm);
    const node = rawFields.find((n: any) => n.name && normAliases.includes(norm(n.name)));
    
    if (node) {
      resolved[`${fKey}FieldId`] = node.id;
      resolved[`${fKey}OptionIds`] = {};
      
      const optPrefix = `${fKey}.`;
      for (const [oKey, oAliases] of Object.entries(optionAliases)) {
        if (!oKey.startsWith(optPrefix)) continue;
        const shortOKey = oKey.replace(optPrefix, "");
        const normOAliases = oAliases.map(norm);
        
        const optNode = node.options?.find((o: any) => o.name && normOAliases.includes(norm(o.name)));
        if (optNode) {
          resolved[`${fKey}OptionIds`][shortOKey] = optNode.id;
        } else {
          missingMappings.push(oKey);
        }
      }
    } else {
      missingMappings.push(`${fKey}FieldId`);
    }
  }

  return { resolved, missingMappings };
}

export async function doResolveAction(
  adminApp: typeof admin,
  gateKey: string,
  uid: string = "system"
) {
  const docRef = adminApp.firestore().collection("ops_github_project_config").doc(gateKey);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new Error("Project 설정이 없습니다. 먼저 Discover API를 실행하세요.");
  }

  const config = docSnap.data() as any;
  if (!config.rawFields || !Array.isArray(config.rawFields)) {
    throw new Error("rawFields가 없습니다. Discover를 다시 실행하세요.");
  }

  const result = doResolve(config.rawFields, config.customAliases || {});

  await docRef.update({
    resolved: result.resolved,
    missingMappings: result.missingMappings,
    updatedAt: adminApp.firestore.FieldValue.serverTimestamp(),
    updatedBy: uid
  });

  return result;
}

export async function discoverProjectConfigAction(
  adminApp: typeof admin,
  gateKey: string,
  reqProjectId?: string,
  uid: string = "system"
): Promise<ProjectConfigResult> {
  const configDoc = await adminApp.firestore().collection("ops_github_project_config").doc(gateKey).get();
  const existingConfig = configDoc.exists ? configDoc.data() : {};
  const githubConfig = existingConfig?.github || {};

  const projectId = reqProjectId || githubConfig.projectId || process.env.GITHUB_PROJECT_ID;
  const tokenRef = githubConfig.tokenRef || "GITHUB_TOKEN_BACKLOG_BOT";
  const GITHUB_TOKEN = process.env[tokenRef] || "";

  if (!projectId || !GITHUB_TOKEN) {
    throw new Error(`Project ID 또는 토큰이 누락되었습니다. (tokenRef: ${tokenRef})`);
  }

  await checkCircuitBreaker(adminApp, gateKey);

  const query = `
    query {
      node(id: "${projectId}") {
        ... on ProjectV2 {
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  const ghRes = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });

  const ghData = await ghRes.json();
  if (ghData.errors) {
    const errorMsg = `GraphQL Error: ${JSON.stringify(ghData.errors)}`;
    await recordCircuitBreakerFail(adminApp, gateKey, "UNKNOWN", errorMsg);
    throw new Error(errorMsg);
  }
  
  await recordCircuitBreakerSuccess(adminApp, gateKey);

  const nodes = ghData.data.node.fields.nodes;
  const customAliases = existingConfig?.customAliases || {};
  const { resolved, missingMappings } = doResolve(nodes, customAliases);

  const configData: ProjectConfigResult = {
    projectId,
    rawFields: nodes,
    resolved,
    missingMappings,
    customAliases,
    updatedAt: adminApp.firestore.FieldValue.serverTimestamp(),
    updatedBy: uid,
    source: "discovery"
  };

  await adminApp.firestore()
    .collection("ops_github_project_config")
    .doc(gateKey)
    .set(configData, { merge: true });

  return configData;
}

export async function generateMonthlyReportAction(
  adminApp: typeof admin,
  gateKey: string,
  month: string,
  dryRun: boolean = false
) {
  const startId = gateKey === "pilot-gate" ? `${month}-01` : `${gateKey}:${month}-01`;
  
  const nextMonthDate = new Date(`${month}-01T00:00:00+09:00`);
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const nextMonthStr = nextMonthDate.toISOString().substring(0, 7);
  const endId = gateKey === "pilot-gate" ? `${nextMonthStr}-01` : `${gateKey}:${nextMonthStr}-01`;

  const snap = await adminApp.firestore()
    .collection("ops_daily_logs")
    .where(adminApp.firestore.FieldPath.documentId(), ">=", startId)
    .where(adminApp.firestore.FieldPath.documentId(), "<", endId)
    .get();

  const totals = { daysWithLogs: snap.size, totalGate: 0, ok: 0, fail: 0 };
  const topSlotsMap: Record<string, { severity: number, impactCount: number, daysAppeared: number }> = {};
  const daily: any[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const dateStr = gateKey === "pilot-gate" ? doc.id : doc.id.split(":")[1];
    const metrics = data.metrics || { total: 0, okCount: 0, failCount: 0, topMissing: [] };
    
    totals.totalGate += metrics.total || 0;
    totals.ok += metrics.okCount || 0;
    totals.fail += metrics.failCount || 0;

    daily.push({
      date: dateStr,
      total: metrics.total || 0,
      ok: metrics.okCount || 0,
      fail: metrics.failCount || 0,
      topMissing: metrics.topMissing || []
    });

    if (Array.isArray(data.topIssues)) {
      for (const issue of data.topIssues) {
        const slotId = issue.slotId;
        const sevNum = parseInt(String(issue.severity).replace(/\D/g, ""), 10) || 3;
        if (!topSlotsMap[slotId]) {
          topSlotsMap[slotId] = { severity: sevNum, impactCount: 0, daysAppeared: 0 };
        }
        topSlotsMap[slotId].impactCount += issue.impactCount || 1;
        topSlotsMap[slotId].daysAppeared += 1;
        if (sevNum < topSlotsMap[slotId].severity) {
          topSlotsMap[slotId].severity = sevNum;
        }
      }
    }
  }

  const topSlots = Object.entries(topSlotsMap)
    .map(([slotId, stats]) => ({
      slotId,
      severity: stats.severity,
      impactCount: stats.impactCount,
      daysAppeared: stats.daysAppeared
    }))
    .sort((a, b) => a.severity - b.severity || b.impactCount - a.impactCount);

  const markdownSummary = [
    `## ${month} 월간 트렌드 요약 (${gateKey})`,
    ``,
    `- **가동 일수**: ${totals.daysWithLogs}일`,
    `- **총 Gate 처리**: ${totals.totalGate}건`,
    `- **성공**: ${totals.ok}건 / **실패**: ${totals.fail}건`,
    ``,
    `### Top 누락 Slot (월간)`,
    ...topSlots.slice(0, 5).map(s => `- **${s.slotId}** (Sev${s.severity}): ${s.impactCount}건 발생 (총 ${s.daysAppeared}일 등장)`),
  ].join("\n");

  const reportData = {
    gateKey,
    month,
    generatedAt: adminApp.firestore.FieldValue.serverTimestamp(),
    totals,
    topSlots,
    daily: daily.sort((a, b) => a.date.localeCompare(b.date)),
    markdownSummary
  };

  if (!dryRun) {
    await adminApp.firestore()
      .collection("ops_monthly_reports")
      .doc(`${gateKey}:${month}`)
      .set(reportData, { merge: false });
  }

  return { ...reportData, dryRun };
}

export async function dispatchWorkflowAction(
  adminApp: typeof admin,
  gateKey: string,
  month: string,
  gateKeyOverride?: string
) {
  const finalGateKey = gateKeyOverride || gateKey;

  const configDoc = await adminApp.firestore().collection("ops_github_project_config").doc(gateKey).get();
  if (!configDoc.exists) {
    throw new Error("GitHub 설정이 없습니다. 먼저 설정을 완료하세요.");
  }
  const config = configDoc.data() || {};
  const githubConfig = config.github || {};
  const owner = githubConfig.owner || "beokadm-creator";
  const repo = githubConfig.repo || "agnet-eregi";
  
  const tokenRef = githubConfig.tokenRefActions || githubConfig.tokenRef || "GITHUB_TOKEN_BACKLOG_BOT";
  const GITHUB_TOKEN = process.env[tokenRef] || "";

  if (!GITHUB_TOKEN) {
    throw new Error(`GitHub Actions 토큰이 설정되지 않았습니다. (tokenRef: ${tokenRef})`);
  }

  await checkCircuitBreaker(adminApp, gateKey);

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
    },
  });

  if (!repoRes.ok) {
     const errText = await repoRes.text();
     throw new Error(`GitHub Repository 조회 실패: ${repoRes.status} ${errText}`);
  }

  const repoData = await repoRes.json();
  const defaultBranch = repoData.default_branch || "main";

  const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/ops-monthly-summary-sync.yml/dispatches`;
  
  const payload = {
    ref: defaultBranch,
    inputs: {
      gate_key: finalGateKey,
      target_month: month
    }
  };

  const ghRes = await fetch(dispatchUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!ghRes.ok) {
    const errText = await ghRes.text();
    const errorMsg = `GitHub Workflow Dispatch 실패: ${ghRes.status} ${errText}`;
    await recordCircuitBreakerFail(adminApp, gateKey, "UNKNOWN", errorMsg);
    throw new Error(errorMsg);
  }
  
  await recordCircuitBreakerSuccess(adminApp, gateKey);

  return { dispatched: true, gateKey: finalGateKey, month };
}

export async function createDeadLetterIssueAction(
  adminApp: typeof admin,
  gateKey: string,
  action: string,
  errorMessage: string,
  attempts: number,
  jobId: string,
  sourceEventId?: string
) {
  const configDoc = await adminApp.firestore().collection("ops_github_project_config").doc(gateKey).get();
  if (!configDoc.exists) return null;
  const config = configDoc.data() || {};
  const githubConfig = config.github || {};
  const owner = githubConfig.owner || "beokadm-creator";
  const repo = githubConfig.repo || "agnet-eregi";
  const tokenRef = githubConfig.tokenRef || "GITHUB_TOKEN_BACKLOG_BOT";
  const projectId = githubConfig.projectId;
  const GITHUB_TOKEN = process.env[tokenRef] || "";

  if (!owner || !repo || !GITHUB_TOKEN) return null;

  const dedupeKey = `dead-${gateKey}-${action}-${sourceEventId || jobId}`;

  await checkCircuitBreaker(adminApp, gateKey);

  const q = `repo:${owner}/${repo} label:dead-letter "${dedupeKey}" in:body type:issue`;
  const searchRes = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}`, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "Authorization": `Bearer ${GITHUB_TOKEN}`
    }
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.total_count > 0) {
      const existingIssue = searchData.items[0];
      return { issueUrl: existingIssue.html_url, issueNumber: existingIssue.number, skipped: true, reason: "이미 존재하는 dead-letter 이슈" };
    }
  }

  const title = `[ops][dead] ${gateKey} ${action}`;
  const body = `
### 자동화 작업 최종 실패 (Dead-letter)
- **GateKey**: ${gateKey}
- **Action**: \`${action}\`
- **Job ID**: ${jobId}
- **Source Event**: ${sourceEventId || "N/A"}
- **시도 횟수**: ${attempts}회

### Error Details
\`\`\`
${errorMessage}
\`\`\`

### 참고 링크
- [해결 가이드(플레이북)](https://github.com/aaron/agentregi/blob/main/spec/13-implementation/24-ops-audit-events.md)

<!-- dedupeKey: ${dedupeKey} -->
  `.trim();

  const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title,
      body,
      labels: ["ops", "dead-letter", "automation"]
    })
  });

  if (!ghRes.ok) {
    const errText = await ghRes.text();
    const errorMsg = `GitHub Issue 생성 실패: ${ghRes.status} ${errText}`;
    await recordCircuitBreakerFail(adminApp, gateKey, "UNKNOWN", errorMsg);
    throw new Error(errorMsg);
  }

  await recordCircuitBreakerSuccess(adminApp, gateKey);
  const ghData = await ghRes.json();
  const issueNodeId = ghData.node_id;

  let projectItemId = null;
  if (projectId) {
    const addMutation = `
      mutation {
        addProjectV2ItemById(input: {projectId: "${projectId}", contentId: "${issueNodeId}"}) {
          item { id }
        }
      }
    `;
    const addRes = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: addMutation })
    });
    if (addRes.ok) {
      const addData = await addRes.json();
      if (!addData.errors) {
        projectItemId = addData.data.addProjectV2ItemById.item.id;
      }
    }
  }

  return { issueUrl: ghData.html_url, issueNumber: ghData.number, projectItemId, skipped: false };
}

export async function createBacklogIssuesAction(
  adminApp: typeof admin,
  gateKey: string,
  targetDateStr: string,
  topN: number,
  dryRun: boolean = false
) {
  const ssotDocId = gateKey === "pilot-gate" ? targetDateStr : `${gateKey}:${targetDateStr}`;
  const logDocRef = adminApp.firestore().collection("ops_daily_logs").doc(ssotDocId);
  const logDoc = await logDocRef.get();
  if (!logDoc.exists) {
    throw new Error("먼저 SSOT 저장을 수행하세요.");
  }

  const configDoc = await adminApp.firestore().collection("ops_github_project_config").doc(gateKey).get();
  const config = configDoc.data() || {};
  const githubConfig = config.github || {};
  const rules = config.rules || {};
  
  const owner = githubConfig.owner || "beokadm-creator";
  const repo = githubConfig.repo || "agnet-eregi";
  const tokenRef = githubConfig.tokenRef || "GITHUB_TOKEN_BACKLOG_BOT";
  const GITHUB_TOKEN = process.env[tokenRef] || "";

  const logData = logDoc.data() as any;
  const topIssues = Array.isArray(logData.topIssues) ? logData.topIssues.slice(0, Number(topN)) : [];
  
  const created = [];
  const skipped = [];
  const failed = [];

  for (const issue of topIssues) {
    const dedupeKey = `${gateKey}:${targetDateStr}:${issue.slotId}`;
    const dedupeRef = adminApp.firestore().collection("ops_backlog_issues").doc(dedupeKey);
    
    try {
      if (!dryRun) {
        await dedupeRef.create({
          gateKey,
          date: targetDateStr,
          slotId: issue.slotId,
          severity: issue.severity,
          impactCount: issue.impactCount,
          status: "pending",
          createdAt: adminApp.firestore.FieldValue.serverTimestamp()
        });
      }
      
      const title = `[pilot-gate][${issue.severity}][${targetDateStr}] ${issue.slotId} 누락 대응`;
      const body = `
### 이슈 개요
- **발생일**: ${targetDateStr}
- **영향도**: ${issue.impactCount}건 발생
- **SSOT 문서**: \`ops_daily_logs/${ssotDocId}\`
- **Req ID**: ${logData.requestId || "N/A"}

### 재현 단계
1. 파트너 콘솔에서 ${issue.slotId} 업로드 누락 또는 API 오류 확인
2. ${issue.slotId} 제출 로직 디버깅

### Acceptance Criteria (AC)
1. ${issue.slotId} 파일이 정상적으로 Storage에 업로드됨
2. Gate 검증 API 호출 시 missing 배열에 ${issue.slotId}가 포함되지 않음
3. ok: true 달성
      `.trim();

      const baseLabels = rules.issueLabels || ["ops", "automation", "backlog"];
      const labels = [...baseLabels, issue.severity.toLowerCase()];
      
      let issueUrl = "dry-run-url";
      let issueNumber = 0;

      if (!dryRun) {
        if (!GITHUB_TOKEN) {
          throw new Error("GITHUB_TOKEN_BACKLOG_BOT is not configured.");
        }
        
        await checkCircuitBreaker(adminApp, gateKey);

        const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
          method: "POST",
          headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${GITHUB_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title,
            body,
            labels
          })
        });

        if (!ghRes.ok) {
          const errText = await ghRes.text();
          const errorMsg = `GitHub API Error: ${ghRes.status} ${errText}`;
          const { category } = categorizeError(errorMsg);
          await recordCircuitBreakerFail(adminApp, gateKey, category, errorMsg);
          throw new Error(errorMsg);
        }
        
        await recordCircuitBreakerSuccess(adminApp, gateKey);
        
        const ghData = await ghRes.json();
        issueUrl = ghData.html_url;
        issueNumber = ghData.number;
        
        await dedupeRef.update({
          issueNumber,
          issueUrl,
          updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
        });
      }
      
      created.push({ dedupeKey, issueUrl, issueNumber });
    } catch (e: any) {
      const isAlreadyExists = 
        e.code === 6 || 
        e.status === "ALREADY_EXISTS" ||
        (e.message && e.message.includes("ALREADY_EXISTS")) ||
        (e.details && e.details.includes("ALREADY_EXISTS"));
        
      if (isAlreadyExists) {
        skipped.push({ dedupeKey, reason: "ALREADY_EXISTS" });
      } else {
        console.error(`[backlog create error] dedupeKey=${dedupeKey}`, e);
        skipped.push({ dedupeKey, reason: e.message || "ERROR" });
        failed.push({ dedupeKey, reason: e.message || "ERROR" });
        if (!dryRun && !isAlreadyExists) {
           await dedupeRef.delete().catch((err) => {
             console.error("[OpsActions] dedupeRef 삭제 실패:", err instanceof Error ? err.message : String(err));
           });
        }
      }
    }
  }

  return { created, skipped, failed };
}

export async function addBacklogIssuesToProjectAction(
  adminApp: typeof admin,
  gateKey: string,
  targetDateStr: string,
  topN: number,
  dryRun: boolean = false
) {
  const snap = await adminApp.firestore()
    .collection("ops_backlog_issues")
    .where("gateKey", "==", gateKey)
    .where("date", "==", targetDateStr)
    .limit(Number(topN))
    .get();

  let issues: any[] = [];
  if (snap.empty) {
    const legacySnap = await adminApp.firestore()
      .collection("ops_backlog_issues")
      .where("date", "==", targetDateStr)
      .limit(Number(topN))
      .get();

    if (legacySnap.empty) {
      throw new Error("해당 날짜에 생성된 GitHub 이슈가 없습니다. (먼저 이슈를 생성하세요)");
    }
    
    const validDocs = legacySnap.docs.filter(d => d.id.startsWith(`${gateKey}:`));
    if (validDocs.length === 0) {
       throw new Error("해당 날짜에 생성된 GitHub 이슈가 없습니다. (먼저 이슈를 생성하세요)");
    }
    issues = validDocs.map(d => ({ dedupeKey: d.id, ...d.data() })) as any[];
  } else {
    issues = snap.docs.map(d => ({ dedupeKey: d.id, ...d.data() })) as any[];
  }

  const configDoc = await adminApp.firestore().collection("ops_github_project_config").doc(gateKey).get();
  if (!configDoc.exists) {
    throw new Error("Project 설정이 없습니다. 먼저 Discover API를 실행하세요.");
  }
  
  const config = configDoc.data() as any;
  const githubConfig = config.github || {};
  const { owner, repo, projectId, tokenRef } = githubConfig;
  
  const GITHUB_TOKEN = process.env[tokenRef || "GITHUB_TOKEN_BACKLOG_BOT"] || "";
  if (!owner || !repo || !projectId || !GITHUB_TOKEN) {
    throw new Error("GitHub 연동 설정이나 토큰이 누락되었습니다.");
  }
  
  await checkCircuitBreaker(adminApp, gateKey);

  const added = [];
  const skipped = [];
  const failed = [];

  for (const issue of issues) {
    if (!issue.issueNumber) {
      skipped.push({ projectDedupeKey: issue.dedupeKey + ":project", reason: "이슈 번호가 없습니다." });
      continue;
    }

    const projectDedupeKey = `${issue.dedupeKey}:project`;
    const linkRef = adminApp.firestore().collection("ops_backlog_issue_project_links").doc(projectDedupeKey);

    try {
      if (!dryRun) {
        await linkRef.create({
          date: targetDateStr,
          slotId: issue.slotId,
          issueUrl: issue.issueUrl || "",
          issueNumber: issue.issueNumber,
          status: "pending",
          createdAt: adminApp.firestore.FieldValue.serverTimestamp()
        });
      }

      let projectItemId = "dry-run-item-id";

      if (!dryRun) {
        const issueRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issue.issueNumber}`, {
          headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${GITHUB_TOKEN}`
          }
        });
        if (!issueRes.ok) {
          const errText = await issueRes.text();
          const errorMsg = `Issue fetch failed: ${issueRes.status} ${errText}`;
          const { category } = categorizeError(errorMsg);
          await recordCircuitBreakerFail(adminApp, gateKey, category, errorMsg);
          throw new Error(errorMsg);
        }
        await recordCircuitBreakerSuccess(adminApp, gateKey);
        const issueData = await issueRes.json();
        const issueNodeId = issueData.node_id;

        const addMutation = `
          mutation {
            addProjectV2ItemById(input: {projectId: "${projectId}", contentId: "${issueNodeId}"}) {
              item { id }
            }
          }
        `;
        
        const addRes = await fetch("https://api.github.com/graphql", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GITHUB_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ query: addMutation })
        });
        
        const addData = await addRes.json();
        if (addData.errors) {
           const errorMsg = `GraphQL Error (add): ${JSON.stringify(addData.errors)}`;
           await recordCircuitBreakerFail(adminApp, gateKey, "UNKNOWN", errorMsg);
           throw new Error(errorMsg);
        }
        await recordCircuitBreakerSuccess(adminApp, gateKey);
        
        projectItemId = addData.data.addProjectV2ItemById.item.id;

        const sevNum = parseInt(issue.severity.replace("Sev", ""), 10) || 3;
        const rules = config.rules || {};
        const sevToPriority = rules.sevToPriority || { "1": "p0", "2": "p1", "3": "p2" };
        const sevToStatus = rules.sevToStatus || { "1": "todo", "2": "todo", "3": "todo" };

        const priorityValue = sevToPriority[String(sevNum)] || "p2";
        const statusValue = sevToStatus[String(sevNum)] || "todo";

        const resolved = config.resolved || {};
        const STATUS_FIELD_ID = resolved.statusFieldId || "";
        const PRIORITY_FIELD_ID = resolved.priorityFieldId || "";
        const statusOptionId = resolved.statusOptionIds?.[statusValue];
        const priorityOptionId = resolved.priorityOptionIds?.[priorityValue];

        const missingForThisIssue = [];
        if (!STATUS_FIELD_ID) missingForThisIssue.push("statusFieldId");
        if (!statusOptionId) missingForThisIssue.push(`status.${statusValue}`);
        if (!PRIORITY_FIELD_ID) missingForThisIssue.push("priorityFieldId");
        if (!priorityOptionId) missingForThisIssue.push(`priority.${priorityValue}`);

        if (missingForThisIssue.length > 0) {
           throw new Error(`MISSING_MAPPING: ${missingForThisIssue.join(", ")}`);
        }

        if (STATUS_FIELD_ID && statusOptionId) {
          const updateStatusMutation = `
            mutation {
              updateProjectV2ItemFieldValue(
                input: {
                  projectId: "${projectId}"
                  itemId: "${projectItemId}"
                  fieldId: "${STATUS_FIELD_ID}"
                  value: { singleSelectOptionId: "${statusOptionId}" }
                }
              ) { projectV2Item { id } }
            }
          `;
          await fetch("https://api.github.com/graphql", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ query: updateStatusMutation })
          });
        }

        if (PRIORITY_FIELD_ID && priorityOptionId) {
          const updatePriorityMutation = `
            mutation {
              updateProjectV2ItemFieldValue(
                input: {
                  projectId: "${projectId}"
                  itemId: "${projectItemId}"
                  fieldId: "${PRIORITY_FIELD_ID}"
                  value: { singleSelectOptionId: "${priorityOptionId}" }
                }
              ) { projectV2Item { id } }
            }
          `;
          await fetch("https://api.github.com/graphql", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ query: updatePriorityMutation })
          });
        }

        await linkRef.update({
          projectItemId,
          status: "added",
          updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
        });
      }

      added.push({ projectDedupeKey, projectItemId, issueUrl: issue.issueUrl });
    } catch (e: any) {
      const isAlreadyExists = 
        e.code === 6 || 
        e.status === "ALREADY_EXISTS" ||
        (e.message && e.message.includes("ALREADY_EXISTS")) ||
        (e.details && e.details.includes("ALREADY_EXISTS"));
        
      if (isAlreadyExists) {
        skipped.push({ projectDedupeKey, reason: "ALREADY_EXISTS" });
      } else {
        console.error(`[project add error] key=${projectDedupeKey}`, e);
        let reason = e.message || "ERROR";
        let missing = [];
        let hint = "";
        
        if (reason.startsWith("MISSING_MAPPING: ")) {
          missing = reason.replace("MISSING_MAPPING: ", "").split(", ");
          reason = "MISSING_MAPPING";
          hint = "discover를 다시 실행하거나 alias를 추가하세요";
        }

        failed.push({ projectDedupeKey, reason, missing, hint, issueUrl: issue.issueUrl });
        if (!dryRun && !isAlreadyExists) {
           await linkRef.delete().catch((err) => {
             console.error("[OpsActions] linkRef 삭제 실패:", err instanceof Error ? err.message : String(err));
           });
        }
      }
    }
  }

  return { added, skipped, failed };
}
