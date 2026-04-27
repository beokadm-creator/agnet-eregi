import * as admin from "firebase-admin";
import * as crypto from "crypto";

/**
 * 보안 딥링크(Magic Link) 생성 유틸리티 [EP-10-03]
 * 사용자가 로그인 없이 링크 클릭만으로 워크스페이스에 즉시 진입할 수 있는 1회용 토큰 생성
 */
export async function createMagicLink(adminApp: typeof admin, targetUid: string, redirectUrl: string): Promise<string> {
  const db = adminApp.firestore();
  
  // 1. 암호학적으로 안전한 랜덤 토큰 생성
  const token = crypto.randomBytes(32).toString("hex");
  
  // 2. 만료 시간 설정 (기본: 24시간)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // 3. 토큰 문서 저장
  await db.collection("magic_links").doc(token).set({
    targetUid,
    redirectUrl,
    used: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
  });

  // 4. API 서버 호스트 조립
  // 환경 변수 설정값 사용, 없으면 프로덕션 기본 도메인 사용
  const apiBaseUrl = process.env.API_BASE_URL || "https://api.agentregi.com";
  
  return `${apiBaseUrl}/v1/auth/magic-link?token=${token}`;
}
