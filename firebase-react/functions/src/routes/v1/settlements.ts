import type express from "express";
import type * as admin from "firebase-admin";
import crypto from "node:crypto";

import { requireAuth, requireOps, partnerIdOf, roleOf } from "../../lib/auth";
import { fail, ok } from "../../lib/http";
import { withIdempotency } from "../../lib/idempotency";
import { isAllowedSettlementTransition, type SettlementStatus } from "../../lib/settlement_status";
import { executePayout } from "../../lib/payout";

function settlementRef(adminApp: typeof admin, settlementId: string) {
  return adminApp.firestore().doc(`settlements/${settlementId}`);
}

function settlementItemRef(adminApp: typeof admin, settlementId: string, itemId: string) {
  return adminApp.firestore().doc(`settlements/${settlementId}/items/${itemId}`);
}

function settlementPayoutRef(adminApp: typeof admin, settlementId: string, payoutId: string) {
  return adminApp.firestore().doc(`settlements/${settlementId}/payouts/${payoutId}`);
}

function receivableRef(adminApp: typeof admin, partnerId: string, rid: string) {
  return adminApp.firestore().doc(`partners/${partnerId}/receivables/${rid}`);
}

function receivableOffsetRef(adminApp: typeof admin, partnerId: string, rid: string, offsetId: string) {
  return adminApp.firestore().doc(`partners/${partnerId}/receivables/${rid}/offsets/${offsetId}`);
}

function payablesSummaryRef(adminApp: typeof admin, partnerId: string) {
  return adminApp.firestore().doc(`partners/${partnerId}/payables/summary`);
}

function parseDay(s: string) {
  // "YYYY-MM-DD"를 UTC day range로 사용
  const [y, m, d] = s.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0));
}

export function registerSettlementRoutes(app: express.Express, adminApp: typeof admin) {
  const MIN_PAYOUT_AMOUNT = Number(process.env.MIN_PAYOUT_AMOUNT ?? 10000); // 1만원 미만은 이월(기본)
  const MAX_OFFSET_RATIO = Number(process.env.MAX_OFFSET_RATIO ?? 1.0); // 1.0=100%까지 상계 허용(기본)

  // Partner: 정산 목록
  app.get("/v1/partner/settlements", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    const pid = partnerIdOf(auth);
    if (!pid) return fail(res, 403, "FORBIDDEN", "파트너 계정이 아닙니다.");

    const snap = await adminApp
      .firestore()
      .collection("settlements")
      .where("partnerId", "==", pid)
      .orderBy("period.from", "desc")
      .limit(50)
      .get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  // Partner/Ops: 정산 아이템(대사) 조회
  app.get("/v1/partner/settlements/:settlementId/items", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    const pid = partnerIdOf(auth);
    if (!pid) return fail(res, 403, "FORBIDDEN", "파트너 계정이 아닙니다.");

    const settlementId = req.params.settlementId;
    const sSnap = await settlementRef(adminApp, settlementId).get();
    if (!sSnap.exists) return fail(res, 404, "NOT_FOUND", "정산을 찾을 수 없습니다.");
    const s = sSnap.data() as any;
    if (s.partnerId !== pid) return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    const snap = await adminApp.firestore().collection(`settlements/${settlementId}/items`).orderBy("createdAt", "asc").limit(200).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  // Partner: 지급 시도 목록(대사)
  app.get("/v1/partner/settlements/:settlementId/payouts", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    const pid = partnerIdOf(auth);
    if (!pid) return fail(res, 403, "FORBIDDEN", "파트너 계정이 아닙니다.");

    const settlementId = req.params.settlementId;
    const sSnap = await settlementRef(adminApp, settlementId).get();
    if (!sSnap.exists) return fail(res, 404, "NOT_FOUND", "정산을 찾을 수 없습니다.");
    const s = sSnap.data() as any;
    if (s.partnerId !== pid) return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");

    const snap = await adminApp.firestore().collection(`settlements/${settlementId}/payouts`).orderBy("createdAt", "desc").limit(50).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  // Partner: 미수금 목록
  app.get("/v1/partner/receivables", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    const pid = partnerIdOf(auth);
    if (!pid) return fail(res, 403, "FORBIDDEN", "파트너 계정이 아닙니다.");

    const status = String(req.query.status || "open");
    const snap = await adminApp
      .firestore()
      .collection(`partners/${pid}/receivables`)
      .where("status", "==", status)
      .orderBy("createdAt", "asc")
      .limit(50)
      .get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  // Partner: 특정 미수금 상계 내역(감사)
  app.get("/v1/partner/receivables/:receivableId/offsets", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    const pid = partnerIdOf(auth);
    if (!pid) return fail(res, 403, "FORBIDDEN", "파트너 계정이 아닙니다.");

    const rid = req.params.receivableId;
    const rSnap = await receivableRef(adminApp, pid, rid).get();
    if (!rSnap.exists) return fail(res, 404, "NOT_FOUND", "미수금을 찾을 수 없습니다.");

    const snap = await adminApp
      .firestore()
      .collection(`partners/${pid}/receivables/${rid}/offsets`)
      .orderBy("createdAt", "asc")
      .limit(200)
      .get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  // Ops: 정산 목록
  app.get("/v1/ops/settlements", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    if (!requireOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자 권한이 없습니다.");

    const status = req.query.status ? String(req.query.status) : null;
    let q: admin.firestore.Query = adminApp.firestore().collection("settlements");
    if (status) q = q.where("status", "==", status);
    q = q.orderBy("period.from", "desc").limit(50);
    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  // Ops: 정산 아이템(대사) 조회
  app.get("/v1/ops/settlements/:settlementId/items", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    if (!requireOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자 권한이 없습니다.");

    const settlementId = req.params.settlementId;
    const snap = await adminApp.firestore().collection(`settlements/${settlementId}/items`).orderBy("createdAt", "asc").limit(500).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  // Ops: 지급 시도 목록(대사)
  app.get("/v1/ops/settlements/:settlementId/payouts", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    if (!requireOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자 권한이 없습니다.");

    const settlementId = req.params.settlementId;
    const snap = await adminApp.firestore().collection(`settlements/${settlementId}/payouts`).orderBy("createdAt", "desc").limit(100).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return ok(res, { items });
  });

  // Ops: 정산 생성(단순형) — partnerId + 기간을 받아 settlement를 생성
  app.post("/v1/ops/settlements/generate", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    if (!requireOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자 권한이 없습니다.");

    const { partnerId, periodFrom, periodTo } = req.body ?? {};
    if (!partnerId || !periodFrom || !periodTo) return fail(res, 400, "INVALID_ARGUMENT", "partnerId/periodFrom/periodTo가 필요합니다.");

    const result = await withIdempotency(adminApp, req, res, "settlements.generate", async () => {
      const settlementId = crypto.randomUUID();
      const now = adminApp.firestore.FieldValue.serverTimestamp();

      const from = String(periodFrom);
      const to = String(periodTo);
      const fromDate = parseDay(from);
      const toDateExclusive = new Date(parseDay(to).getTime() + 24 * 60 * 60 * 1000);

      // 1) 기간 내 captured 결제 합산(파트너 기준)
      const paymentSnap = await adminApp
        .firestore()
        .collectionGroup("payments")
        .where("partnerId", "==", String(partnerId))
        .where("status", "==", "captured")
        .where("capturedAt", ">=", fromDate)
        .where("capturedAt", "<", toDateExclusive)
        .get();
      const payments = paymentSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const currency = payments[0]?.amount?.currency ?? "KRW";
      const gross = payments.reduce((sum, p) => sum + Number(p.amount?.amount ?? 0), 0);

      // 2) 기간 내 executed 환불 합산(파트너 기준)
      const refundSnap = await adminApp
        .firestore()
        .collectionGroup("refunds")
        .where("partnerId", "==", String(partnerId))
        .where("status", "==", "executed")
        .where("executedAt", ">=", fromDate)
        .where("executedAt", "<", toDateExclusive)
        .get();
      const refunds = refundSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const refundsTotal = refunds.reduce((sum, r) => sum + Number(r.amount?.amount ?? 0), 0);

      const net = Math.max(0, gross - refundsTotal);

      // 2.5) 이월(carryOver) 누적: 이전 이월을 현재 net에 합산해 지급 판단
      const carrySnap = await payablesSummaryRef(adminApp, String(partnerId)).get();
      const carryOverPrev = Number((carrySnap.exists ? (carrySnap.data() as any).carryOverAmount?.amount : 0) ?? 0);
      const netWithCarry = net + carryOverPrev;

      // 3) 미수금 상계(가드레일 최소형)
      const recSnap = await adminApp
        .firestore()
        .collection(`partners/${String(partnerId)}/receivables`)
        .where("status", "==", "open")
        .orderBy("createdAt", "asc")
        .limit(50)
        .get();
      const receivables = recSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      // 상계 한도(가드레일): net * MAX_OFFSET_RATIO
      const maxOffset = Math.floor(netWithCarry * MAX_OFFSET_RATIO);
      let remaining = netWithCarry;
      let offsetTotal = 0;
      const offsets: any[] = [];
      for (const r of receivables) {
        if (remaining <= 0) break;
        if (offsetTotal >= maxOffset) break;
        const amt = Number(r.openAmount ?? r.amount?.amount ?? 0);
        const availableForOffset = Math.max(0, maxOffset - offsetTotal);
        const applied = Math.min(remaining, amt, availableForOffset);
        if (applied <= 0) continue;
        remaining -= applied;
        offsetTotal += applied;
        offsets.push({ receivableId: r.id, appliedAmount: applied });
      }
      // 최소 지급(가드레일): MIN_PAYOUT_AMOUNT 미만이면 이월
      const payout = remaining >= MIN_PAYOUT_AMOUNT ? remaining : 0;
      const carryOver = remaining >= MIN_PAYOUT_AMOUNT ? 0 : remaining;

      await settlementRef(adminApp, settlementId).set({
        settlementId,
        partnerId: String(partnerId),
        status: "created" as SettlementStatus,
        period: { from, to },
        currency,
        amountGross: { amount: gross, currency },
        amountRefunds: { amount: refundsTotal, currency },
        amountNet: { amount: net, currency },
        amountNetWithCarry: { amount: netWithCarry, currency },
        amountOffset: { amount: offsetTotal, currency },
        amountPayout: { amount: payout, currency },
        amountCarryOver: { amount: carryOver, currency },
        amountCarryOverPrev: { amount: carryOverPrev, currency },
        offsets,
        stats: { payments: payments.length, refunds: refunds.length, receivables: receivables.length },
        guardrails: { minPayout: MIN_PAYOUT_AMOUNT, maxOffsetRatio: MAX_OFFSET_RATIO },
        createdAt: now,
        updatedAt: now,
        createdBy: { uid: auth.uid, role: roleOf(auth) }
      });

      // 3.25) 이월 업데이트(파트너별)
      await payablesSummaryRef(adminApp, String(partnerId)).set(
        {
          partnerId: String(partnerId),
          carryOverAmount: { amount: carryOver, currency },
          updatedAt: now,
          lastSettlementId: settlementId
        },
        { merge: true }
      );

      // 3.5) 미수금 상계 반영(부분상계/완납)
      // - receipts(미수금)는 ops만 write 가능하므로 서버에서만 갱신
      const offsetMap = new Map(offsets.map((o) => [o.receivableId, Number(o.appliedAmount)]));
      const recBatch = adminApp.firestore().batch();
      for (const r of receivables) {
        const applied = offsetMap.get(r.id) ?? 0;
        if (applied <= 0) continue;
        const openBefore = Number(r.openAmount ?? r.amount?.amount ?? 0);
        const openAfter = Math.max(0, openBefore - applied);
        const status = openAfter === 0 ? "closed" : "open";
        recBatch.set(
          receivableRef(adminApp, String(partnerId), r.id),
          {
            openAmount: openAfter,
            status,
            updatedAt: now,
            closedAt: openAfter === 0 ? now : null,
            lastSettlementId: settlementId
          },
          { merge: true }
        );

        // 상계 로그(감사): receivable 별 offsets 서브컬렉션에 기록
        const offId = crypto.randomUUID();
        recBatch.set(receivableOffsetRef(adminApp, String(partnerId), r.id, offId), {
          offsetId: offId,
          settlementId,
          appliedAmount: { amount: applied, currency },
          openBefore: { amount: openBefore, currency },
          openAfter: { amount: openAfter, currency },
          createdAt: now
        });
      }
      await recBatch.commit();

      // 4) 정산 아이템 기록(대사/감사)
      const batch = adminApp.firestore().batch();
      for (const p of payments) {
        const itemId = crypto.randomUUID();
        batch.set(settlementItemRef(adminApp, settlementId, itemId), {
          type: "payment",
          paymentId: p.paymentId ?? p.id,
          caseId: p.caseId ?? null,
          amount: p.amount ?? null,
          occurredAt: p.capturedAt ?? p.updatedAt ?? null,
          createdAt: now
        });
      }
      for (const r of refunds) {
        const itemId = crypto.randomUUID();
        batch.set(settlementItemRef(adminApp, settlementId, itemId), {
          type: "refund",
          refundId: r.refundId ?? r.id,
          caseId: r.caseId ?? null,
          amount: r.amount ?? null,
          occurredAt: r.executedAt ?? r.updatedAt ?? null,
          createdAt: now
        });
      }
      await batch.commit();

      return { settlementId };
    });

    if (!result) return;
    return ok(res, result);
  });

  async function buildSettlementCsv(settlementId: string) {
    const sSnap = await settlementRef(adminApp, settlementId).get();
    if (!sSnap.exists) throw new Error("NOT_FOUND");
    const s = sSnap.data() as any;

    const itemsSnap = await adminApp
      .firestore()
      .collection(`settlements/${settlementId}/items`)
      .orderBy("createdAt", "asc")
      .limit(2000)
      .get();
    const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

    // UTF-8 CSV (간단): 헤더 + summary row + items rows
    const rows: string[] = [];
    const esc = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      const needs = /[",\n]/.test(s);
      const q = s.replace(/"/g, '""');
      return needs ? `"${q}"` : q;
    };

    rows.push("section,field,value");
    rows.push(`summary,settlementId,${esc(settlementId)}`);
    rows.push(`summary,partnerId,${esc(s.partnerId)}`);
    rows.push(`summary,periodFrom,${esc(s.period?.from)}`);
    rows.push(`summary,periodTo,${esc(s.period?.to)}`);
    rows.push(`summary,currency,${esc(s.currency)}`);
    rows.push(`summary,gross,${esc(s.amountGross?.amount)}`);
    rows.push(`summary,refunds,${esc(s.amountRefunds?.amount)}`);
    rows.push(`summary,net,${esc(s.amountNet?.amount)}`);
    rows.push(`summary,carryOverPrev,${esc(s.amountCarryOverPrev?.amount)}`);
    rows.push(`summary,netWithCarry,${esc(s.amountNetWithCarry?.amount)}`);
    rows.push(`summary,offsetTotal,${esc(s.amountOffset?.amount)}`);
    rows.push(`summary,payout,${esc(s.amountPayout?.amount)}`);
    rows.push(`summary,carryOver,${esc(s.amountCarryOver?.amount)}`);

    rows.push("");
    rows.push("type,caseId,refId,amount,currency,occurredAt");
    for (const it of items) {
      const refId = it.type === "payment" ? it.paymentId : it.type === "refund" ? it.refundId : it.id;
      rows.push(
        [
          esc(it.type),
          esc(it.caseId ?? ""),
          esc(refId ?? ""),
          esc(it.amount?.amount ?? ""),
          esc(it.amount?.currency ?? ""),
          esc(it.occurredAt ?? "")
        ].join(",")
      );
    }

    return { s, csv: rows.join("\n") };
  }

  // Ops: 정산 CSV 내보내기
  app.get("/v1/ops/settlements/:settlementId/export.csv", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    if (!requireOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자 권한이 없습니다.");

    const settlementId = req.params.settlementId;
    try {
      const { s, csv } = await buildSettlementCsv(settlementId);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="settlement_${s.partnerId}_${s.period?.from}_${s.period?.to}.csv"`);
      return res.status(200).send(csv);
    } catch (e: any) {
      if (String(e?.message) === "NOT_FOUND") return fail(res, 404, "NOT_FOUND", "정산을 찾을 수 없습니다.");
      return fail(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
    }
  });

  // Partner: 본인 정산 CSV 내보내기
  app.get("/v1/partner/settlements/:settlementId/export.csv", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    const pid = partnerIdOf(auth);
    if (!pid) return fail(res, 403, "FORBIDDEN", "파트너 계정이 아닙니다.");

    const settlementId = req.params.settlementId;
    try {
      const { s, csv } = await buildSettlementCsv(settlementId);
      if (s.partnerId !== pid) return fail(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="settlement_${s.partnerId}_${s.period?.from}_${s.period?.to}.csv"`);
      return res.status(200).send(csv);
    } catch (e: any) {
      if (String(e?.message) === "NOT_FOUND") return fail(res, 404, "NOT_FOUND", "정산을 찾을 수 없습니다.");
      return fail(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
    }
  });

  // Ops: 지급 처리(상태 전이)
  app.post("/v1/ops/settlements/:settlementId/pay", async (req, res) => {
    const auth = await requireAuth(adminApp, req, res);
    if (!auth) return;
    if (!requireOps(auth)) return fail(res, 403, "FORBIDDEN", "운영자 권한이 없습니다.");

    const settlementId = req.params.settlementId;

    const result = await withIdempotency(adminApp, req, res, "settlements.pay", async () => {
      const now = adminApp.firestore.FieldValue.serverTimestamp();

      const sSnap = await settlementRef(adminApp, settlementId).get();
      if (!sSnap.exists) throw new Error("NOT_FOUND");
      const s = sSnap.data() as any;
      const from = String(s.status || "created") as SettlementStatus;
      if (from === "paid") return { settlementId, status: "paid" };
      if (!isAllowedSettlementTransition(from, "paid")) throw new Error("INVALID_TRANSITION");

      const payoutAmount = Number(s.amountPayout?.amount ?? 0);
      const currency = String(s.currency ?? "KRW");
      if (payoutAmount <= 0) throw new Error("INVALID_ARGUMENT:지급 금액이 0입니다(이월 상태).");

      // 1) payout attempt 생성
      const payoutId = crypto.randomUUID();
      await settlementPayoutRef(adminApp, settlementId, payoutId).set({
        payoutId,
        settlementId,
        partnerId: s.partnerId,
        status: "processing",
        amount: { amount: payoutAmount, currency },
        requestedBy: { uid: auth.uid, role: roleOf(auth) },
        createdAt: now,
        updatedAt: now
      });

      // 2) 지급 실행(외부 연동 포인트)
      const pr = await executePayout({
        settlementId,
        partnerId: String(s.partnerId),
        amount: { amount: payoutAmount, currency }
      });

      // 3) 결과 반영(정합성: 트랜잭션)
      if (pr.ok) {
        await adminApp.firestore().runTransaction(async (t) => {
          const ref = settlementRef(adminApp, settlementId);
          const snap2 = await t.get(ref);
          if (!snap2.exists) throw new Error("NOT_FOUND");
          const s2 = snap2.data() as any;
          const from2 = String(s2.status || "created") as SettlementStatus;
          if (from2 !== "paid" && !isAllowedSettlementTransition(from2, "paid")) throw new Error("INVALID_TRANSITION");

          t.set(
            ref,
            {
              status: "paid",
              paidAt: now,
              updatedAt: now,
              paidBy: { uid: auth.uid, role: roleOf(auth) },
              lastPayoutId: payoutId
            },
            { merge: true }
          );
          t.set(
            settlementPayoutRef(adminApp, settlementId, payoutId),
            { status: "succeeded", provider: pr.provider, providerRef: pr.providerRef, updatedAt: now },
            { merge: true }
          );
        });

        await adminApp.firestore().collection("auditLogs").add({
          type: "SETTLEMENT_PAID",
          settlementId,
          partnerId: s.partnerId,
          actor: { uid: auth.uid, role: roleOf(auth) },
          payoutId,
          provider: pr.provider,
          providerRef: pr.providerRef,
          createdAt: now
        });

        return { settlementId, status: "paid", payoutId };
      } else {
        await adminApp.firestore().runTransaction(async (t) => {
          const ref = settlementRef(adminApp, settlementId);
          const snap2 = await t.get(ref);
          if (!snap2.exists) throw new Error("NOT_FOUND");
          const s2 = snap2.data() as any;
          const from2 = String(s2.status || "created") as SettlementStatus;
          if (from2 !== "failed" && !isAllowedSettlementTransition(from2, "failed")) throw new Error("INVALID_TRANSITION");

          t.set(
            ref,
            {
              status: "failed",
              updatedAt: now,
              lastPayoutId: payoutId,
              lastError: { message: pr.error }
            },
            { merge: true }
          );
          t.set(
            settlementPayoutRef(adminApp, settlementId, payoutId),
            { status: "failed", provider: pr.provider, error: pr.error, updatedAt: now },
            { merge: true }
          );
        });

        await adminApp.firestore().collection("auditLogs").add({
          type: "SETTLEMENT_PAYOUT_FAILED",
          settlementId,
          partnerId: s.partnerId,
          actor: { uid: auth.uid, role: roleOf(auth) },
          payoutId,
          provider: pr.provider,
          error: pr.error,
          createdAt: now
        });

        return { settlementId, status: "failed", payoutId };
      }
    }).catch((e: any) => {
      const msg = String(e?.message || e);
      if (msg === "NOT_FOUND") {
        fail(res, 404, "NOT_FOUND", "정산을 찾을 수 없습니다.");
        return null;
      }
      if (msg === "INVALID_TRANSITION") {
        fail(res, 409, "CONFLICT", "허용되지 않는 상태 전이입니다.");
        return null;
      }
      if (msg.startsWith("INVALID_ARGUMENT:")) {
        fail(res, 400, "INVALID_ARGUMENT", msg.replace("INVALID_ARGUMENT:", ""));
        return null;
      }
      fail(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
      return null;
    });

    if (!result) return;
    return ok(res, result);
  });
}
