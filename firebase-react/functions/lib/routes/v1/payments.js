"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPaymentRoutes = registerPaymentRoutes;
const node_crypto_1 = __importDefault(require("node:crypto"));
const auth_1 = require("../../lib/auth");
const http_1 = require("../../lib/http");
const idempotency_1 = require("../../lib/idempotency");
const firestore_1 = require("../../lib/firestore");
const timeline_1 = require("../../lib/timeline");
const pg_1 = require("../../lib/pg");
const payment_status_1 = require("../../lib/payment_status");
function quoteRef(adminApp, caseId, quoteId) {
    return adminApp.firestore().doc(`cases/${caseId}/quotes/${quoteId}`);
}
function paymentRef(adminApp, caseId, paymentId) {
    return adminApp.firestore().doc(`cases/${caseId}/payments/${paymentId}`);
}
function paymentEventRef(adminApp, caseId, paymentId, pgEventId) {
    return adminApp.firestore().doc(`cases/${caseId}/payments/${paymentId}/events/${pgEventId}`);
}
function shouldSkipWebhookAuth() {
    // 운영에서는 반드시 서명 검증. 에뮬레이터에서는 편의상 완화.
    return process.env.FUNCTIONS_EMULATOR === "true";
}
function registerPaymentRoutes(app, adminApp) {
    // 케이스 결제 목록(참여자)
    app.get("/v1/cases/:caseId/payments", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const caseId = req.params.caseId;
        const cs = await (0, firestore_1.caseRef)(adminApp, caseId).get();
        if (!cs.exists)
            return (0, http_1.fail)(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
        const c = cs.data();
        if (c.ownerUid !== auth.uid && !(0, auth_1.requireOps)(auth))
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
        const snap = await adminApp.firestore().collection(`cases/${caseId}/payments`).orderBy("updatedAt", "desc").limit(50).get();
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return (0, http_1.ok)(res, { items });
    });
    // 결제 생성(유저)
    app.post("/v1/cases/:caseId/payments/create", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const caseId = req.params.caseId;
        const { quoteId, method, clientReturnUrl } = req.body ?? {};
        if (!quoteId)
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "quoteId가 필요합니다.");
        const cSnap = await (0, firestore_1.caseRef)(adminApp, caseId).get();
        if (!cSnap.exists)
            return (0, http_1.fail)(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
        const c = cSnap.data();
        if (c.ownerUid !== auth.uid && !(0, auth_1.requireOps)(auth))
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "결제 생성 권한이 없습니다.");
        const result = await (0, idempotency_1.withIdempotency)(adminApp, req, res, "payments.create", async () => {
            const qSnap = await quoteRef(adminApp, caseId, String(quoteId)).get();
            if (!qSnap.exists)
                throw new Error("INVALID_ARGUMENT:견적을 찾을 수 없습니다.");
            const q = qSnap.data();
            if (q.status !== "accepted")
                throw new Error("INVALID_ARGUMENT:수락된 견적만 결제할 수 있습니다.");
            const paymentId = node_crypto_1.default.randomUUID();
            const now = adminApp.firestore.FieldValue.serverTimestamp();
            const amount = { amount: Number(q.priceRange?.max ?? q.priceRange?.min ?? 0), currency: q.priceRange?.currency ?? "KRW" };
            if (!amount.amount)
                throw new Error("INVALID_ARGUMENT:결제 금액이 유효하지 않습니다.");
            await paymentRef(adminApp, caseId, paymentId).set({
                caseId,
                ownerUid: c.ownerUid,
                partnerId: c.partnerId,
                quoteId: String(quoteId),
                method: method ?? "card",
                amount,
                status: "created",
                createdByUid: auth.uid,
                createdAt: now,
                updatedAt: now,
                clientReturnUrl: clientReturnUrl ?? null
            });
            const eventId = node_crypto_1.default.randomUUID();
            await (0, timeline_1.writeTimelineEvent)(adminApp, caseId, eventId, {
                type: "PAYMENT_AUTHORIZED",
                occurredAt: now,
                actor: { type: "user", uid: auth.uid },
                summaryKo: "결제가 생성되었습니다.",
                meta: { paymentId, amount }
            });
            // 실제 PG 연동 시 여기서 redirectUrl/sessionToken 반환
            const redirectUrl = `https://pg.example/checkout?paymentId=${paymentId}`;
            return { paymentId, redirectUrl };
        });
        if (!result)
            return;
        return (0, http_1.ok)(res, result);
    });
    // PG 웹훅(인증/서명검증 필요. v1은 에뮬레이터/개발에서만 완화)
    app.post("/v1/pg/webhook", async (req, res) => {
        const signature = req.header("X-PG-Signature");
        const secret = process.env.PG_WEBHOOK_SECRET || null;
        if (!shouldSkipWebhookAuth()) {
            const rawBody = req.rawBody;
            if (!rawBody)
                return (0, http_1.fail)(res, 500, "INTERNAL", "rawBody가 없어 서명 검증을 수행할 수 없습니다.");
            const v = (0, pg_1.verifyWebhookSignature)({ rawBody, signatureHeader: signature, secret });
            if (!v.ok)
                return (0, http_1.fail)(res, 403, "FORBIDDEN", "웹훅 서명이 유효하지 않습니다.", v);
        }
        const { pgEventId, type, caseId, paymentId, amount } = req.body ?? {};
        if (!pgEventId || !type || !caseId || !paymentId) {
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "pgEventId/type/caseId/paymentId가 필요합니다.");
        }
        const result = await (0, idempotency_1.withIdempotency)(adminApp, req, res, "pg.webhook", async () => {
            const now = adminApp.firestore.FieldValue.serverTimestamp();
            const pref = paymentRef(adminApp, String(caseId), String(paymentId));
            const ps = await pref.get();
            if (!ps.exists)
                throw new Error("INVALID_ARGUMENT:paymentId를 찾을 수 없습니다.");
            const p = ps.data();
            // 이벤트 저장(대사/재현)
            await paymentEventRef(adminApp, String(caseId), String(paymentId), String(pgEventId)).set({
                pgEventId: String(pgEventId),
                type: String(type),
                payload: req.body ?? null,
                receivedAt: now
            });
            // 상태 갱신
            const fromStatus = String(p.status || "created");
            const toStatus = (0, payment_status_1.statusFromPgEvent)(String(type));
            if (!toStatus)
                throw new Error("INVALID_ARGUMENT:지원하지 않는 결제 이벤트입니다.");
            if (fromStatus !== toStatus && !(0, payment_status_1.isAllowedPaymentTransition)(fromStatus, toStatus)) {
                throw new Error(`INVALID_ARGUMENT:허용되지 않는 결제 상태 전이(${fromStatus} -> ${toStatus})`);
            }
            const patch = { status: toStatus, updatedAt: now };
            if (toStatus === "authorized")
                patch.authorizedAt = now;
            if (toStatus === "captured")
                patch.capturedAt = now;
            if (toStatus === "failed")
                patch.failedAt = now;
            if (toStatus === "cancelled")
                patch.cancelledAt = now;
            await pref.set(patch, { merge: true });
            const eventId = node_crypto_1.default.randomUUID();
            await (0, timeline_1.writeTimelineEvent)(adminApp, String(caseId), eventId, {
                type: String(type),
                occurredAt: now,
                actor: { type: "system", id: "pg_webhook" },
                summaryKo: type === "PAYMENT_CAPTURED" ? "결제가 완료되었습니다." : "결제 이벤트가 처리되었습니다.",
                meta: { paymentId: String(paymentId), pgEventId: String(pgEventId), amount: amount ?? null }
            });
            return { accepted: true };
        }, { fallbackKey: String(pgEventId) });
        if (!result)
            return;
        return (0, http_1.ok)(res, result);
    });
    // Ops: 웹훅 재처리(대사/장애 복구)
    app.post("/v1/ops/pg/reprocess", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        if (!(0, auth_1.requireOps)(auth))
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "운영자 권한이 없습니다.");
        const { caseId, paymentId, pgEventId } = req.body ?? {};
        if (!caseId || !paymentId || !pgEventId)
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "caseId/paymentId/pgEventId가 필요합니다.");
        // 저장된 이벤트를 그대로 재적용(멱등키는 pgEventId)
        const evSnap = await paymentEventRef(adminApp, String(caseId), String(paymentId), String(pgEventId)).get();
        if (!evSnap.exists)
            return (0, http_1.fail)(res, 404, "NOT_FOUND", "저장된 pg 이벤트를 찾을 수 없습니다.");
        const ev = evSnap.data();
        // 내부적으로 webhook 로직을 재사용: withIdempotency fallbackKey=pgEventId에 의해 안전
        const fakeReq = { body: { ...ev.payload, caseId, paymentId, pgEventId }, query: {}, path: "/v1/pg/webhook", header: () => null };
        const result = await (0, idempotency_1.withIdempotency)(adminApp, fakeReq, res, "pg.webhook", async () => {
            // 최소 로직 복제(서명 검증은 ops reprocess에서는 생략)
            const now = adminApp.firestore.FieldValue.serverTimestamp();
            const pref = paymentRef(adminApp, String(caseId), String(paymentId));
            const ps = await pref.get();
            if (!ps.exists)
                throw new Error("INVALID_ARGUMENT:paymentId를 찾을 수 없습니다.");
            const p = ps.data();
            const fromStatus = String(p.status || "created");
            const toStatus = (0, payment_status_1.statusFromPgEvent)(String(ev.type));
            if (!toStatus)
                throw new Error("INVALID_ARGUMENT:지원하지 않는 결제 이벤트입니다.");
            if (fromStatus !== toStatus && !(0, payment_status_1.isAllowedPaymentTransition)(fromStatus, toStatus)) {
                throw new Error(`INVALID_ARGUMENT:허용되지 않는 결제 상태 전이(${fromStatus} -> ${toStatus})`);
            }
            await pref.set({ status: toStatus, updatedAt: now }, { merge: true });
            const eventId = node_crypto_1.default.randomUUID();
            await (0, timeline_1.writeTimelineEvent)(adminApp, String(caseId), eventId, {
                type: String(ev.type),
                occurredAt: now,
                actor: { type: "ops", uid: auth.uid },
                summaryKo: "PG 이벤트가 재처리되었습니다.",
                meta: { paymentId: String(paymentId), pgEventId: String(pgEventId) }
            });
            return { accepted: true };
        }, { fallbackKey: String(pgEventId) });
        if (!result)
            return;
        return (0, http_1.ok)(res, { reprocessed: true });
    });
}
//# sourceMappingURL=payments.js.map