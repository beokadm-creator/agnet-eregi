import React from "react";
import { PropsWithChildren } from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<PropsWithChildren, ErrorBoundaryState> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to error reporting service in production
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "var(--uw-bg)"
          }}
        >
          <div
            style={{
              maxWidth: "480px",
              width: "100%",
              background: "var(--uw-bg)",
              borderRadius: "var(--uw-radius-xl)",
              padding: "48px 32px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
              border: "1px solid var(--uw-border)",
              textAlign: "center"
            }}
            className="animate-slide-up"
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 24px",
                borderRadius: "50%",
                background: "var(--uw-danger-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                color: "var(--uw-danger)"
              }}
            >
              ⚠️
            </div>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: "700",
                color: "var(--uw-ink)",
                marginBottom: "16px"
              }}
            >
              오류가 발생했습니다
            </h1>
            <p
              style={{
                fontSize: "15px",
                color: "var(--uw-slate)",
                lineHeight: "1.6",
                marginBottom: "32px"
              }}
            >
              죄송합니다. 예기치 않은 오류가 발생했습니다.
              <br />
              페이지를 다시 로드하여 다시 시도해 주세요.
            </p>
            <button
              onClick={this.handleRetry}
              className="uw-btn uw-btn-brand"
              style={{ width: "100%" }}
            >
              다시 시도
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
