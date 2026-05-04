import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import * as crypto from "crypto";

const client = new SecretManagerServiceClient();

/**
 * PII(개인식별정보) 데이터 암/복호화 모듈
 * (Google Cloud Secret Manager에 저장된 AES-256-GCM 키 활용)
 */

let cachedEncryptionKey: Buffer | null = null;

async function getEncryptionKey(): Promise<Buffer> {
  if (cachedEncryptionKey) return cachedEncryptionKey;

  try {
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId) throw new Error("GCP_PROJECT is not set.");
    
    const [version] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/pii-encryption-key/versions/latest`
    });
    
    const payload = version.payload?.data?.toString();
    if (!payload) throw new Error("Secret payload is empty.");
    
    // Secret Manager에 저장된 키는 32바이트 hex 문자열로 가정 (64 characters)
    cachedEncryptionKey = Buffer.from(payload, "hex");
    if (cachedEncryptionKey.length !== 32) {
      throw new Error("Invalid encryption key length. Expected 32 bytes.");
    }
    
    return cachedEncryptionKey;
  } catch (e: any) {
    console.error("[crypto] Failed to fetch encryption key. Using fallback dev key.", e.message);
    // 개발 환경용 Fallback Key (절대 프로덕션에서 사용 금지)
    cachedEncryptionKey = Buffer.from("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "hex");
    return cachedEncryptionKey;
  }
}

export async function encryptPII(text: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.randomBytes(12); // GCM 권장 IV 길이
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");
  
  // Format: "iv:encrypted:authTag"
  return `${iv.toString("base64")}:${encrypted}:${authTag}`;
}

export async function decryptPII(cipherText: string): Promise<string> {
  const key = await getEncryptionKey();
  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid cipherText format.");
  }
  
  const [ivBase64, encrypted, authTagBase64] = parts;
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}
