import { useMemo, useState } from "react";
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { Button, Input } from "@agentregi/ui-components";
import { auth } from "@rp/firebase";

type Mode = "login" | "signup";

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  const title = useMemo(() => {
    return mode === "signup" ? "Partner Console · Sign up" : "Partner Console · Sign in";
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

  async function handleEmail() {
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
    <div className="im-shell selection:bg-[var(--brand)]/10 selection:text-[var(--brand)]">
      <div className="im-container">
        <header className="im-header">
          <h1 className="im-title">AgentRegi</h1>
          <div className="im-lang">
            <span>{title}</span>
          </div>
        </header>

        <div className="im-panel" style={{ maxWidth: 460, margin: "0 auto" }}>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <Button disabled={busy} onClick={handleGoogle}>
              Google로 로그인
            </Button>

            <div style={{ height: 1, background: "var(--border)" }} />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            <Button disabled={busy || !email.trim() || !password.trim()} onClick={handleEmail}>
              {mode === "signup" ? "이메일로 가입" : "이메일로 로그인"}
            </Button>

            <button
              type="button"
              className="im-link"
              onClick={() => setMode(mode === "signup" ? "login" : "signup")}
              style={{ justifySelf: "start" }}
            >
              {mode === "signup" ? "이미 계정이 있으신가요?" : "이메일로 가입하기"}
            </button>

            {error && (
              <div className="im-log" style={{ background: "var(--error-light)", color: "var(--error)" }}>
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

