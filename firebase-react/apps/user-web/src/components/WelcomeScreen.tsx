import { useState } from "react";
import { useTranslation } from "react-i18next";

interface WelcomeScreenProps {
  busy: boolean;
  log: string;
  onGoogleLogin: () => void;
  onEmailLogin: (email: string, password: string) => void;
  onEmailSignUp: (email: string, password: string) => void;
}

export default function WelcomeScreen({ busy, log, onGoogleLogin, onEmailLogin, onEmailSignUp }: WelcomeScreenProps) {
  const { i18n } = useTranslation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isError = log.startsWith("[Error]");
  const displayLog = isError ? log.replace("[Error] ", "") : log;

  return (
    <div className="uw-container" style={{ maxWidth: 520, margin: "0 auto", paddingTop: 80, paddingBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => i18n.changeLanguage("ko")}
          className={`uw-btn uw-btn-outline uw-btn-sm`}
          type="button"
          style={{
            borderColor: i18n.language?.startsWith("ko") ? "var(--uw-brand)" : "var(--uw-border-strong)",
            color: i18n.language?.startsWith("ko") ? "var(--uw-brand)" : "var(--uw-ink)"
          }}
        >
          KO
        </button>
        <button
          onClick={() => i18n.changeLanguage("en")}
          className={`uw-btn uw-btn-outline uw-btn-sm`}
          type="button"
          style={{
            borderColor: i18n.language?.startsWith("en") ? "var(--uw-brand)" : "var(--uw-border-strong)",
            color: i18n.language?.startsWith("en") ? "var(--uw-brand)" : "var(--uw-ink)"
          }}
        >
          EN
        </button>
      </div>

      <div className="uw-card animate-slide-up" style={{ padding: "36px 32px" }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--uw-fog)", marginBottom: 10 }}>
          AgentRegi
        </div>

        <h1 style={{ fontSize: 30, fontWeight: 900, margin: "0 0 16px", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
          법률·행정 업무,<br />
          이제 전문가에게 맡기세요.
        </h1>

        <p style={{ fontSize: 14, color: "var(--uw-slate)", margin: "0 0 24px", lineHeight: 1.6 }}>
          법원 인가 전문가가 처음부터 끝까지 처리합니다.
        </p>

        <button
          onClick={onGoogleLogin}
          disabled={busy}
          className="uw-btn uw-btn-brand uw-btn-lg"
          type="button"
          style={{ width: "100%", marginBottom: 14 }}
        >
          {busy ? "연결 중…" : "Google로 로그인"}
        </button>

        {log && (
          <div style={{
            padding: "12px 14px",
            borderRadius: "var(--uw-radius-md)",
            background: isError ? "var(--uw-danger-soft)" : "var(--uw-surface)",
            color: isError ? "var(--uw-danger)" : "var(--uw-graphite)",
            fontSize: 13,
            marginBottom: 14
          }}>
            {displayLog}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            className="uw-input"
            autoComplete="email"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="uw-input"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          <button
            onClick={() => (mode === "signup" ? onEmailSignUp(email, password) : onEmailLogin(email, password))}
            disabled={busy || !email.trim() || !password.trim()}
            className="uw-btn uw-btn-dark"
            type="button"
            style={{ width: "100%" }}
          >
            {mode === "signup" ? "이메일로 가입" : "이메일로 로그인"}
          </button>
        </div>

        <button
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          className="uw-btn uw-btn-ghost uw-btn-sm"
          type="button"
          style={{ width: "100%", marginTop: 10 }}
        >
          {mode === "signup" ? "이미 계정이 있으신가요?" : "이메일로 가입하기"}
        </button>
      </div>
    </div>
  );
}
