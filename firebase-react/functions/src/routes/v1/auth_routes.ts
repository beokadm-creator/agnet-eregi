import * as express from "express";
import * as admin from "firebase-admin";

export function registerAuthRoutes(app: express.Application, adminApp: typeof admin) {
  // [EP-10-03] 매직 링크 클릭 시 자동 로그인 및 워크스페이스 리다이렉트
  app.get("/v1/auth/magic-link", async (req: express.Request, res: express.Response) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (!token || token === "undefined" || token === "null" || !/^[A-Za-z0-9_-]{16,256}$/.test(token)) {
        return res.status(400).send("토큰이 제공되지 않았습니다.");
      }

      const db = adminApp.firestore();
      const tokenRef = db.collection("magic_links").doc(token);
      const data = await db.runTransaction(async (tx) => {
        const tokenSnap = await tx.get(tokenRef);
        if (!tokenSnap.exists) return null;
        const data = tokenSnap.data();
        if (data?.used) return { status: "USED" as const };
        const expiresAt = data?.expiresAt?.toDate();
        if (expiresAt && expiresAt < new Date()) return { status: "EXPIRED" as const };
        tx.update(tokenRef, {
          used: true,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { status: "OK" as const, data };
      });

      if (!data) {
        return res.status(404).send("유효하지 않은 보안 링크입니다.");
      }
      if (data.status === "USED") {
        return res.status(403).send("이미 사용된 보안 링크입니다. 새 알림을 요청해주세요.");
      }
      if (data.status === "EXPIRED") {
        return res.status(403).send("만료된 보안 링크입니다.");
      }

      // Firebase Custom Token 생성 (클라이언트에서 signInWithCustomToken 호출용)
      const customToken = await adminApp.auth().createCustomToken(data.data!.targetUid);

      // 클라이언트 측 URL로 리다이렉트하면서 토큰 전달
      // 예: https://agentregi.com/login?customToken=xxx&next=/workspace
      const redirectUrlRaw = typeof data.data?.redirectUrl === "string" ? data.data.redirectUrl : "/";
      const redirectPath =
        redirectUrlRaw.startsWith("/") && !redirectUrlRaw.startsWith("//") ? redirectUrlRaw : "/";
      const finalUrl = new URL(redirectPath, process.env.CLIENT_BASE_URL || "http://localhost:3000");
      finalUrl.searchParams.set("customToken", customToken);

      return res.redirect(302, finalUrl.toString());
    } catch (err: any) {
      console.error("[Auth] Magic Link 처리 중 오류:", err);
      return res.status(500).send("서버 오류가 발생했습니다.");
    }
  });
}
