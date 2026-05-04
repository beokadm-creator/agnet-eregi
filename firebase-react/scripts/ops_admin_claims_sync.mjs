#!/usr/bin/env node

import process from "node:process";

import {
  ENVIRONMENTS,
  inspectOpsAdminClaims,
  syncOpsAdminClaims,
} from "./lib/ops_admin_claims.mjs";

function parseArgs(argv) {
  const args = {
    env: "all",
    apply: false,
  };

  for (const arg of argv) {
    if (arg === "staging" || arg === "prod" || arg === "all") {
      args.env = arg;
      continue;
    }
    if (arg === "--apply") {
      args.apply = true;
      continue;
    }
    if (arg.startsWith("--env=")) {
      args.env = arg.slice("--env=".length);
    }
  }

  if (!["staging", "prod", "all"].includes(args.env)) {
    throw new Error(`Unsupported env: ${args.env}`);
  }

  return args;
}

function printSyncSummary(result) {
  console.log("");
  console.log(`=== ${result.envName.toUpperCase()} (${result.projectId}) ===`);
  for (const item of result.results) {
    if (item.error) {
      console.log(`- ${item.email} | error=${item.error}`);
      continue;
    }
    console.log(
      `- ${item.email} | before=${item.actualRoleBefore || "none"} | target=${item.expectedRole} | changed=${item.changed} | applied=${item.applied}`
    );
  }
}

function printInspectSummary(result) {
  console.log("");
  console.log(`=== ${result.envName.toUpperCase()} (${result.projectId}) ===`);
  for (const item of result.checks) {
    if (!item.exists) {
      console.log(`- ${item.email} | missing user | error=${item.error}`);
      continue;
    }
    console.log(
      `- ${item.email} | actual=${item.actualRole || "none"} | expected=${item.expectedRole} | ok=${item.ok}`
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const envNames = options.env === "all" ? Object.keys(ENVIRONMENTS) : [options.env];
  let hasFailure = false;

  console.log(`[ops_admin_claims_sync] env=${options.env} apply=${options.apply}`);

  for (const envName of envNames) {
    try {
      if (options.apply) {
        const syncResult = await syncOpsAdminClaims(envName, { apply: true });
        printSyncSummary(syncResult);
        const inspectResult = await inspectOpsAdminClaims(envName);
        printInspectSummary(inspectResult);
        if (inspectResult.failures.length > 0 || syncResult.failures.length > 0) {
          hasFailure = true;
        }
      } else {
        const inspectResult = await inspectOpsAdminClaims(envName);
        printInspectSummary(inspectResult);
        if (inspectResult.failures.length > 0) {
          hasFailure = true;
        }
      }
    } catch (error) {
      hasFailure = true;
      console.log("");
      console.log(`=== ${envName.toUpperCase()} ===`);
      console.log(`- Failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (hasFailure) {
    process.exit(1);
  }
}

main();
