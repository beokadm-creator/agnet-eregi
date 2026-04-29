import { useState } from "react";
import { getAuth, multiFactor, PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier } from "firebase/auth";
import { useAppContext } from "../../context/AppContext";

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

export default function SecuritySettings() {
  const { setLog, busy, setBusy } = useAppContext();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationId, setVerificationId] = useState("");

  const auth = getAuth();
  const user = auth.currentUser;
  
  const mfaEnrolled = user && multiFactor(user).enrolledFactors.length > 0;

  async function handleEnrollMfa() {
    if (!user) {
      setLog("[Security] 로그인된 사용자 정보가 없습니다.");
      return;
    }
    
    if (!phoneNumber) {
      setLog("[Security] 전화번호를 입력해주세요. (+821012345678 형식)");
      return;
    }

    setBusy(true);
    setLog("[Security] MFA(2FA) 등록 요청 중...");

    try {
      const session = await multiFactor(user).getSession();
      
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
      }

      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const vid = await phoneAuthProvider.verifyPhoneNumber(
        { phoneNumber, session },
        window.recaptchaVerifier
      );

      setVerificationId(vid);
      setLog("[Security] 인증 코드가 전송되었습니다. (SMS)");
    } catch (error: any) {
      setLog(`[Security] MFA 요청 실패: ${error.message}`);
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode() {
    if (!user || !verificationId || !verificationCode) return;

    setBusy(true);
    try {
      const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
      
      await multiFactor(user).enroll(multiFactorAssertion, "운영자 휴대전화");
      setLog("[Security] 2FA (MFA) 등록이 완료되었습니다!");
      
      setVerificationId("");
      setVerificationCode("");
    } catch (error: any) {
      setLog(`[Security] 인증 코드 확인 실패: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnenrollMfa() {
    if (!user) return;
    setBusy(true);
    try {
      const factors = multiFactor(user).enrolledFactors;
      for (const factor of factors) {
        await multiFactor(user).unenroll(factor);
      }
      setLog("[Security] 모든 2FA (MFA) 등록이 해제되었습니다.");
    } catch (error: any) {
      setLog(`[Security] MFA 해제 실패: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ margin: "0", fontSize: 16, fontWeight: 700, color: "var(--pc-text)" }}>보안 설정 (2FA / MFA)</h3>
      <div id="recaptcha-container"></div>
      
      {mfaEnrolled ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--pc-success-soft)", padding: 16, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-success)" }}>
          <span style={{ color: "var(--pc-success)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>✅ 2FA가 활성화되어 있습니다.</span>
          <button onClick={handleUnenrollMfa} disabled={busy} className="pc-btn pc-btn-danger">해제</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, background: "var(--pc-surface)", padding: 24, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
          <span style={{ color: "var(--pc-danger)", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>⚠️ 계정 보호를 위해 2단계 인증(MFA)을 등록하세요.</span>
          
          {!verificationId ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input 
                value={phoneNumber} 
                onChange={e => setPhoneNumber(e.target.value)} 
                placeholder="+821012345678" 
                className="pc-input"
                style={{ flex: 1 }}
              />
              <button onClick={handleEnrollMfa} disabled={busy || !phoneNumber} className="pc-btn pc-btn-brand">
                SMS 인증
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input 
                value={verificationCode} 
                onChange={e => setVerificationCode(e.target.value)} 
                placeholder="인증 코드 6자리" 
                className="pc-input"
                style={{ flex: 1 }}
              />
              <button onClick={handleVerifyCode} disabled={busy || !verificationCode} className="pc-btn pc-btn-brand">
                확인 및 등록
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
