import { requireOpsRole } from "../../lib/ops_rbac";
import * as express from "express";
import type * as admin from "firebase-admin";

import { requireAuth } from "../../lib/auth";
import { fail, logError, ok } from "../../lib/http";

function formatKstYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
}

function toISO(v: any): string {
  if (!v) return "";
  try {
    const d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
    return d.toISOString();
  } catch {
    return "";
  }
}

export function registerOpsBusinessRoutes(app: express.Express, adminApp: typeof admin) {
  app.get("/v1/ops/business/summary", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_viewer");
    if (!hasRole) return;

    try {
      const db = adminApp.firestore();
      const now = new Date();
      const todayStr = formatKstYmd(now);
      const startOfToday = new Date(todayStr + "T00:00:00+09:00");
      const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startOfMonthStr = todayStr.slice(0, 8) + "01";
      const startOfMonth = new Date(startOfMonthStr + "T00:00:00+09:00");

      const lastMonthStartStr = formatKstYmd(new Date(startOfMonth.getTime() - 24 * 60 * 60 * 1000)).slice(0, 8) + "01";
      const lastMonthStart = new Date(lastMonthStartStr + "T00:00:00+09:00");

      const tsMonth = adminApp.firestore.Timestamp.fromDate(startOfMonth);

      const [
        casesSnap,
        partnersSnap,
        activePartnersSnap,
        paymentsSnap,
        funnelMonthSnap,
        funnelCompletedSnap,
      ] = await Promise.all([
        db.collection("cases").orderBy("createdAt", "desc").limit(500).get(),
        db.collection("partners").count().get(),
        db.collection("partners").where("status", "==", "active").count().get(),
        db.collection("payments").orderBy("createdAt", "desc").limit(500).get(),
        db.collection("funnel_sessions").where("createdAt", ">=", tsMonth).count().get(),
        db.collection("funnel_sessions").where("createdAt", ">=", tsMonth).where("status", "==", "completed").count().get(),
      ]);

      const casesAll: Record<string, any>[] = casesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const byStatus: Record<string, number> = {};
      let today = 0;
      let thisWeek = 0;
      let thisMonth = 0;

      for (const c of casesAll) {
        const status = (c.status as string) || "unknown";
        byStatus[status] = (byStatus[status] || 0) + 1;

        const created: admin.firestore.Timestamp = c.createdAt as admin.firestore.Timestamp;
        if (created && created.toDate) {
          const cd = created.toDate();
          if (cd >= startOfToday) today++;
          if (cd >= startOfWeek) thisWeek++;
          if (cd >= startOfMonth) thisMonth++;
        }
      }

      const recentCases = casesAll.slice(0, 10).map((c) => ({
        id: c.id,
        title: c.title || "",
        status: c.status || "",
        partnerId: c.partnerId || "",
        createdAt: toISO(c.createdAt),
      }));

      const totalPartners = partnersSnap.data().count as number;
      const activePartners = activePartnersSnap.data().count as number;

      const paymentsAll: Record<string, any>[] = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      let totalRevenue = 0;
      let thisMonthRevenue = 0;
      let lastMonthRevenue = 0;

      for (const p of paymentsAll) {
        const st = (p.status as string) || "";
        if (st !== "succeeded" && st !== "completed") continue;

        const amount = Number(p.amount) || 0;
        totalRevenue += amount;

        const created: admin.firestore.Timestamp = p.createdAt as admin.firestore.Timestamp;
        if (created && created.toDate) {
          const cd = created.toDate();
          if (cd >= startOfMonth) thisMonthRevenue += amount;
          if (cd >= lastMonthStart && cd < startOfMonth) lastMonthRevenue += amount;
        }
      }

      const recentPayments = paymentsAll.slice(0, 10).map((p) => ({
        id: p.id,
        amount: p.amount || 0,
        currency: p.currency || "",
        status: p.status || "",
        provider: p.provider || "",
        createdAt: toISO(p.createdAt),
      }));

      const sessionsThisMonth = funnelMonthSnap.data().count as number;
      const completedThisMonth = funnelCompletedSnap.data().count as number;
      const conversionRate = sessionsThisMonth > 0 ? completedThisMonth / sessionsThisMonth : 0;

      return ok(res, {
        cases: {
          total: casesAll.length,
          today,
          thisWeek,
          thisMonth,
          byStatus,
          recent: recentCases,
        },
        partners: {
          total: totalPartners,
          active: activePartners,
        },
        payments: {
          totalRevenue,
          thisMonthRevenue,
          lastMonthRevenue,
          recent: recentPayments,
        },
        funnel: {
          sessionsThisMonth,
          completedThisMonth,
          conversionRate,
        },
      });
    } catch (err) {
      logError("GET /v1/ops/business/summary", "", "INTERNAL", "비즈니스 요약 조회 중 오류가 발생했습니다.", err);
      return fail(res, 500, "INTERNAL", "비즈니스 요약 조회 중 오류가 발생했습니다.");
    }
  });
}
