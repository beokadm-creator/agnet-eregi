"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doResolve = doResolve;
exports.doResolveAction = doResolveAction;
exports.discoverProjectConfigAction = discoverProjectConfigAction;
exports.generateMonthlyReportAction = generateMonthlyReportAction;
exports.dispatchWorkflowAction = dispatchWorkflowAction;
exports.createDeadLetterIssueAction = createDeadLetterIssueAction;
const ops_circuit_breaker_1 = require("./ops_circuit_breaker");
function doResolve(rawFields, customAliases) {
    var _a;
    const norm = (s) => s.toLowerCase().replace(/[\s\-_]/g, "");
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
            if (Array.isArray(v) && fieldAliases[k]) {
                fieldAliases[k].push(...v);
            }
        }
    }
    if (customAliases.optionAliases) {
        for (const [k, v] of Object.entries(customAliases.optionAliases)) {
            if (Array.isArray(v) && optionAliases[k]) {
                optionAliases[k].push(...v);
            }
        }
    }
    const resolved = {};
    const missingMappings = [];
    for (const [fKey, fAliases] of Object.entries(fieldAliases)) {
        const normAliases = fAliases.map(norm);
        const node = rawFields.find((n) => n.name && normAliases.includes(norm(n.name)));
        if (node) {
            resolved[`${fKey}FieldId`] = node.id;
            resolved[`${fKey}OptionIds`] = {};
            const optPrefix = `${fKey}.`;
            for (const [oKey, oAliases] of Object.entries(optionAliases)) {
                if (!oKey.startsWith(optPrefix))
                    continue;
                const shortOKey = oKey.replace(optPrefix, "");
                const normOAliases = oAliases.map(norm);
                const optNode = (_a = node.options) === null || _a === void 0 ? void 0 : _a.find((o) => o.name && normOAliases.includes(norm(o.name)));
                if (optNode) {
                    resolved[`${fKey}OptionIds`][shortOKey] = optNode.id;
                }
                else {
                    missingMappings.push(oKey);
                }
            }
        }
        else {
            missingMappings.push(`${fKey}FieldId`);
        }
    }
    return { resolved, missingMappings };
}
async function doResolveAction(adminApp, gateKey, uid = "system") {
    const docRef = adminApp.firestore().collection("ops_github_project_config").doc(gateKey);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        throw new Error("Project 설정이 없습니다. 먼저 Discover API를 실행하세요.");
    }
    const config = docSnap.data();
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
async function discoverProjectConfigAction(adminApp, gateKey, reqProjectId, uid = "system") {
    const configDoc = await adminApp.firestore().collection("ops_github_project_config").doc(gateKey).get();
    const existingConfig = configDoc.exists ? configDoc.data() : {};
    const githubConfig = (existingConfig === null || existingConfig === void 0 ? void 0 : existingConfig.github) || {};
    const projectId = reqProjectId || githubConfig.projectId || process.env.GITHUB_PROJECT_ID;
    const tokenRef = githubConfig.tokenRef || "GITHUB_TOKEN_BACKLOG_BOT";
    const GITHUB_TOKEN = process.env[tokenRef] || "";
    if (!projectId || !GITHUB_TOKEN) {
        throw new Error(`Project ID 또는 토큰이 누락되었습니다. (tokenRef: ${tokenRef})`);
    }
    await (0, ops_circuit_breaker_1.checkCircuitBreaker)(adminApp, gateKey);
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
        await (0, ops_circuit_breaker_1.recordCircuitBreakerFail)(adminApp, gateKey, "UNKNOWN", errorMsg);
        throw new Error(errorMsg);
    }
    await (0, ops_circuit_breaker_1.recordCircuitBreakerSuccess)(adminApp, gateKey);
    const nodes = ghData.data.node.fields.nodes;
    const customAliases = (existingConfig === null || existingConfig === void 0 ? void 0 : existingConfig.customAliases) || {};
    const { resolved, missingMappings } = doResolve(nodes, customAliases);
    const configData = {
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
async function generateMonthlyReportAction(adminApp, gateKey, month, dryRun = false) {
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
    const topSlotsMap = {};
    const daily = [];
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
    return Object.assign(Object.assign({}, reportData), { dryRun });
}
async function dispatchWorkflowAction(adminApp, gateKey, month, gateKeyOverride) {
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
    await (0, ops_circuit_breaker_1.checkCircuitBreaker)(adminApp, gateKey);
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
        await (0, ops_circuit_breaker_1.recordCircuitBreakerFail)(adminApp, gateKey, "UNKNOWN", errorMsg); // 정확한 카테고리는 audit 단에서 처리되거나, 여기서 임시로 넘김
        throw new Error(errorMsg);
    }
    await (0, ops_circuit_breaker_1.recordCircuitBreakerSuccess)(adminApp, gateKey);
    return { dispatched: true, gateKey: finalGateKey, month };
}
async function createDeadLetterIssueAction(adminApp, gateKey, action, errorMessage, attempts, jobId, sourceEventId) {
    const configDoc = await adminApp.firestore().collection("ops_github_project_config").doc(gateKey).get();
    if (!configDoc.exists)
        return null;
    const config = configDoc.data() || {};
    const githubConfig = config.github || {};
    const owner = githubConfig.owner || "beokadm-creator";
    const repo = githubConfig.repo || "agnet-eregi";
    const tokenRef = githubConfig.tokenRef || "GITHUB_TOKEN_BACKLOG_BOT";
    const projectId = githubConfig.projectId;
    const GITHUB_TOKEN = process.env[tokenRef] || "";
    if (!owner || !repo || !GITHUB_TOKEN)
        return null;
    const dedupeKey = `dead-${gateKey}-${action}-${sourceEventId || jobId}`;
    await (0, ops_circuit_breaker_1.checkCircuitBreaker)(adminApp, gateKey);
    // 1. 중복 확인 (Search Issues)
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
        await (0, ops_circuit_breaker_1.recordCircuitBreakerFail)(adminApp, gateKey, "UNKNOWN", errorMsg);
        throw new Error(errorMsg);
    }
    await (0, ops_circuit_breaker_1.recordCircuitBreakerSuccess)(adminApp, gateKey);
    const ghData = await ghRes.json();
    const issueNodeId = ghData.node_id;
    // 프로젝트 보드 자동 투입 (옵션)
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
//# sourceMappingURL=ops_actions.js.map