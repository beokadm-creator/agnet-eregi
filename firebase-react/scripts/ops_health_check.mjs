#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

import { inspectOpsAdminClaims } from "./lib/ops_admin_claims.mjs";

const REGION = "asia-northeast3";
const ARTIFACT_REPOSITORY = "gcf-artifacts";
const EXPECTED_RUNTIME = "nodejs22";
const ENVIRONMENTS = {
  staging: {
    projectId: "agentregi-d77a3",
  },
  prod: {
    projectId: "agent-eregi",
  },
};

function parseArgs(argv) {
  const args = {
    env: "all",
    freshness: process.env.OPS_HEALTH_FRESHNESS || "72h",
    logLimit: Number(process.env.OPS_HEALTH_LOG_LIMIT || 20),
  };

  for (const arg of argv) {
    if (arg === "staging" || arg === "prod" || arg === "all") {
      args.env = arg;
      continue;
    }

    if (arg.startsWith("--env=")) {
      args.env = arg.slice("--env=".length);
      continue;
    }

    if (arg.startsWith("--freshness=")) {
      args.freshness = arg.slice("--freshness=".length);
      continue;
    }

    if (arg.startsWith("--log-limit=")) {
      args.logLimit = Number(arg.slice("--log-limit=".length));
      continue;
    }
  }

  if (!["staging", "prod", "all"].includes(args.env)) {
    throw new Error(`Unsupported env: ${args.env}`);
  }

  if (!Number.isInteger(args.logLimit) || args.logLimit < 1) {
    throw new Error(`Invalid --log-limit value: ${args.logLimit}`);
  }

  return args;
}

function runJsonCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const message = [
      `${command} ${args.join(" ")}`,
      result.stderr?.trim(),
      result.stdout?.trim(),
    ]
      .filter(Boolean)
      .join("\n");
    throw new Error(message);
  }

  const stdout = result.stdout.trim();
  return stdout ? JSON.parse(stdout) : [];
}

async function runEnvironmentHealth(envName, options) {
  const envConfig = ENVIRONMENTS[envName];
  if (!envConfig) {
    throw new Error(`Unknown environment: ${envName}`);
  }

  const query = [
    'resource.type="cloud_function"',
    `resource.labels.region="${REGION}"`,
    "severity>=WARNING",
    'NOT logName:"cloudaudit.googleapis.com"',
  ].join(" AND ");

  const logs = runJsonCommand("gcloud", [
    "logging",
    "read",
    query,
    `--project=${envConfig.projectId}`,
    `--limit=${options.logLimit}`,
    `--freshness=${options.freshness}`,
    "--format=json",
  ]);

  const functions = runJsonCommand("gcloud", [
    "functions",
    "list",
    `--regions=${REGION}`,
    `--project=${envConfig.projectId}`,
    "--format=json",
  ]);

  const artifacts = runJsonCommand("gcloud", [
    "artifacts",
    "packages",
    "list",
    `--project=${envConfig.projectId}`,
    `--location=${REGION}`,
    `--repository=${ARTIFACT_REPOSITORY}`,
    "--format=json",
  ]);

  const claimsAudit = await inspectOpsAdminClaims(envName);

  return {
    envName,
    projectId: envConfig.projectId,
    logs,
    functions,
    artifacts,
    claimsAudit,
  };
}

function getLogMessage(entry) {
  const textPayload = typeof entry.textPayload === "string" ? entry.textPayload.trim() : "";
  if (textPayload) {
    return textPayload;
  }

  const jsonMessage = typeof entry.jsonPayload?.message === "string"
    ? entry.jsonPayload.message.trim()
    : "";
  if (jsonMessage) {
    return jsonMessage;
  }

  const protoMessage = typeof entry.protoPayload?.status?.message === "string"
    ? entry.protoPayload.status.message.trim()
    : "";
  if (protoMessage) {
    return protoMessage;
  }

  return "(no message)";
}

function getFunctionName(entry) {
  return entry.resource?.labels?.function_name || entry.labels?.function_name || "-";
}

function printLogs(logs) {
  if (logs.length === 0) {
    console.log("- Runtime logs: clean (no WARNING/ERROR in window)");
    return;
  }

  console.log(`- Runtime logs: ${logs.length} warning/error entries`);
  for (const entry of logs.slice(0, 5)) {
    const timestamp = entry.timestamp || "-";
    const severity = entry.severity || "-";
    const functionName = getFunctionName(entry);
    const message = getLogMessage(entry).replace(/\s+/g, " ").slice(0, 180);
    console.log(`  - ${timestamp} | ${functionName} | ${severity} | ${message}`);
  }
}

function printFunctions(functions) {
  const nonActive = functions.filter((fn) => fn.status !== "ACTIVE");
  const runtimeMismatch = functions.filter((fn) => fn.runtime !== EXPECTED_RUNTIME);

  console.log(`- Functions: total=${functions.length}, nonActive=${nonActive.length}, runtimeMismatch=${runtimeMismatch.length}`);

  if (nonActive.length > 0) {
    for (const fn of nonActive.slice(0, 5)) {
      console.log(`  - ${fn.name} | status=${fn.status} | runtime=${fn.runtime || "-"}`);
    }
  }

  if (runtimeMismatch.length > 0) {
    for (const fn of runtimeMismatch.slice(0, 5)) {
      console.log(`  - runtime mismatch: ${fn.name} | runtime=${fn.runtime || "-"}`);
    }
  }
}

function printArtifacts(artifacts) {
  console.log(`- Artifacts: packages=${artifacts.length}`);

  if (artifacts.length > 0) {
    for (const pkg of artifacts.slice(0, 5)) {
      const createTime = pkg.createTime || "-";
      const updateTime = pkg.updateTime || "-";
      console.log(`  - ${pkg.name} | created=${createTime} | updated=${updateTime}`);
    }
  }
}

function printClaimsAudit(claimsAudit) {
  const failures = claimsAudit.failures || [];
  console.log(`- Ops admin claims: expected=${claimsAudit.checks.length}, failures=${failures.length}`);
  for (const item of claimsAudit.checks.slice(0, 10)) {
    const status = item.ok ? "ok" : "mismatch";
    const actualRole = item.actualRole || "none";
    const expectedRole = item.expectedRole || "none";
    console.log(`  - ${item.email} | actual=${actualRole} | expected=${expectedRole} | status=${status}`);
  }
}

function printSummary(result) {
  console.log("");
  console.log(`=== ${result.envName.toUpperCase()} (${result.projectId}) ===`);
  printLogs(result.logs);
  printFunctions(result.functions);
  printArtifacts(result.artifacts);
  printClaimsAudit(result.claimsAudit);
}

function printFailure(envName, error) {
  console.log("");
  console.log(`=== ${envName.toUpperCase()} ===`);
  console.log("- Health check failed");
  console.log(`  - ${error.message}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const envNames = options.env === "all" ? Object.keys(ENVIRONMENTS) : [options.env];
  let hasFailure = false;

  console.log("[ops_health_check] Starting");
  console.log(`[ops_health_check] freshness=${options.freshness} logLimit=${options.logLimit} env=${options.env}`);

  for (const envName of envNames) {
    try {
      const result = await runEnvironmentHealth(envName, options);
      printSummary(result);
      if ((result.claimsAudit?.failures || []).length > 0) {
        hasFailure = true;
      }
    } catch (error) {
      hasFailure = true;
      printFailure(envName, error);
    }
  }

  if (hasFailure) {
    process.exit(1);
  }
}

main();
