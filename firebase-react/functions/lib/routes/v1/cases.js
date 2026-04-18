"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCaseRoutes = registerCaseRoutes;
const auth_1 = require("../../lib/auth");
const http_1 = require("../../lib/http");
const firestore_1 = require("../../lib/firestore");
const timeline_1 = require("../../lib/timeline");
const idempotency_1 = require("../../lib/idempotency");
const case_status_1 = require("../../lib/case_status");
const workflow_1 = require("../../lib/workflow");
const tasks_1 = require("../../lib/tasks");
function registerCaseRoutes(app, adminApp) {
    app.post("/v1/cases", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const result = await (0, idempotency_1.withIdempotency)(adminApp, req, res, "cases.create", async () => {
            const { sessionId, selectedPartnerId, casePackId } = req.body ?? {};
            if (!selectedPartnerId || !casePackId) {
                // withIdempotency 내부에서 fail을 호출하면 tx가 깨질 수 있어, 여기서는 throw 대신 응답용 에러를 반환하지 않게 처리
                throw new Error("INVALID_ARGUMENT:selectedPartnerId와 casePackId가 필요합니다.");
            }
            const caseId = crypto.randomUUID();
            const now = adminApp.firestore.FieldValue.serverTimestamp();
            await (0, firestore_1.caseRef)(adminApp, caseId).set({
                ownerUid: auth.uid,
                partnerId: String(selectedPartnerId),
                casePackId: String(casePackId),
                status: "new",
                riskLevel: "low",
                createdAt: now,
                updatedAt: now,
                summary: { lastEventKo: "케이스가 생성되었습니다.", sessionId: sessionId ?? null }
            });
            const eventId = crypto.randomUUID();
            await (0, timeline_1.writeTimelineEvent)(adminApp, caseId, eventId, {
                type: "CASE_CREATED",
                occurredAt: now,
                actor: { type: "user", uid: auth.uid },
                summaryKo: "케이스가 생성되었습니다.",
                meta: { partnerId: String(selectedPartnerId), casePackId: String(casePackId) }
            });
            // 워크플로우 초기화(법무사 프로세스 기반)
            await (0, workflow_1.workflowRef)(adminApp, caseId).set({
                caseId,
                casePackId: String(casePackId),
                stage: "intake",
                checklist: (0, workflow_1.initChecklist)(String(casePackId), "intake"),
                createdAt: now,
                updatedAt: now
            });
            // 초기 태스크(파트너 큐에 뜨도록)
            await (0, tasks_1.createTask)(adminApp, {
                caseId,
                partnerId: String(selectedPartnerId),
                titleKo: "케이스 접수 확인 및 1차 안내",
                type: "intake"
            });
            return { caseId };
        }).catch((e) => {
            const msg = String(e?.message || e);
            if (msg.startsWith("INVALID_ARGUMENT:")) {
                (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", msg.replace("INVALID_ARGUMENT:", ""));
                return null;
            }
            (0, http_1.fail)(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
            return null;
        });
        if (!result)
            return;
        return (0, http_1.ok)(res, result);
    });
    app.get("/v1/cases/:caseId", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const caseId = req.params.caseId;
        const snap = await (0, firestore_1.caseRef)(adminApp, caseId).get();
        if (!snap.exists)
            return (0, http_1.fail)(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
        const data = snap.data();
        const canRead = (0, auth_1.isOps)(auth) || data.ownerUid === auth.uid || ((0, auth_1.partnerIdOf)(auth) && data.partnerId === (0, auth_1.partnerIdOf)(auth));
        if (!canRead)
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
        return (0, http_1.ok)(res, { case: { id: snap.id, ...data, _role: (0, auth_1.roleOf)(auth) } });
    });
    // Partner/Ops: 케이스 상태 전이(서버만 허용)
    app.post("/v1/cases/:caseId/transition", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const caseId = req.params.caseId;
        const { to, reasonKo } = req.body ?? {};
        const toStatus = String(to || "");
        if (!toStatus)
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "to가 필요합니다.");
        const result = await (0, idempotency_1.withIdempotency)(adminApp, req, res, "cases.transition", async () => {
            const now = adminApp.firestore.FieldValue.serverTimestamp();
            const ref = (0, firestore_1.caseRef)(adminApp, caseId);
            const txResult = await adminApp.firestore().runTransaction(async (tx) => {
                const snap = await tx.get(ref);
                if (!snap.exists)
                    throw new Error("NOT_FOUND");
                const c = snap.data();
                const canWrite = (0, auth_1.isOps)(auth) || ((0, auth_1.partnerIdOf)(auth) && c.partnerId === (0, auth_1.partnerIdOf)(auth));
                if (!canWrite)
                    throw new Error("FORBIDDEN");
                const fromStatus = String(c.status || "new");
                if (fromStatus === toStatus) {
                    return { status: fromStatus };
                }
                if (!(0, case_status_1.isAllowedTransition)(fromStatus, toStatus)) {
                    throw new Error("INVALID_TRANSITION");
                }
                tx.set(ref, {
                    status: toStatus,
                    updatedAt: now,
                    summary: {
                        ...(c.summary ?? {}),
                        lastEventKo: reasonKo ? String(reasonKo) : `상태 변경: ${fromStatus} → ${toStatus}`
                    }
                }, { merge: true });
                return { status: toStatus, partnerId: c.partnerId, fromStatus, toStatus };
            });
            // 타임라인은 트랜잭션 밖에서 기록(중요: tx 내부에서 await 금지)
            const eventId = crypto.randomUUID();
            await (0, timeline_1.writeTimelineEvent)(adminApp, caseId, eventId, {
                type: "CASE_STATUS_CHANGED",
                occurredAt: now,
                actor: (0, auth_1.isOps)(auth)
                    ? { type: "ops", uid: auth.uid }
                    : { type: "partner", partnerId: txResult.partnerId, uid: auth.uid },
                summaryKo: reasonKo ? String(reasonKo) : "케이스 상태가 변경되었습니다.",
                meta: { from: txResult.fromStatus, to: txResult.toStatus }
            });
            return { status: txResult.status };
        }).catch((e) => {
            const msg = String(e?.message || e);
            if (msg === "NOT_FOUND") {
                (0, http_1.fail)(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
                return null;
            }
            if (msg === "FORBIDDEN") {
                (0, http_1.fail)(res, 403, "FORBIDDEN", "상태 변경 권한이 없습니다.");
                return null;
            }
            if (msg === "INVALID_TRANSITION") {
                (0, http_1.fail)(res, 409, "CONFLICT", "허용되지 않는 상태 전이입니다.");
                return null;
            }
            (0, http_1.fail)(res, 500, "INTERNAL", "서버 오류가 발생했습니다.");
            return null;
        });
        if (!result)
            return;
        return (0, http_1.ok)(res, result);
    });
    // 케이스 타임라인 조회(참여자)
    app.get("/v1/cases/:caseId/timeline", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const caseId = req.params.caseId;
        const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
        const snap = await (0, firestore_1.caseRef)(adminApp, caseId).get();
        if (!snap.exists)
            return (0, http_1.fail)(res, 404, "NOT_FOUND", "케이스를 찾을 수 없습니다.");
        const data = snap.data();
        const canRead = (0, auth_1.isOps)(auth) || data.ownerUid === auth.uid || ((0, auth_1.partnerIdOf)(auth) && data.partnerId === (0, auth_1.partnerIdOf)(auth));
        if (!canRead)
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "접근 권한이 없습니다.");
        const tSnap = await adminApp
            .firestore()
            .collection(`cases/${caseId}/timeline`)
            .orderBy("occurredAt", "desc")
            .limit(limit)
            .get();
        const items = tSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return (0, http_1.ok)(res, { items });
    });
}
//# sourceMappingURL=cases.js.map