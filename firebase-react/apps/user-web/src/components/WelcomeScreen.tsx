import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface WelcomeScreenProps {
  busy: boolean;
  log: string;
  onGuestLogin: () => void;
  onTokenLogin: (token: string) => void;
}

export default function WelcomeScreen({ busy, log, onGuestLogin, onTokenLogin }: WelcomeScreenProps) {
  const { i18n } = useTranslation();
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenValue, setTokenValue] = useState('');

  const isError = log.startsWith('[Error]');
  const displayLog = isError ? log.replace('[Error] ', '') : log;

  return (
    <div className="wc-root">
      <div className="wc-lang">
        <button
          onClick={() => i18n.changeLanguage('ko')}
          className={`wc-lang-btn${i18n.language?.startsWith('ko') ? ' wc-lang-btn--active' : ''}`}
        >
          KO
        </button>
        <span className="wc-lang-sep">·</span>
        <button
          onClick={() => i18n.changeLanguage('en')}
          className={`wc-lang-btn${i18n.language?.startsWith('en') ? ' wc-lang-btn--active' : ''}`}
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
          onClick={onGuestLogin}
          disabled={busy}
          className="wc-cta"
        >
          {busy ? '연결 중…' : '게스트로 시작하기'}
        </button>

        <p className="wc-reassurance">
          법원 인가 전문가가 처음부터 끝까지 처리합니다.
        </p>

        {log && (
          <div className={`wc-log${isError ? ' wc-log--error' : ' wc-log--neutral'}`}>
            {displayLog}
          </div>
        )}

        {!showTokenInput && (
          <button
            onClick={() => setShowTokenInput(true)}
            className="wc-token-link"
          >
            기존 계정이 있으신가요?
          </button>
        )}

        {showTokenInput && (
          <div className="wc-token-form">
            <input
              type="text"
              value={tokenValue}
              onChange={e => setTokenValue(e.target.value)}
              placeholder="토큰을 입력하세요"
              className="wc-token-input"
              autoFocus
            />
            <button
              onClick={() => onTokenLogin(tokenValue)}
              disabled={busy || !tokenValue.trim()}
              className="wc-token-submit"
            >
              적용
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
