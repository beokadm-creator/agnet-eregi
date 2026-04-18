"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFunnelRoutes = registerFunnelRoutes;
const auth_1 = require("../../lib/auth");
const http_1 = require("../../lib/http");
const firestore_1 = require("../../lib/firestore");
const idempotency_1 = require("../../lib/idempotency");
function makeCardsForStep(step, state) {
    if (step === 0) {
        return [
            { type: "question", questionId: "q_company_type", titleKo: "회사 형태를 선택해 주세요", options: ["주식회사", "유한회사"] }
        ];
    }
    if (step === 1) {
        return [
            { type: "question", questionId: "q_officer_type", titleKo: "변경할 임원 종류는 무엇인가요?", options: ["이사", "감사"] }
        ];
    }
    const companyType = state?.answers?.q_company_type ?? "주식회사";
    const officerType = state?.answers?.q_officer_type ?? "이사";
    return [{ type: "result", titleKo: "추천 파트너", bodyKo: `${companyType} ${officerType} 변경 등기 케이스로 추천합니다.` }];
}
function registerFunnelRoutes(app, adminApp) {
    app.post("/v1/intent", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const { intentText, locale } = req.body ?? {};
        if (!intentText)
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "intentText가 필요합니다.");
        const result = await (0, idempotency_1.withIdempotency)(adminApp, req, res, "funnel.intent", async () => {
            const sessionId = crypto.randomUUID();
            const now = adminApp.firestore.FieldValue.serverTimestamp();
            await (0, firestore_1.sessionRef)(adminApp, sessionId).set({
                ownerUid: auth.uid,
                locale: locale ?? "ko",
                intentText: String(intentText),
                step: 0,
                answers: {},
                createdAt: now,
                updatedAt: now
            });
            return { sessionId, cards: makeCardsForStep(0, {}) };
        });
        if (!result)
            return;
        return (0, http_1.ok)(res, result);
    });
    app.post("/v1/diagnosis/answer", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const { sessionId, answer } = req.body ?? {};
        const qid = answer?.questionId;
        const value = answer?.value;
        if (!sessionId || !qid)
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "sessionId/answer.questionId가 필요합니다.");
        const ref = (0, firestore_1.sessionRef)(adminApp, String(sessionId));
        const snap = await ref.get();
        if (!snap.exists)
            return (0, http_1.fail)(res, 404, "NOT_FOUND", "세션을 찾을 수 없습니다.");
        const s = snap.data();
        if (s.ownerUid !== auth.uid)
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "세션 접근 권한이 없습니다.");
        const nextStep = Math.min(2, (s.step ?? 0) + 1);
        const updated = {
            answers: { ...(s.answers ?? {}), [qid]: value?.officerType ?? value?.companyType ?? value },
            step: nextStep,
            updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
        };
        await ref.set(updated, { merge: true });
        const mergedState = { ...s, ...updated };
        return (0, http_1.ok)(res, { cards: makeCardsForStep(nextStep, mergedState) });
    });
    app.get("/v1/results", async (req, res) => {
        const auth = await (0, auth_1.requireAuth)(adminApp, req, res);
        if (!auth)
            return;
        const sessionId = String(req.query.sessionId || "");
        if (!sessionId)
            return (0, http_1.fail)(res, 400, "INVALID_ARGUMENT", "sessionId가 필요합니다.");
        const snap = await (0, firestore_1.sessionRef)(adminApp, sessionId).get();
        if (!snap.exists)
            return (0, http_1.fail)(res, 404, "NOT_FOUND", "세션을 찾을 수 없습니다.");
        const s = snap.data();
        if (s.ownerUid !== auth.uid)
            return (0, http_1.fail)(res, 403, "FORBIDDEN", "세션 접근 권한이 없습니다.");
        const resultSetId = `rs_${sessionId.slice(0, 8)}`;
        const partners = [
            { partnerId: "p_demo_01", profile: { nameKo: "데모 파트너 01", regionKo: "서울", verification: "verified" }, sponsor: { active: true } }
        ];
        const disclosureCards = [{ type: "disclosure", titleKo: "광고/추천 고지", bodyKo: "일부 파트너는 유료 광고로 상단 노출될 수 있습니다." }];
        return (0, http_1.ok)(res, { resultSetId, partners, disclosureCards });
    });
}
//# sourceMappingURL=funnel.js.map