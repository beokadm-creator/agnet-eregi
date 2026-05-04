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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "로그인 실패";
      setError(msg);
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "로그인 실패";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="im-shell">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 460,
            backgroundColor: "var(--ar-canvas)",
            border: "1px solid var(--ar-hairline)",
            borderRadius: "var(--ar-r3)",
            padding: "2.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
            <h1 style={{ fontFamily: "var(--ar-font-ui)", fontWeight: 700, fontSize: "1.25rem", color: "var(--ar-ink)", margin: 0 }}>
              AgentRegi
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--ar-graphite)", margin: "0.25rem 0 0" }}>
              {title}
            </p>
          </div>

          <Button disabled={busy} onClick={handleGoogle}>
            Google로 로그인
          </Button>

          <div style={{ height: 1, background: "var(--ar-hairline)" }} />

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
            <div
              style={{
                padding: "0.75rem 1rem",
                background: "var(--ar-danger-soft)",
                border: "1px solid var(--ar-danger)",
                borderRadius: "var(--ar-r1)",
                color: "var(--ar-danger)",
                fontSize: "0.875rem",
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
