import * as admin from "firebase-admin";
import { logOpsEvent } from "./ops_audit";

export async function processBreakglassExpiry(adminApp: typeof admin) {
  const now = Date.now();
  
  // Custom Claim을 모두 조회하려면 listUsers를 써야함 (수 천명이면 비효율적이나 Ops유저는 소수라 가정)
  // 최적화를 위해서는 ops_system/breakglass 같은 컬렉션에 사용자 ID를 저장해두는 방식이 좋음.
  // 여기서는 MVP로 모든 사용자를 순회 (최대 1000명 단위)
  
  let pageToken: string | undefined;
  do {
    const listUsersResult = await adminApp.auth().listUsers(1000, pageToken);
    
    for (const userRecord of listUsersResult.users) {
      const claims = userRecord.customClaims || {};
      
      if (claims.opsRole === "ops_admin" && claims.breakGlassExpiresAt) {
        if (now > claims.breakGlassExpiresAt) {
          // 만료됨 -> ops_operator로 강등 또는 권한 제거 (기존 권한을 어딘가 저장해둬야 하지만, 
          // 임시로 breakglass 사용자는 기본 ops_operator라고 가정)
          
          const newClaims = { ...claims };
          newClaims.opsRole = "ops_operator";
          delete newClaims.breakGlassExpiresAt;
          
          await adminApp.auth().setCustomUserClaims(userRecord.uid, newClaims);
          
          await logOpsEvent(adminApp, {
            gateKey: "system",
            action: "ops_access.breakglass_expired",
            status: "success",
            actorUid: "system",
            requestId: `breakglass_exp_${now}`,
            summary: `사용자 ${userRecord.email}(${userRecord.uid})의 Break-glass (임시 ops_admin) 만료되어 회수됨`,
            target: { uid: userRecord.uid }
          });
        }
      }
    }
    
    pageToken = listUsersResult.pageToken;
  } while (pageToken);
}