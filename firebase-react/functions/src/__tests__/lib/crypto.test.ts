import { encryptPII, decryptPII } from "../../lib/crypto";

describe("crypto", () => {
  it("should encrypt and decrypt PII data using the fallback key", async () => {
    const originalText = "900101-1234567";
    
    const encrypted = await encryptPII(originalText);
    expect(encrypted).not.toEqual(originalText);
    expect(encrypted.split(":").length).toBe(3); // iv, encrypted, authTag
    
    const decrypted = await decryptPII(encrypted);
    expect(decrypted).toEqual(originalText);
  });

  it("should throw an error if cipherText is malformed", async () => {
    await expect(decryptPII("invalid:format")).rejects.toThrow("Invalid cipherText format.");
  });
});
