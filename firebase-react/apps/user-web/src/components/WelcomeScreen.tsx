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
    <div className="wc-root">
      <div className="wc-lang">
        <button
          onClick={() => i18n.changeLanguage("ko")}
          className={`wc-lang-btn${i18n.language?.startsWith("ko") ? " wc-lang-btn--active" : ""}`}
          type="button"
        >
          KO
        </button>
        <span className="wc-lang-sep">·</span>
        <button
          onClick={() => i18n.changeLanguage("en")}
          className={`wc-lang-btn${i18n.language?.startsWith("en") ? " wc-lang-btn--active" : ""}`}
          type="button"
        >
          EN
        </button>
      </div>

      <main className="wc-main">
        <p className="wc-wordmark">AgentRegi</p>

        <h1 className="wc-headline">
          법률·행정 업무,<br />
          이제 전문가에게 맡기세요.
        </h1>

        <button
          onClick={onGoogleLogin}
          disabled={busy}
          className="wc-cta"
          type="button"
        >
          {busy ? "연결 중…" : "Google로 로그인"}
        </button>

        <p className="wc-reassurance">
          법원 인가 전문가가 처음부터 끝까지 처리합니다.
        </p>

        {log && (
          <div className={`wc-log${isError ? " wc-log--error" : " wc-log--neutral"}`}>
            {displayLog}
          </div>
        )}

        <div className="wc-token-form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            className="wc-token-input"
            autoComplete="email"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="wc-token-input"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          <button
            onClick={() => (mode === "signup" ? onEmailSignUp(email, password) : onEmailLogin(email, password))}
            disabled={busy || !email.trim() || !password.trim()}
            className="wc-token-submit"
            type="button"
          >
            {mode === "signup" ? "이메일로 가입" : "이메일로 로그인"}
          </button>
        </div>

        <button
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          className="wc-token-link"
          type="button"
        >
          {mode === "signup" ? "이미 계정이 있으신가요?" : "이메일로 가입하기"}
        </button>
      </main>
    </div>
  );
}
