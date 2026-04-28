import { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
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
      // 1. 세션 가져오기
      const session = await multiFactor(user).getSession();
      
      // 2. reCAPTCHA 생성 (Firebase Auth SMS 요구사항)
      // 실제 환경에서는 button 등에 연결하지만 여기서는 보이지 않는 형태로 구성
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
      }

      // 3. SMS 전송
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const vid = await phoneAuthProvider.verifyPhoneNumber(
        { phoneNumber, session },
        window.recaptchaVerifier
      );

      setVerificationId(vid);
      setLog("[Security] 인증 코드가 전송되었습니다. (SMS)");
    } catch (error: any) {
      setLog(`[Security] MFA 요청 실패: ${error.message}`);
      // reCAPTCHA 초기화
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
      
      // 4. 인증 수단 등록 완료
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
    <div style={{ marginTop: 24, padding: 16, border: "1px solid var(--ar-fog)", borderRadius: "var(--ar-r1)", background: "var(--ar-paper-alt)" }}>
      <h3 style={{ margin: "0 0 12px" }}>보안 설정 (2FA / MFA)</h3>
      <div id="recaptcha-container"></div>
      
      {mfaEnrolled ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "var(--ar-success)", fontWeight: "bold" }}>✅ 2FA가 활성화되어 있습니다.</span>
          <Button variant="danger" size="sm" onClick={handleUnenrollMfa} disabled={busy}>해제</Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ color: "var(--ar-danger)", fontSize: "0.9em" }}>⚠️ 계정 보호를 위해 2단계 인증(MFA)을 등록하세요.</span>
          
          {!verificationId ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Input 
                value={phoneNumber} 
                onChange={e => setPhoneNumber(e.target.value)} 
                placeholder="+821012345678" 
              />
              <Button variant="primary" onClick={handleEnrollMfa} disabled={busy || !phoneNumber}>
                SMS 인증
              </Button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <Input 
                value={verificationCode} 
                onChange={e => setVerificationCode(e.target.value)} 
                placeholder="인증 코드 6자리" 
              />
              <Button variant="primary" onClick={handleVerifyCode} disabled={busy || !verificationCode}>
                확인 및 등록
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
