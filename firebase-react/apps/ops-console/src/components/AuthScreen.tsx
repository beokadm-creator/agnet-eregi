import { useMemo, useState } from "react";
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth } from "@rp/firebase";

type Mode = "login" | "signup";

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  const title = useMemo(() => {
    return mode === "signup" ? "Create Account" : "Welcome Back";
  }, [mode]);
  const subTitle = useMemo(() => {
    return mode === "signup" ? "운영 콘솔 신규 계정을 생성합니다." : "운영 콘솔에 로그인하세요.";
  }, [mode]);

  async function handleGoogle() {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: any) {
      setError(e?.message || "로그인 실패");
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e: any) {
      setError(e?.message || "로그인 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100dvh",
      background: "radial-gradient(circle at 50% -20%, #1a1a24 0%, var(--ops-bg) 70%)",
      padding: "24px"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "400px",
        background: "rgba(24, 24, 27, 0.6)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.05)",
        borderRadius: "16px",
        padding: "40px 32px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.02)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "48px",
            height: "48px",
            background: "linear-gradient(135deg, var(--ops-brand), var(--ops-accent))",
            borderRadius: "12px",
            marginBottom: "20px",
            boxShadow: "0 8px 16px -4px rgba(59, 130, 246, 0.4)",
            color: "white",
            fontSize: "24px",
            fontWeight: 800
          }}>
            A
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 700, color: "var(--ops-text)", letterSpacing: "-0.5px" }}>
            {title}
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--ops-text-muted)" }}>
            {subTitle}
          </p>
        </div>

        <form onSubmit={handleEmail} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <button 
            type="button" 
            disabled={busy} 
            onClick={handleGoogle}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              height: "40px",
              background: "white",
              color: "#000",
              border: "none",
              borderRadius: "var(--ops-radius)",
              fontSize: "14px",
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              transition: "transform 0.1s, opacity 0.2s",
              opacity: busy ? 0.7 : 1
            }}
            onMouseOver={e => !busy && (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseOut={e => !busy && (e.currentTarget.style.transform = "scale(1)")}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "8px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "var(--ops-border)" }} />
            <span style={{ fontSize: "12px", color: "var(--ops-text-faint)", textTransform: "uppercase", letterSpacing: "1px" }}>OR</span>
            <div style={{ flex: 1, height: "1px", background: "var(--ops-border)" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--ops-text-muted)" }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="name@company.com"
              style={{
                width: "100%",
                height: "40px",
                padding: "0 14px",
                background: "rgba(0,0,0,0.2)",
                border: "1px solid var(--ops-border)",
                borderRadius: "var(--ops-radius)",
                color: "var(--ops-text)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s"
              }}
              onFocus={e => {
                e.target.style.borderColor = "var(--ops-brand)";
                e.target.style.boxShadow = "0 0 0 1px var(--ops-brand)";
              }}
              onBlur={e => {
                e.target.style.borderColor = "var(--ops-border)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--ops-text-muted)" }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="••••••••"
              style={{
                width: "100%",
                height: "40px",
                padding: "0 14px",
                background: "rgba(0,0,0,0.2)",
                border: "1px solid var(--ops-border)",
                borderRadius: "var(--ops-radius)",
                color: "var(--ops-text)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
                fontFamily: "var(--ops-font-mono)"
              }}
              onFocus={e => {
                e.target.style.borderColor = "var(--ops-brand)";
                e.target.style.boxShadow = "0 0 0 1px var(--ops-brand)";
              }}
              onBlur={e => {
                e.target.style.borderColor = "var(--ops-border)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <button 
            type="submit" 
            disabled={busy || !email.trim() || !password.trim()}
            style={{
              height: "40px",
              marginTop: "8px",
              background: "var(--ops-text)",
              color: "var(--ops-bg)",
              border: "none",
              borderRadius: "var(--ops-radius)",
              fontSize: "14px",
              fontWeight: 600,
              cursor: (busy || !email.trim() || !password.trim()) ? "not-allowed" : "pointer",
              transition: "transform 0.1s, opacity 0.2s",
              opacity: (busy || !email.trim() || !password.trim()) ? 0.5 : 1
            }}
            onMouseOver={e => !(busy || !email.trim() || !password.trim()) && (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseOut={e => !(busy || !email.trim() || !password.trim()) && (e.currentTarget.style.transform = "scale(1)")}
          >
            {mode === "signup" ? "이메일로 가입" : "로그인"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--ops-text-muted)",
              fontSize: "13px",
              cursor: "pointer",
              padding: "4px",
              marginTop: "8px",
              textDecoration: "underline",
              textUnderlineOffset: "4px",
              textDecorationColor: "rgba(255,255,255,0.2)",
              transition: "color 0.2s"
            }}
            onMouseOver={e => e.currentTarget.style.color = "var(--ops-text)"}
            onMouseOut={e => e.currentTarget.style.color = "var(--ops-text-muted)"}
          >
            {mode === "signup" ? "이미 계정이 있으신가요? 로그인" : "계정이 없으신가요? 가입하기"}
          </button>

          {error && (
            <div style={{
              marginTop: "8px",
              padding: "12px",
              background: "var(--ops-danger-soft)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "var(--ops-radius)",
              color: "var(--ops-danger)",
              fontSize: "13px",
              textAlign: "center",
              lineHeight: 1.4
            }}>
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
