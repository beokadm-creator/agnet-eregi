"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categorizeError = categorizeError;
exports.logOpsEvent = logOpsEvent;
function categorizeError(errorMsg) {
    const msg = (errorMsg || "").toLowerCase();
    if (msg.includes("rate limit") || msg.includes("429")) {
        return {
            category: "GITHUB_RATE_LIMIT",
            hint: "GitHub API 호출 한도 초과. 잠시 후 재시도하세요.",
            retryable: true
        };
    }
    if (msg.includes("missing_mapping") || msg.includes("매핑 누락")) {
        return {
            category: "MISSING_MAPPING",
            hint: "Project 설정에 필드나 옵션 매핑이 누락되었습니다. [Project 설정 갱신(Discover)] 후 Alias를 확인하세요.",
            playbookRef: "#action-projectdiscover-fail",
            retryable: false
        };
    }
    if (msg.includes("토큰") || msg.includes("token") || msg.includes("missing_config") || msg.includes("failed_precondition")) {
        return {
            category: "MISSING_CONFIG",
            hint: "GitHub 연동 설정(Token 등)이 누락되었거나 올바르지 않습니다.",
            playbookRef: "#action-workflowdispatch-fail",
            retryable: false
        };
    }
    if (msg.includes("401") || msg.includes("403") || msg.includes("bad credentials") || msg.includes("permission_denied")) {
        return {
            category: "AUTH",
            hint: "GitHub 인증 실패 또는 권한 부족. Token 권한을 확인하세요.",
            playbookRef: "#action-workflowdispatch-fail",
            retryable: false
        };
    }
    if (msg.includes("timeout") || msg.includes("enotfound") || msg.includes("econnrefused") || msg.includes("network") || msg.includes("502") || msg.includes("503") || msg.includes("504")) {
        return {
            category: "NETWORK",
            hint: "일시적인 네트워크 또는 서버 통신 오류입니다. 재시도 시 성공할 수 있습니다.",
            retryable: true
        };
    }
    return {
        category: "UNKNOWN",
        hint: "알 수 없는 오류입니다. 에러 메시지를 확인하세요.",
        retryable: true // 기본적으로 알 수 없는 오류는 일시적일 수 있으므로 재시도 허용
    };
}
async function logOpsEvent(adminApp, event) {
    try {
        if (event.status === "fail" && event.error && event.error.message && !event.error.category) {
            const { category, hint, playbookRef } = categorizeError(event.error.message);
            event.error.category = category;
            event.error.hint = hint;
            if (playbookRef) {
                event.error.playbookRef = playbookRef;
            }
        }
        const docRef = adminApp.firestore().collection("ops_audit_events").doc();
        await docRef.set(Object.assign(Object.assign({}, event), { createdAt: adminApp.firestore.FieldValue.serverTimestamp() }));
    }
    catch (err) {
        console.error("[ops_audit] Failed to log ops event:", err);
    }
}
//# sourceMappingURL=ops_audit.js.map