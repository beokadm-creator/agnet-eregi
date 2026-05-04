import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import admin from "firebase-admin";

export const ENVIRONMENTS = {
  staging: { projectId: "agentregi-d77a3" },
  prod: { projectId: "agent-eregi" },
};

const CONFIG_PATH = path.resolve(process.cwd(), "scripts/ops_admin_claims.config.json");

function normalizeDeclaredAdmin(entry) {
  return {
    email: String(entry?.email || "").trim().toLowerCase(),
    opsRole: String(entry?.opsRole || "").trim(),
    isSuperAdmin: entry?.isSuperAdmin === true,
  };
}

export function loadDeclaredOpsAdmins() {
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  const normalized = {};
  for (const envName of Object.keys(ENVIRONMENTS)) {
    normalized[envName] = Array.isArray(raw?.[envName])
      ? raw[envName].map(normalizeDeclaredAdmin).filter((entry) => entry.email && entry.opsRole)
      : [];
  }
  return normalized;
}

export function getProjectIdForEnv(envName) {
  const config = ENVIRONMENTS[envName];
  if (!config) throw new Error(`Unknown environment: ${envName}`);
  return config.projectId;
}

export function getDeclaredAdminsForEnv(envName) {
  const config = loadDeclaredOpsAdmins();
  return config[envName] || [];
}

async function withAdminApp(projectId, handler) {
  const appName = `ops-admin-${projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const app = admin.initializeApp({ projectId }, appName);
  try {
    return await handler(app);
  } finally {
    await app.delete();
  }
}

export async function inspectOpsAdminClaims(envName) {
  const projectId = getProjectIdForEnv(envName);
  const declaredAdmins = getDeclaredAdminsForEnv(envName);

  return withAdminApp(projectId, async (app) => {
    const checks = [];
    for (const declared of declaredAdmins) {
      try {
        const user = await app.auth().getUserByEmail(declared.email);
        const claims = user.customClaims || {};
        const actualRole = claims.opsRole ? String(claims.opsRole) : "";
        const actualSuperAdmin = claims.isSuperAdmin === true;
        checks.push({
          email: declared.email,
          uid: user.uid,
          expectedRole: declared.opsRole,
          actualRole,
          expectedSuperAdmin: declared.isSuperAdmin,
          actualSuperAdmin,
          ok: actualRole === declared.opsRole && actualSuperAdmin === declared.isSuperAdmin,
          exists: true,
        });
      } catch (error) {
        checks.push({
          email: declared.email,
          expectedRole: declared.opsRole,
          actualRole: "",
          expectedSuperAdmin: declared.isSuperAdmin,
          actualSuperAdmin: false,
          ok: false,
          exists: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      envName,
      projectId,
      declaredAdmins,
      checks,
      failures: checks.filter((item) => !item.ok),
    };
  });
}

export async function syncOpsAdminClaims(envName, options = {}) {
  const apply = options.apply === true;
  const projectId = getProjectIdForEnv(envName);
  const declaredAdmins = getDeclaredAdminsForEnv(envName);

  return withAdminApp(projectId, async (app) => {
    const results = [];
    for (const declared of declaredAdmins) {
      try {
        const user = await app.auth().getUserByEmail(declared.email);
        const currentClaims = user.customClaims || {};
        const desiredClaims = {
          ...currentClaims,
          opsRole: declared.opsRole,
        };
        if (declared.isSuperAdmin) {
          desiredClaims.isSuperAdmin = true;
        } else {
          delete desiredClaims.isSuperAdmin;
        }

        const currentRole = currentClaims.opsRole ? String(currentClaims.opsRole) : "";
        const currentSuperAdmin = currentClaims.isSuperAdmin === true;
        const needsUpdate = currentRole !== declared.opsRole || currentSuperAdmin !== declared.isSuperAdmin;

        if (apply && needsUpdate) {
          await app.auth().setCustomUserClaims(user.uid, desiredClaims);
        }

        results.push({
          email: declared.email,
          uid: user.uid,
          changed: needsUpdate,
          applied: apply && needsUpdate,
          expectedRole: declared.opsRole,
          actualRoleBefore: currentRole,
          expectedSuperAdmin: declared.isSuperAdmin,
          actualSuperAdminBefore: currentSuperAdmin,
        });
      } catch (error) {
        results.push({
          email: declared.email,
          changed: false,
          applied: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      envName,
      projectId,
      apply,
      results,
      failures: results.filter((item) => item.error),
    };
  });
}
